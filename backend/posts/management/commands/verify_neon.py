from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError, connection


class Command(BaseCommand):
    help = (
        "Read-only check of the configured Neon PostgreSQL connection "
        "and Django model tables."
    )

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError(
                "Expected PostgreSQL, but the configured database is "
                f"{connection.vendor}."
            )

        host = connection.settings_dict.get("HOST", "")
        is_neon = "neon.tech" in host.lower()
        if not is_neon:
            self.stderr.write(
                self.style.WARNING(
                    "The configured PostgreSQL host does not identify as Neon."
                )
            )

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                connectivity_result = cursor.fetchone()
                cursor.execute("SELECT current_database(), current_schema()")
                database_name, schema_name = cursor.fetchone()
        except DatabaseError as error:
            raise CommandError(
                "Could not query the configured PostgreSQL database "
                f"({type(error).__name__}). Check DATABASE_URL and SSL settings."
            ) from error

        if not connectivity_result or connectivity_result[0] != 1:
            raise CommandError("Database connectivity check failed.")

        expected_tables = set()
        for model in apps.get_models(include_auto_created=True):
            if model._meta.managed:
                expected_tables.add(model._meta.db_table)

        existing_tables = set(connection.introspection.table_names())
        missing_tables = sorted(expected_tables - existing_tables)
        row_counts = {}
        if not missing_tables:
            try:
                with connection.cursor() as cursor:
                    for table in sorted(expected_tables):
                        cursor.execute(
                            "SELECT COUNT(*) FROM "
                            f"{connection.ops.quote_name(table)}"
                        )
                        row_counts[table] = cursor.fetchone()[0]
            except DatabaseError as error:
                raise CommandError(
                    "Could not count model-table rows "
                    f"({type(error).__name__})."
                ) from error

        self.stdout.write(f"PostgreSQL connection: {self.style.SUCCESS('OK')}")
        self.stdout.write(f"Neon host detected: {'yes' if is_neon else 'no'}")
        self.stdout.write(f"Database/schema: {database_name}/{schema_name}")
        self.stdout.write(
            f"Model tables present: {len(expected_tables) - len(missing_tables)}"
            f"/{len(expected_tables)}"
        )

        for table in sorted(expected_tables):
            marker = "OK" if table in existing_tables else "MISSING"
            style = self.style.SUCCESS if marker == "OK" else self.style.ERROR
            row_count = (
                f" ({row_counts[table]} rows)"
                if table in row_counts
                else ""
            )
            self.stdout.write(f"{style(marker)} {table}{row_count}")

        if missing_tables:
            raise CommandError(
                "Some Django model tables are missing; apply migrations "
                "before treating this database as verified."
            )
        if not is_neon:
            raise CommandError(
                "Database is reachable, but this command did not verify Neon."
            )

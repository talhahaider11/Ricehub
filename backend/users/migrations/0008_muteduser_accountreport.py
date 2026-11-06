import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("users", "0007_remove_blockeduser_unique_user_block_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="MutedUser",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("muted", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="muted_by_users", to=settings.AUTH_USER_MODEL)),
                ("muter", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="muted_users", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name="muteduser",
            constraint=models.UniqueConstraint(fields=("muter", "muted"), name="unique_muted_user"),
        ),
        migrations.AddConstraint(
            model_name="muteduser",
            constraint=models.CheckConstraint(check=~models.Q(("muter", models.F("muted"))), name="cannot_mute_self"),
        ),
        migrations.CreateModel(
            name="AccountReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.CharField(choices=[("spam", "Spam"), ("harassment", "Harassment"), ("impersonation", "Impersonation"), ("other", "Other")], max_length=20)),
                ("details", models.TextField(blank=True, max_length=2000)),
                ("status", models.CharField(choices=[("open", "Open"), ("reviewed", "Reviewed")], default="open", max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("reported_user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="account_reports_received", to=settings.AUTH_USER_MODEL)),
                ("reporter", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="account_reports_sent", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="SupportRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subject", models.CharField(max_length=200)),
                ("details", models.TextField(max_length=5000)),
                ("status", models.CharField(choices=[("open", "Open"), ("reviewed", "Reviewed")], default="open", max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("reporter", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="support_requests", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]

import logging

from django.db import DatabaseError, connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def health_check(request):
    """
    Render.com deployment ke liye Database & API health check endpoint.
    """
    try:
        # Check Database Connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")

        return JsonResponse(
            {
                "status": "ok",
                "service": "ricehub-api",
                "database": "ok",
            },
            status=200,
        )

    except DatabaseError:
        logger.exception("Health check database query failed.")
        return JsonResponse(
            {
                "status": "error",
                "service": "ricehub-api",
                "database": "unavailable",
            },
            status=503,
        )
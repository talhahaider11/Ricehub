from django.db import connection
from django.http import JsonResponse


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

    except Exception as e:
        return JsonResponse(
            {
                "status": "error",
                "service": "ricehub-api",
                "database": "unavailable",
                "details": str(e),
            },
            status=503,
        )
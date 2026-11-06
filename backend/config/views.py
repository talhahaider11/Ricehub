from django.core.cache import cache
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        health_status = {"status": "ok", "database": "unknown", "cache": "unknown"}

        # 1. Check PostgreSQL Database Connection
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            health_status["database"] = "ok"
        except Exception as e:
            health_status["database"] = f"unavailable ({str(e)})"
            health_status["status"] = "degraded"

        # 2. Check Redis Cache Connection
        try:
            cache.set("health_check_ping", "pong", timeout=10)
            cache_result = cache.get("health_check_ping")
            if cache_result == "pong":
                health_status["cache"] = "ok"
            else:
                health_status["cache"] = "unexpected_response"
                health_status["status"] = "degraded"
        except Exception as e:
            health_status["cache"] = f"unavailable ({str(e)})"
            health_status["status"] = "degraded"

        # If Database is down, return HTTP 503, otherwise HTTP 200
        http_status = 503 if health_status["database"] != "ok" else 200

        return Response(health_status, status=http_status)
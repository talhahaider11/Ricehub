from unittest.mock import patch

from django.db.utils import OperationalError
from django.http import HttpResponse
from django.test import Client, RequestFactory, SimpleTestCase
from django.urls import resolve

from .health import health_check
from .middleware import RequestIDMiddleware


class HealthCheckTests(SimpleTestCase):
    def test_render_health_path_resolves_to_database_health_check(self):
        self.assertIs(resolve("/health/").func, health_check)

    def test_api_health_path_resolves_to_database_health_check(self):
        self.assertIs(resolve("/api/health/").func, health_check)

    def test_render_health_endpoint_returns_healthy_database_status(self):
        with patch("config.health.connection") as database:
            response = Client().get("/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["database"], "ok")
        database.cursor.assert_called_once()

    def test_database_errors_are_not_exposed_in_health_response(self):
        request = RequestFactory().get("/api/health/")
        with patch(
            "config.health.connection"
        ) as database:
            database.cursor.side_effect = OperationalError(
                "sensitive database endpoint"
            )
            response = health_check(request)

        self.assertEqual(response.status_code, 503)
        self.assertNotContains(response, "sensitive database endpoint", status_code=503)
        self.assertContains(response, '"database": "unavailable"', status_code=503)


class RequestIDMiddlewareTests(SimpleTestCase):
    def test_valid_request_id_is_preserved_and_returned(self):
        request = RequestFactory().get(
            "/health/",
            HTTP_X_REQUEST_ID="request:abc-123",
        )
        response = RequestIDMiddleware(lambda incoming: HttpResponse())(
            request
        )
        self.assertEqual(response["X-Request-ID"], "request:abc-123")

    def test_unsafe_request_id_is_replaced(self):
        request = RequestFactory().get(
            "/health/",
            HTTP_X_REQUEST_ID="invalid request id",
        )
        response = RequestIDMiddleware(lambda incoming: HttpResponse())(
            request
        )
        self.assertRegex(
            response["X-Request-ID"],
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        )

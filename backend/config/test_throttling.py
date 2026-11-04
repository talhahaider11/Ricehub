from types import SimpleNamespace

from django.core.cache import cache
from django.test import RequestFactory, SimpleTestCase

from moderation.views import BlockUserView
from posts.views import PostListCreateView
from users.views import LoginView

from .throttling import (
    LoginRateThrottle,
    ModerationRateThrottle,
    MessageRateThrottle,
    PostCreateRateThrottle,
    RegisterRateThrottle,
)


class ThrottleTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.factory = RequestFactory()

    def tearDown(self):
        cache.clear()

    def test_login_endpoint_returns_429_after_five_requests_per_minute(self):
        view = LoginView.as_view()
        responses = []
        for _ in range(6):
            request = self.factory.post(
                "/api/auth/login/",
                data='{"username":"","password":""}',
                content_type="application/json",
                REMOTE_ADDR="198.51.100.10",
            )
            responses.append(view(request).status_code)

        self.assertEqual(responses, [400, 400, 400, 400, 400, 429])

    def test_post_creation_throttle_is_user_scoped(self):
        user = SimpleNamespace(pk=17, is_authenticated=True)
        statuses = []
        for _ in range(11):
            request = self.factory.post("/api/posts/")
            request.user = user
            throttle = PostCreateRateThrottle()
            statuses.append(throttle.allow_request(request, None))

        self.assertEqual(statuses, [True] * 10 + [False])

    def test_post_create_throttle_only_applies_to_post_method(self):
        post_view = PostListCreateView()
        post_view.request = self.factory.post("/api/posts/")
        self.assertIsInstance(post_view.get_throttles()[0], PostCreateRateThrottle)

        list_view = PostListCreateView()
        list_view.request = self.factory.get("/api/posts/")
        self.assertNotIn(
            PostCreateRateThrottle,
            [type(throttle) for throttle in list_view.get_throttles()],
        )

    def test_moderation_throttle_only_applies_to_write_methods(self):
        write_view = BlockUserView()
        write_view.request = self.factory.post("/api/moderation/blocks/")
        self.assertIsInstance(
            write_view.get_throttles()[0],
            ModerationRateThrottle,
        )

        read_view = BlockUserView()
        read_view.request = self.factory.get("/api/moderation/blocks/")
        self.assertNotIn(
            ModerationRateThrottle,
            [type(throttle) for throttle in read_view.get_throttles()],
        )

    def test_login_throttle_is_attached_to_login_view(self):
        view = LoginView()
        view.request = self.factory.post("/api/auth/login/")
        self.assertIsInstance(view.get_throttles()[0], LoginRateThrottle)

    def test_registration_is_limited_to_five_requests_per_hour(self):
        statuses = []
        for _ in range(6):
            request = self.factory.post(
                "/api/users/register/",
                REMOTE_ADDR="198.51.100.11",
            )
            statuses.append(RegisterRateThrottle().allow_request(request, None))

        self.assertEqual(statuses, [True] * 5 + [False])

    def test_message_throttle_is_attached_only_to_message_creation(self):
        from messaging.views import MessageListCreateView

        create_view = MessageListCreateView()
        create_view.request = self.factory.post("/api/messages/conversations/1/messages/")
        self.assertIsInstance(create_view.get_throttles()[0], MessageRateThrottle)

        list_view = MessageListCreateView()
        list_view.request = self.factory.get("/api/messages/conversations/1/messages/")
        self.assertNotIn(
            MessageRateThrottle,
            [type(throttle) for throttle in list_view.get_throttles()],
        )

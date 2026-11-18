from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

from rest_framework_simplejwt.exceptions import (
    InvalidToken,
    TokenError,
)

from rest_framework_simplejwt.tokens import (
    AccessToken,
)

from users.account_status import is_user_suspended

User = get_user_model()


def _resolve_user_from_token(token):
    try:
        access_token = AccessToken(token)
        user_id = access_token["user_id"]
    except (
        InvalidToken,
        TokenError,
        KeyError,
        TypeError,
        ValueError,
    ) as error:
        return None, f"JWT validation failed: {error}"

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None, "JWT user does not exist"

    if is_user_suspended(user):
        return None, "JWT user is suspended"
    if not user.is_active:
        return None, "JWT user is inactive"
    return user, None


@database_sync_to_async
def get_user_from_token(token):
    user, _ = _resolve_user_from_token(token)
    return user


@database_sync_to_async
def get_user_authentication(token):
    return _resolve_user_from_token(token)


class JWTAuthMiddleware(
    BaseMiddleware
):

    async def __call__(
        self,
        scope,
        receive,
        send,
    ):

        try:
            query_string = scope.get("query_string", b"").decode("utf-8")
            query_params = parse_qs(query_string, keep_blank_values=True)
        except UnicodeDecodeError:
            query_params = {}
            auth_error = "WebSocket query string is not valid UTF-8"
        else:
            auth_error = None

        token = query_params.get("token", [None])[0]
        if not token:
            auth_error = auth_error or "JWT query parameter is missing or empty"
            user = None
        else:
            user, auth_error = await get_user_authentication(token)

        scope["user"] = user or AnonymousUser()
        scope["jwt_auth_error"] = auth_error

        return await super().__call__(
            scope,
            receive,
            send,
        )
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware

from django.contrib.auth import get_user_model

from rest_framework_simplejwt.exceptions import (
    InvalidToken,
    TokenError,
)

from rest_framework_simplejwt.tokens import (
    AccessToken,
)

from users.account_status import is_user_suspended

User = get_user_model()


@database_sync_to_async
def get_user_from_token(token):

    try:

        access_token = AccessToken(
            token
        )

        user_id = access_token[
            "user_id"
        ]

        user = User.objects.get(
            id=user_id
        )
        if is_user_suspended(user) or not user.is_active:
            return None
        return user

    except (
        InvalidToken,
        TokenError,
        User.DoesNotExist,
    ):
        return None


class JWTAuthMiddleware(
    BaseMiddleware
):

    async def __call__(
        self,
        scope,
        receive,
        send,
    ):

        query_string = scope.get(
            "query_string",
            b""
        ).decode()

        query_params = parse_qs(
            query_string
        )

        token = query_params.get(
            "token",
            [None]
        )[0]

        if token:

            scope["user"] = (
                await get_user_from_token(
                    token
                )
            )

        else:

            scope["user"] = None

        return await super().__call__(
            scope,
            receive,
            send,
        )
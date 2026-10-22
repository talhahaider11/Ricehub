from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes

User = get_user_model()


def send_password_reset_email(user, frontend_url):
    uid = urlsafe_base64_encode(
        force_bytes(user.pk)
    )

    token = default_token_generator.make_token(user)

    reset_url = (
        f"{frontend_url}/reset-password/"
        f"{uid}/{token}/"
    )

    send_mail(
        subject="Reset your RiceHub password",
        message=(
            "Use the following link to reset your password:\n\n"
            f"{reset_url}"
        ),
        from_email=None,
        recipient_list=[user.email],
        fail_silently=False,
    )

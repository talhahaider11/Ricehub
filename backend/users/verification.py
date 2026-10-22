import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.utils import timezone


def send_verification_code(user, verification):
    code = f"{secrets.randbelow(1_000_000):06d}"
    sent = send_mail(
        subject="Your RiceHub verification code",
        message=(
            f"Your RiceHub verification code is {code}. "
            "It expires in 10 minutes."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
    if sent != 1:
        raise OSError("The email backend did not confirm delivery.")

    verification.code_hash = make_password(code)
    verification.expires_at = timezone.now() + timedelta(minutes=10)
    verification.last_sent_at = timezone.now()
    verification.attempts = 0
    verification.save(
        update_fields=[
            "code_hash",
            "expires_at",
            "last_sent_at",
            "attempts",
        ]
    )

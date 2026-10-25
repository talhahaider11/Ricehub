
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.utils import timezone


OTP_EXPIRY_MINUTES = 10
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_MAX_ATTEMPTS = 5


def send_verification_code(user, verification):
    # Invalidate the previous code before attempting a resend.
    verification.code_hash = ""
    verification.expires_at = None
    verification.attempts = 0
    verification.save(
        update_fields=["code_hash", "expires_at", "attempts"]
    )

    code = f"{secrets.randbelow(1_000_000):06d}"

    sent = send_mail(
        subject="Your RiceHub verification code",
        message=(
            f"Hello {user.username},\n\n"
            f"Your RiceHub verification code is {code}.\n"
            f"It expires in {OTP_EXPIRY_MINUTES} minutes.\n\n"
            "If you did not request this code, ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )

    if sent != 1:
        raise OSError("Verification email could not be sent.")

    now = timezone.now()
    verification.code_hash = make_password(code)
    verification.expires_at = now + timedelta(
        minutes=OTP_EXPIRY_MINUTES
    )
    verification.last_sent_at = now
    verification.attempts = 0
    verification.save(
        update_fields=[
            "code_hash",
            "expires_at",
            "last_sent_at",
            "attempts",
        ]
    )

    return True

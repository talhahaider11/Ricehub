import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.utils import timezone

from .models import TwoFactorChallenge


def send_two_factor_code(user, purpose):
    code = f"{secrets.randbelow(1_000_000):06d}"
    TwoFactorChallenge.objects.filter(user=user).delete()
    sent = send_mail(
        subject="Your RiceHub sign-in verification code",
        message=(
            f"Your RiceHub verification code is {code}. "
            "It expires in 10 minutes."
        ),
        from_email=None,
        recipient_list=[user.email],
        fail_silently=False,
    )
    if sent != 1:
        raise OSError("The email backend did not confirm delivery.")

    TwoFactorChallenge.objects.update_or_create(
        user=user,
        defaults={
            "code_hash": make_password(code),
            "purpose": purpose,
            "expires_at": timezone.now() + timedelta(minutes=10),
            "attempts": 0,
        },
    )


def verify_two_factor_code(challenge, code):
    if challenge.expires_at <= timezone.now():
        challenge.delete()
        return False, "This code has expired. Request a new one."
    if challenge.attempts >= 5:
        challenge.delete()
        return False, "Too many attempts. Sign in and request a new code."
    if not check_password(code, challenge.code_hash):
        challenge.attempts += 1
        challenge.save(update_fields=["attempts"])
        return False, "The verification code is incorrect."
    return True, ""


def mask_email(email):
    local, separator, domain = email.partition("@")
    if not separator:
        return email
    visible = local[:1]
    return f"{visible}{'*' * max(2, len(local) - 1)}@{domain}"

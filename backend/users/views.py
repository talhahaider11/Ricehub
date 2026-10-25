import random
import logging
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth import get_user_model

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from .models import EmailVerification  # Ensure model name matches your project

User = get_user_model()
logger = logging.getLogger(__name__)


# --- REGISTER VIEW ---
class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username")
        email = request.data.get("email")
        password = request.data.get("password")

        if not email or not password or not username:
            return Response(
                {"error": "All fields (username, email, password) are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"error": "User with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. User inactive state mein create karein
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            is_active=False,
            is_email_verified=False
        )

        # 2. 6-digit OTP generate karein
        otp_code = str(random.randint(100000, 999999))
        EmailVerification.objects.create(user=user, code=otp_code)

        # 3. SMTP Mail send karein (fail_silently=False enforces throwing errors)
        try:
            send_mail(
                subject="RiceHub - Your Email Verification Code",
                message=f"Hello {username},\n\nYour verification OTP code is: {otp_code}\n\nThank you!",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Email delivery error: {str(e)}")
            user.delete()  # Email na jane par unverified user delete kar dein
            return Response(
                {"error": f"Failed to send email: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {"message": "Verification code sent to your email."},
            status=status.HTTP_201_CREATED
        )


# --- VERIFY EMAIL VIEW (STRICT CODE CHECK) ---
class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        code = request.data.get("code")
        email = request.data.get("email")

        if not code or not email:
            return Response(
                {"error": "Email and verification code are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Strict DB verification match
        verification = EmailVerification.objects.filter(
            user__email=email,
            code=str(code).strip()
        ).first()

        if not verification:
            return Response(
                {"error": "Invalid verification code!"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Code sahi milne par activate karein
        user = verification.user
        user.is_active = True
        user.is_email_verified = True
        user.save()

        # Used code delete kar dein
        verification.delete()

        return Response(
            {"message": "Email verified successfully! You can now log in."},
            status=status.HTTP_200_OK
        )


# --- RESEND VERIFICATION CODE VIEW ---
class ResendVerificationCodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        user = User.objects.filter(email=email).first()

        if not user:
            return Response({"error": "User with this email does not exist."}, status=status.HTTP_404_NOT_FOUND)

        if user.is_email_verified:
            return Response({"message": "Email is already verified."}, status=status.HTTP_400_BAD_REQUEST)

        # Old code cleanup & new code generation
        EmailVerification.objects.filter(user=user).delete()
        otp_code = str(random.randint(100000, 999999))
        EmailVerification.objects.create(user=user, code=otp_code)

        try:
            send_mail(
                subject="RiceHub - Resend Verification Code",
                message=f"Hello {user.username},\n\nYour new verification code is: {otp_code}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            return Response({"error": f"Failed to send email: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"message": "New verification code sent to your email."}, status=status.HTTP_200_OK)


# --- ACCOUNT MANAGEMENT VIEWS ---
class AccountExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "username": user.username,
            "email": user.email,
            "date_joined": user.date_joined
        }, status=status.HTTP_200_OK)


class AccountDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        user = request.user
        user.delete()
        return Response({"message": "Account deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
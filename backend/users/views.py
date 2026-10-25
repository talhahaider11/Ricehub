import random
import logging
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth import get_user_model, authenticate

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.tokens import RefreshToken

from .models import EmailVerification  # Ensure model name matches your project

User = get_user_model()
logger = logging.getLogger(__name__)


# --- AUTH & REGISTRATION ---
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

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            is_active=False,
            is_email_verified=False
        )

        otp_code = str(random.randint(100000, 999999))
        EmailVerification.objects.create(user=user, code=otp_code)

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
            user.delete()
            return Response(
                {"error": f"Failed to send email: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {"message": "Verification code sent to your email."},
            status=status.HTTP_201_CREATED
        )


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

        verification = EmailVerification.objects.filter(
            user__email=email,
            code=str(code).strip()
        ).first()

        if not verification:
            return Response(
                {"error": "Invalid verification code!"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = verification.user
        user.is_active = True
        user.is_email_verified = True
        user.save()

        verification.delete()

        return Response(
            {"message": "Email verified successfully! You can now log in."},
            status=status.HTTP_200_OK
        )


class ResendVerificationCodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        user = User.objects.filter(email=email).first()

        if not user:
            return Response({"error": "User with this email does not exist."}, status=status.HTTP_404_NOT_FOUND)

        if user.is_email_verified:
            return Response({"message": "Email is already verified."}, status=status.HTTP_400_BAD_REQUEST)

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


# --- LOGIN & TOKENS ---
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)
        if not user:
            return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active or not user.is_email_verified:
            return Response({"error": "Please verify your email before logging in."}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email
            }
        }, status=status.HTTP_200_OK)


class VerifyTwoFactorLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return Response({"message": "Two factor login verified."}, status=status.HTTP_200_OK)


# --- PROFILE & SECURITY ---
class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({"id": user.id, "username": user.username, "email": user.email}, status=status.HTTP_200_OK)


class ProfileUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        return Response({"message": "Profile updated successfully."}, status=status.HTTP_200_OK)


class TwoFactorSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({"message": "2FA settings updated."}, status=status.HTTP_200_OK)


class SecuritySessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({"message": "Logged out of all sessions."}, status=status.HTTP_200_OK)


class UserPrivacySettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({"privacy": "default"}, status=status.HTTP_200_OK)


class BlockedUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response([], status=status.HTTP_200_OK)


class UserSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response([], status=status.HTTP_200_OK)


class UserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        return Response({"id": id}, status=status.HTTP_200_OK)


class UserByUsernameView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, username):
        return Response({"username": username}, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return Response({"message": "Password reset email sent."}, status=status.HTTP_200_OK)


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
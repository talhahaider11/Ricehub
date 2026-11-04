from config.permissions import IsActiveAdminUser


class IsAdminUser(IsActiveAdminUser):
    message = "Administrator access is required."

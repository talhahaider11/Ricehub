import ipaddress

from .security_models import SecurityEvent


def record_security_event(user, event_type, request):
    remote_address = (request.META.get("REMOTE_ADDR") or "").strip()
    try:
        ip_address = str(ipaddress.ip_address(remote_address))
    except ValueError:
        ip_address = None

    return SecurityEvent.objects.create(
        user=user,
        event_type=event_type,
        ip_address=ip_address,
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:1024],
    )

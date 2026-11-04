import base64
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings


logger = logging.getLogger(__name__)


class SMSConfigurationError(Exception):
    pass


class SMSDeliveryError(Exception):
    pass


def send_sms(phone_number, message):
    provider = getattr(settings, "SMS_PROVIDER", "").lower()
    if provider != "twilio":
        raise SMSConfigurationError("SMS delivery is not configured.")

    account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", "")
    auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", "")
    sender = getattr(settings, "TWILIO_FROM_NUMBER", "")
    if not account_sid or not auth_token or not sender:
        raise SMSConfigurationError("SMS delivery is not configured.")

    endpoint = (
        f"https://api.twilio.com/2010-04-01/Accounts/"
        f"{account_sid}/Messages.json"
    )
    credentials = base64.b64encode(
        f"{account_sid}:{auth_token}".encode("utf-8")
    ).decode("ascii")
    request = Request(
        endpoint,
        data=urlencode(
            {"To": phone_number, "From": sender, "Body": message}
        ).encode("utf-8"),
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            if response.status >= 400:
                raise SMSDeliveryError("SMS provider rejected the message.")
    except (HTTPError, URLError, TimeoutError) as error:
        logger.exception("Phone verification SMS delivery failed.")
        raise SMSDeliveryError("SMS delivery failed.") from error

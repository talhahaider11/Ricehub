from email.utils import parseaddr
import logging
import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class BrevoEmailBackend(BaseEmailBackend):
    api_url = "https://api.brevo.com/v3/smtp/email"

    def send_messages(self, email_messages):
        """
        Django's send_mail() executes this method automatically.
        """
        if not email_messages:
            return 0

        num_sent = 0
        for message in email_messages:
            if self._send_message(message):
                num_sent += 1
        return num_sent

    def _send_message(self, message):
        # users/email_backends.py ke _send_message method mein:

        sender_email = (
            getattr(settings, "BREVO_SENDER_EMAIL", "").strip()
            or getattr(settings, "DEFAULT_FROM_EMAIL", "").strip()
            or "ricehub32@gmail.com"  # Hardcode fallback so it never defaults to wrong email
        )

        sender_name = (
            getattr(settings, "BREVO_SENDER_NAME", "")
            or parseaddr(message.from_email or getattr(settings, "DEFAULT_FROM_EMAIL", ""))[0]
            or "RiceHub"
        )

        payload = {
            "sender": {"name": sender_name, "email": sender_email},
            "to": [self._format_address(address) for address in message.to if address],
            "subject": message.subject,
        }

        # HTML / Text Body Handling
        html_body = None
        if hasattr(message, "alternatives") and message.alternatives:
            html_body = next(
                (
                    content
                    for content, mimetype in reversed(message.alternatives)
                    if mimetype == "text/html"
                ),
                None,
            )

        if message.content_subtype == "html":
            html_body = message.body

        if html_body is not None:
            payload["htmlContent"] = html_body
        else:
            payload["textContent"] = message.body

        if message.cc:
            payload["cc"] = [
                self._format_address(address) for address in message.cc if address
            ]
        if message.bcc:
            payload["bcc"] = [
                self._format_address(address) for address in message.bcc if address
            ]
        if message.reply_to:
            payload["replyTo"] = self._format_address(message.reply_to[0])

        api_key = getattr(settings, "BREVO_API_KEY", "").strip()
        timeout = getattr(settings, "EMAIL_TIMEOUT", 15)

        try:
            response = requests.post(
                self.api_url,
                headers={
                    "api-key": api_key,
                    "accept": "application/json",
                    "content-type": "application/json",
                },
                json=payload,
                timeout=timeout,
            )
            if response.status_code in [200, 201, 202]:
                return True
            else:
                logger.error(f"Brevo email API error ({response.status_code}): {response.text}")
                if not self.fail_silently:
                    return False
                return False

        except requests.RequestException as error:
            logger.error(f"Could not connect to Brevo email API: {str(error)}")
            if not self.fail_silently:
                return False
            return False

    @staticmethod
    def _format_address(address):
        name, email = parseaddr(address)
        if not email:
            email = address
        result = {"email": email}
        if name:
            result["name"] = name
        return result
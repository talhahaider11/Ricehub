from email.utils import parseaddr

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend


class BrevoEmailBackend(BaseEmailBackend):
    api_url = "https://api.brevo.com/v3/smtp/email"

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        if not settings.BREVO_API_KEY:
            raise OSError("Brevo email delivery is not configured.")

        sent_count = 0
        for message in email_messages:
            try:
                self._send_message(message)
            except OSError:
                if not self.fail_silently:
                    raise
            else:
                sent_count += 1
        return sent_count

    def _send_message(self, message):
        sender_email = (
            settings.BREVO_SENDER_EMAIL
            or parseaddr(message.from_email or settings.DEFAULT_FROM_EMAIL)[1]
        )
        if not sender_email:
            raise OSError("Brevo sender email is not configured.")

        sender_name = (
            settings.BREVO_SENDER_NAME
            or parseaddr(message.from_email or settings.DEFAULT_FROM_EMAIL)[0]
            or "RiceHub"
        )
        payload = {
            "sender": {"name": sender_name, "email": sender_email},
            "to": [self._format_address(address) for address in message.to],
            "subject": message.subject,
        }

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
                self._format_address(address) for address in message.cc
            ]
        if message.bcc:
            payload["bcc"] = [
                self._format_address(address) for address in message.bcc
            ]
        if message.reply_to:
            payload["replyTo"] = self._format_address(message.reply_to[0])

        try:
            response = requests.post(
                self.api_url,
                headers={
                    "api-key": settings.BREVO_API_KEY,
                    "accept": "application/json",
                    "content-type": "application/json",
                },
                json=payload,
                timeout=settings.EMAIL_TIMEOUT,
            )
        except requests.RequestException as error:
            raise OSError("Could not connect to Brevo email API.") from error

        if not response.ok:
            raise OSError(
                f"Brevo email API returned HTTP {response.status_code}."
            )

    @staticmethod
    def _format_address(address):
        name, email = parseaddr(address)
        if not email:
            raise OSError("An email recipient address is invalid.")
        result = {"email": email}
        if name:
            result["name"] = name
        return result

"""Login-code email through Resend, with the standard library only."""
import html
import json
import logging
import urllib.error
import urllib.request

from . import config

log = logging.getLogger("wedding")
RESEND_URL = "https://api.resend.com/emails"


def can_deliver() -> bool:
    return bool(config.resend_api_key()) or config.otp_debug()


def send_email(to: str, subject: str, text: str, html_body: str) -> None:
    """Raises on any failure. Tests replace this function."""
    payload = {"from": config.email_from(), "to": [to], "subject": subject, "text": text, "html": html_body}
    req = urllib.request.Request(
        RESEND_URL, data=json.dumps(payload).encode(), method="POST",
        headers={"Authorization": f"Bearer {config.resend_api_key()}", "Content-Type": "application/json",
                 "User-Agent": "wedding-invite-api/2.1"})
    with urllib.request.urlopen(req, timeout=10) as res:
        res.read()


def deliver_otp(to: str, name: str, code: str) -> None:
    """Never raises: the caller has already answered. Logs one line on failure, without the code or key."""
    if not config.resend_api_key():
        if config.otp_debug():
            log.warning("OTP_DEBUG login code for %s: %s", to, code)
        return
    text = (f"Assalamu Alaikum {name},\n\nYour login code for the wedding admin panel is {code}\n\n"
            "It works once and expires in 10 minutes. If you did not ask for it, ignore this email.\n")
    html_body = (f"<p>Assalamu Alaikum {html.escape(name)},</p>"
                 "<p>Your login code for the wedding admin panel is</p>"
                 f'<p style="font-size:28px;font-weight:700;letter-spacing:6px">{code}</p>'
                 "<p>It works once and expires in 10 minutes. If you did not ask for it, ignore this email.</p>")
    try:
        send_email(to, "Your wedding admin login code", text, html_body)
    except urllib.error.HTTPError as exc:
        log.warning("Login code email was not sent: Resend answered HTTP %s", exc.code)
    except Exception as exc:  # network, timeout, bad config
        log.warning("Login code email was not sent: %s", type(exc).__name__)

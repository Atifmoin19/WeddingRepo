import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ADMIN_PASSWORD"] = "secret-pass"
os.environ.pop("ADMIN_PASSWORD_HASH", None)
os.environ["OWNER_EMAIL"] = "Owner@Example.com"
os.environ["OWNER_NAME"] = "Atif"
for _k in ("RESEND_API_KEY", "OTP_DEBUG", "EMAIL_FROM"):
    os.environ.pop(_k, None)
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine, init_db  # noqa: E402
from app.main import app  # noqa: E402
import re  # noqa: E402

from app import mailer  # noqa: E402
from app.ratelimit import ALL_LIMITERS  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    init_db()
    for limiter in ALL_LIMITERS:
        limiter.reset()
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def outbox(monkeypatch):
    """Captures login emails instead of calling Resend. Each item: {to, subject, text, html, code}."""
    sent = []

    def fake_send(to, subject, text, html_body):
        sent.append({"to": to, "subject": subject, "text": text, "html": html_body,
                     "code": re.search(r"\b(\d{6})\b", text).group(1)})

    monkeypatch.setenv("RESEND_API_KEY", "re_test_key_do_not_log")
    monkeypatch.setattr(mailer, "send_email", fake_send)
    return sent


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def otp_login(client, outbox):
    """otp_login(email) -> auth headers, through the real request + verify routes."""
    def go(email):
        for limiter in ALL_LIMITERS:
            limiter.reset()
        assert client.post("/admin/otp/request", json={"email": email}).status_code == 200
        r = client.post("/admin/otp/verify", json={"email": email, "code": outbox[-1]["code"]})
        assert r.status_code == 200, r.text
        return bearer(r.json()["token"])
    return go


@pytest.fixture()
def auth(otp_login):
    """The owner, logged in with an emailed code."""
    return otp_login("owner@example.com")


@pytest.fixture()
def make_admin(client, auth, otp_login):
    """make_admin(name, email) -> (admin dict, auth headers)."""
    def go(name="Bilal", email="bilal@example.com", phone="9811111111"):
        r = client.post("/admin/admins", json={"name": name, "email": email, "phone": phone}, headers=auth)
        assert r.status_code == 201, r.text
        return r.json(), otp_login(email)
    return go


@pytest.fixture()
def guest(client, auth):
    r = client.post("/admin/guests", json={"name": "Ali & Family", "phone": "9876543210"}, headers=auth)
    assert r.status_code == 201
    return r.json()

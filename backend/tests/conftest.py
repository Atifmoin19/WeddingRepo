import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ADMIN_PASSWORD"] = "secret-pass"
os.environ.pop("ADMIN_PASSWORD_HASH", None)
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.ratelimit import login_limiter, public_limiter  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    init_db()
    public_limiter.reset()
    login_limiter.reset()
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth(client):
    r = client.post("/admin/login", json={"password": "secret-pass"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def guest(client, auth):
    r = client.post("/admin/guests", json={"name": "Ali & Family", "phone": "9876543210"}, headers=auth)
    assert r.status_code == 201
    return r.json()

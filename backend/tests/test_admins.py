"""Admins and OTP login (SPEC v2.1)."""
import csv
import io
import logging
import urllib.error
from datetime import timedelta

from sqlalchemy import select

from app import mailer, ratelimit
from app.db import Admin, Guest, OtpCode, SessionLocal, init_db, utcnow
from app.ratelimit import ALL_LIMITERS



def bearer(token):
    return {"Authorization": f"Bearer {token}"}

OWNER = "owner@example.com"


def reset_limits():
    for limiter in ALL_LIMITERS:
        limiter.reset()


def request_code(client, email):
    return client.post("/admin/otp/request", json={"email": email})


def verify(client, email, code):
    return client.post("/admin/otp/verify", json={"email": email, "code": code})


# ---- owner bootstrap ----
def test_owner_created_from_env_once(client):
    with SessionLocal() as db:
        admins = db.scalars(select(Admin)).all()
    assert [(a.email, a.name, a.role, a.active) for a in admins] == [(OWNER, "Atif", "owner", True)]
    init_db()  # a second startup adds nothing
    with SessionLocal() as db:
        assert len(db.scalars(select(Admin)).all()) == 1


def test_owner_defaults_to_localhost_without_env(client, monkeypatch):
    from app.db import Base, engine
    monkeypatch.delenv("OWNER_EMAIL")
    monkeypatch.delenv("OWNER_NAME")
    Base.metadata.drop_all(engine)
    init_db()
    r = client.post("/admin/login", json={"password": "secret-pass"})
    assert r.status_code == 200 and r.json()["admin"]["email"] == "owner@localhost"
    assert r.json()["admin"]["role"] == "owner"


def test_owner_email_change_keeps_a_single_owner(client, monkeypatch):
    monkeypatch.setenv("OWNER_EMAIL", "new-owner@example.com")
    init_db()
    with SessionLocal() as db:
        admins = db.scalars(select(Admin)).all()
    assert [(a.email, a.role) for a in admins] == [("new-owner@example.com", "owner")]


# ---- OTP ----
def test_otp_happy_path_and_me(client, outbox):
    r = request_code(client, " Owner@Example.COM ")
    assert r.status_code == 200 and r.json() == {"sent": True}
    assert len(outbox) == 1 and outbox[0]["to"] == OWNER
    code = outbox[0]["code"]
    assert code in outbox[0]["html"] and code not in r.text
    with SessionLocal() as db:  # only a hash is stored
        row = db.get(OtpCode, OWNER)
        assert code not in row.code_hash and len(row.code_hash) == 64
    r = verify(client, "OWNER@example.com", code)
    assert r.status_code == 200
    body = r.json()
    assert body["expiresIn"] == 43200 * 60 and set(body["admin"]) == {"id", "name", "email", "role"}
    assert body["admin"]["email"] == OWNER and body["admin"]["role"] == "owner"
    me = client.get("/admin/me", headers=bearer(body["token"]))
    assert me.status_code == 200
    assert me.json() == {"id": body["admin"]["id"], "name": "Atif", "email": OWNER, "phone": "", "role": "owner"}


def test_otp_single_use(client, outbox):
    request_code(client, OWNER)
    code = outbox[0]["code"]
    assert verify(client, OWNER, code).status_code == 200
    again = verify(client, OWNER, code)
    assert again.status_code == 401 and again.json()["detail"] == "Wrong or expired code"
    with SessionLocal() as db:
        assert db.get(OtpCode, OWNER) is None


def test_otp_wrong_code_then_right_code(client, outbox):
    request_code(client, OWNER)
    code = outbox[0]["code"]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(4):
        r = verify(client, OWNER, wrong)
        assert r.status_code == 401 and r.json()["detail"] == "Wrong or expired code"
    assert verify(client, OWNER, code).status_code == 200  # the fifth try may still be right


def test_otp_lockout_after_five_wrong_attempts(client, outbox):
    request_code(client, OWNER)
    code = outbox[0]["code"]
    wrong = "000000" if code != "000000" else "111111"
    assert [verify(client, OWNER, wrong).status_code for _ in range(5)] == [401] * 5
    locked = verify(client, OWNER, code)
    assert locked.status_code == 401 and locked.json()["detail"] == "Wrong or expired code"
    with SessionLocal() as db:
        assert db.get(OtpCode, OWNER) is None


def test_otp_expired_code(client, outbox):
    request_code(client, OWNER)
    with SessionLocal() as db:
        row = db.get(OtpCode, OWNER)
        assert timedelta(minutes=9) < row.expires_at - utcnow() <= timedelta(minutes=10)
        row.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    r = verify(client, OWNER, outbox[0]["code"])
    assert r.status_code == 401 and r.json()["detail"] == "Wrong or expired code"
    with SessionLocal() as db:
        assert db.get(OtpCode, OWNER) is None


def test_otp_new_request_replaces_old_code(client, outbox, monkeypatch):
    t = [1000.0]
    monkeypatch.setattr(ratelimit, "now", lambda: t[0])
    request_code(client, OWNER)
    t[0] += 61
    request_code(client, OWNER)
    old, new = outbox[0]["code"], outbox[1]["code"]
    if old != new:
        assert verify(client, OWNER, old).status_code == 401
    assert verify(client, OWNER, new).status_code == 200


def test_otp_request_for_unknown_email_sends_nothing(client, outbox):
    r = request_code(client, "stranger@example.com")
    assert r.status_code == 200 and r.json() == {"sent": True}
    assert outbox == []
    with SessionLocal() as db:
        assert db.scalars(select(OtpCode)).all() == []
    assert verify(client, "stranger@example.com", "123456").status_code == 401


def test_otp_request_malformed_email_422(client, outbox):
    for bad in ("", "nope", "a b@c.com", "a@", "@b.com"):
        assert request_code(client, bad).status_code == 422, bad
    assert client.post("/admin/otp/request", json={}).status_code == 422
    assert outbox == []


def test_otp_request_limit_one_per_minute_per_email(client, outbox, monkeypatch):
    t = [1000.0]
    monkeypatch.setattr(ratelimit, "now", lambda: t[0])
    assert request_code(client, OWNER).status_code == 200
    assert request_code(client, OWNER).status_code == 429
    assert request_code(client, "stranger@example.com").status_code == 200  # another email is not affected
    assert request_code(client, "stranger@example.com").status_code == 429  # same limit for a non-admin
    t[0] += 61
    assert request_code(client, OWNER).status_code == 200
    assert len(outbox) == 2


def test_otp_request_limit_five_per_hour_per_email(client, outbox, monkeypatch):
    t = [1000.0]
    monkeypatch.setattr(ratelimit, "now", lambda: t[0])
    codes = []
    for _ in range(6):
        codes.append(request_code(client, OWNER).status_code)
        t[0] += 61
    assert codes == [200] * 5 + [429] and len(outbox) == 5
    t[0] += 3600
    assert request_code(client, OWNER).status_code == 200


def test_otp_request_limit_ten_per_hour_per_ip(client, outbox, monkeypatch):
    t = [1000.0]
    monkeypatch.setattr(ratelimit, "now", lambda: t[0])
    codes = [request_code(client, f"person{i}@example.com").status_code for i in range(11)]
    assert codes == [200] * 10 + [429]
    t[0] += 3601
    assert request_code(client, "person99@example.com").status_code == 200


def test_otp_without_resend_key_creates_no_code(client, outbox, monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY")
    r = request_code(client, OWNER)
    assert r.status_code == 200 and r.json() == {"sent": True} and outbox == []
    with SessionLocal() as db:
        assert db.get(OtpCode, OWNER) is None


def test_otp_debug_logs_the_code_only_without_a_key(client, outbox, monkeypatch, caplog):
    monkeypatch.delenv("RESEND_API_KEY")
    monkeypatch.setenv("OTP_DEBUG", "1")
    with caplog.at_level(logging.WARNING, logger="wedding"):
        assert request_code(client, OWNER).status_code == 200
    assert outbox == []
    line = next(r.getMessage() for r in caplog.records if "OTP_DEBUG" in r.getMessage())
    code = line.rsplit(" ", 1)[1]
    assert len(code) == 6 and OWNER in line
    assert verify(client, OWNER, code).status_code == 200


def test_failed_email_still_answers_200_and_logs_no_secret(client, monkeypatch, caplog):
    seen = []

    def boom(to, subject, text, html_body):
        seen.append(text)
        raise urllib.error.HTTPError(mailer.RESEND_URL, 403, "Forbidden", None, None)

    monkeypatch.setenv("OTP_DEBUG", "1")  # must not log the code while a key is set
    monkeypatch.setattr(mailer, "send_email", boom)
    with caplog.at_level(logging.DEBUG):
        r = request_code(client, OWNER)
    assert r.status_code == 200 and r.json() == {"sent": True} and len(seen) == 1
    with SessionLocal() as db:
        assert db.get(OtpCode, OWNER) is not None
    lines = [rec.getMessage() for rec in caplog.records if rec.name == "wedding"]
    assert lines == ["Login code email was not sent: Resend answered HTTP 403"]
    logged = "\n".join(rec.getMessage() for rec in caplog.records)
    code = __import__("re").search(r"\b(\d{6})\b", seen[0]).group(1)
    assert code not in logged and "re_test_key_do_not_log" not in logged


def test_resend_request_shape(monkeypatch):
    """The real sender, with only the network call replaced."""
    got = {}

    class Res:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self): return b"{}"

    def fake_urlopen(req, timeout):
        got.update(url=req.full_url, method=req.get_method(), headers=dict(req.header_items()),
                   body=__import__("json").loads(req.data), timeout=timeout)
        return Res()

    monkeypatch.undo()  # drop the autouse outbox patch of send_email
    monkeypatch.setenv("RESEND_API_KEY", "re_abc")
    monkeypatch.delenv("EMAIL_FROM", raising=False)
    monkeypatch.setattr(mailer.urllib.request, "urlopen", fake_urlopen)
    mailer.deliver_otp("a@example.com", "A <b>", "123456")
    assert got["url"] == "https://api.resend.com/emails" and got["method"] == "POST"
    assert got["headers"]["Authorization"] == "Bearer re_abc"
    assert got["body"]["from"] == "Atif & Nargis <wedding@fullstackcity.in>"
    assert got["body"]["to"] == ["a@example.com"] and got["body"]["subject"]
    assert "123456" in got["body"]["text"] and "123456" in got["body"]["html"]
    assert "A &lt;b&gt;" in got["body"]["html"]


# ---- sessions ----
def test_inactive_admin_cannot_get_a_code_and_token_is_rejected(client, auth, make_admin, outbox):
    admin, a_auth = make_admin()
    assert client.get("/admin/guests", headers=a_auth).status_code == 200
    r = client.patch(f"/admin/admins/{admin['id']}", json={"active": False}, headers=auth)
    assert r.status_code == 200 and r.json()["active"] is False
    assert client.get("/admin/guests", headers=a_auth).status_code == 401
    assert client.get("/admin/me", headers=a_auth).status_code == 401
    reset_limits()
    n = len(outbox)
    assert request_code(client, admin["email"]).status_code == 200 and len(outbox) == n
    # activating again brings the same token back to life
    assert client.patch(f"/admin/admins/{admin['id']}", json={"active": True}, headers=auth).json()["active"] is True
    assert client.get("/admin/guests", headers=a_auth).status_code == 200


def test_deactivating_drops_a_pending_code(client, auth, make_admin, outbox):
    admin, _ = make_admin()
    reset_limits()
    request_code(client, admin["email"])
    code = outbox[-1]["code"]
    client.patch(f"/admin/admins/{admin['id']}", json={"active": False}, headers=auth)
    client.patch(f"/admin/admins/{admin['id']}", json={"active": True}, headers=auth)
    assert verify(client, admin["email"], code).status_code == 401


def test_deleted_admin_token_is_rejected(client, auth, make_admin, outbox):
    admin, a_auth = make_admin()
    assert client.delete(f"/admin/admins/{admin['id']}", headers=auth).status_code == 204
    assert client.get("/admin/guests", headers=a_auth).status_code == 401
    assert client.get("/admin/me", headers=a_auth).status_code == 401
    reset_limits()
    n = len(outbox)
    assert request_code(client, admin["email"]).status_code == 200 and len(outbox) == n
    assert client.delete(f"/admin/admins/{admin['id']}", headers=auth).status_code == 404


def test_old_style_token_is_rejected(client):
    import jwt
    token = jwt.encode({"sub": "admin"}, "test-secret-test-secret-test-secret-123456", algorithm="HS256")
    assert client.get("/admin/guests", headers=bearer(token)).status_code == 401


def test_password_login_is_the_owner(client, auth):
    r = client.post("/admin/login", json={"password": "secret-pass"})
    assert r.status_code == 200 and r.json()["admin"]["role"] == "owner"
    pw = bearer(r.json()["token"])
    assert client.get("/admin/me", headers=pw).json()["email"] == OWNER
    assert client.get("/admin/admins", headers=pw).status_code == 200
    g = client.post("/admin/guests", json={"name": "By password"}, headers=pw).json()
    assert g["addedBy"]["name"] == "Atif"
    assert client.get("/admin/me", headers=auth).json()["id"] == client.get("/admin/me", headers=pw).json()["id"]


# ---- managing admins ----
def test_admins_crud_by_owner(client, auth):
    r = client.post("/admin/admins", json={"name": " Bilal ", "email": " Bilal@Example.com ", "phone": "98111 11111"},
                    headers=auth)
    assert r.status_code == 201
    a = r.json()
    assert (a["name"], a["email"], a["phone"], a["role"], a["active"], a["guestCount"]) == \
        ("Bilal", "bilal@example.com", "919811111111", "admin", True, 0)
    assert client.post("/admin/admins", json={"name": "Dup", "email": "BILAL@example.com"}, headers=auth).status_code == 409
    assert client.post("/admin/admins", json={"name": "Dup", "email": OWNER}, headers=auth).status_code == 409
    assert client.post("/admin/admins", json={"name": "", "email": "x@example.com"}, headers=auth).status_code == 422
    assert client.post("/admin/admins", json={"name": "X", "email": "not-an-email"}, headers=auth).status_code == 422
    assert client.post("/admin/admins", json={"name": "X", "email": "x@nodot"}, headers=auth).status_code == 422
    # role cannot be chosen or changed
    c = client.post("/admin/admins", json={"name": "C", "email": "c@example.com", "role": "owner"}, headers=auth).json()
    assert c["role"] == "admin"
    p = client.patch(f"/admin/admins/{a['id']}", json={"name": "Bilal K", "phone": "", "role": "owner"}, headers=auth)
    assert p.status_code == 200 and (p.json()["name"], p.json()["phone"], p.json()["role"]) == ("Bilal K", "", "admin")
    assert client.patch("/admin/admins/nope", json={"name": "x"}, headers=auth).status_code == 404
    rows = client.get("/admin/admins", headers=auth).json()
    assert [(x["name"], x["role"]) for x in rows] == [("Atif", "owner"), ("Bilal K", "admin"), ("C", "admin")]
    assert all(set(x) == {"id", "name", "email", "phone", "role", "active", "createdAt", "guestCount"} for x in rows)


def test_owner_cannot_be_deleted_deactivated_or_demoted(client, auth):
    owner = client.get("/admin/me", headers=auth).json()
    assert client.delete(f"/admin/admins/{owner['id']}", headers=auth).status_code == 400
    assert client.patch(f"/admin/admins/{owner['id']}", json={"active": False}, headers=auth).status_code == 400
    r = client.patch(f"/admin/admins/{owner['id']}", json={"role": "admin", "name": "Atif M"}, headers=auth)
    assert r.status_code == 200 and r.json()["role"] == "owner" and r.json()["active"] is True
    assert client.get("/admin/me", headers=auth).json()["name"] == "Atif M"
    assert client.get("/admin/admins", headers=auth).status_code == 200


def test_owner_only_routes_are_403_for_an_admin(client, auth, make_admin):
    admin, a_auth = make_admin()
    me = client.get("/admin/me", headers=a_auth).json()
    assert me == {"id": admin["id"], "name": "Bilal", "email": "bilal@example.com", "phone": "919811111111", "role": "admin"}
    settings = client.get("/admin/settings", headers=a_auth)
    assert settings.status_code == 200 and len(settings.json()["events"]) == 3
    changed = settings.json()
    changed["couple"]["hashtag"] = "#Hacked"
    assert client.put("/admin/settings", json=changed, headers=a_auth).status_code == 403
    assert client.get("/admin/settings", headers=auth).json()["couple"]["hashtag"] == "#AtifWedsNargis"
    assert client.get("/admin/admins", headers=a_auth).status_code == 403
    assert client.post("/admin/admins", json={"name": "X", "email": "x@example.com"}, headers=a_auth).status_code == 403
    assert client.patch(f"/admin/admins/{admin['id']}", json={"name": "Me"}, headers=a_auth).status_code == 403
    owner_id = client.get("/admin/me", headers=auth).json()["id"]
    assert client.delete(f"/admin/admins/{owner_id}", headers=a_auth).status_code == 403
    assert client.delete(f"/admin/admins/{admin['id']}", headers=a_auth).status_code == 403
    assert len(client.get("/admin/admins", headers=auth).json()) == 2


# ---- per-admin guests ----
def test_admin_sees_edits_deletes_and_exports_only_own_guests(client, auth, make_admin):
    admin, a_auth = make_admin()
    theirs = client.post("/admin/guests", json={"name": "Owner guest", "phone": "9000000001"}, headers=auth).json()
    r = client.post("/admin/guests", json={"name": "Bilal guest", "phone": "9000000002"}, headers=a_auth)
    assert r.status_code == 201
    mine = r.json()
    assert "addedBy" not in mine
    with SessionLocal() as db:
        assert db.get(Guest, mine["id"]).added_by == admin["id"]

    listed = client.get("/admin/guests", headers=a_auth).json()
    assert [g["name"] for g in listed] == ["Bilal guest"] and "addedBy" not in listed[0]

    # another admin's guest does not exist for them
    assert client.patch(f"/admin/guests/{theirs['id']}", json={"name": "Stolen"}, headers=a_auth).status_code == 404
    assert client.patch(f"/admin/guests/{theirs['id']}", json={"sent": True}, headers=a_auth).status_code == 404
    assert client.delete(f"/admin/guests/{theirs['id']}", headers=a_auth).status_code == 404
    still = next(g for g in client.get("/admin/guests", headers=auth).json() if g["id"] == theirs["id"])
    assert still["name"] == "Owner guest" and still["sentAt"] is None

    # their own guest: edit, replies, export
    assert client.patch(f"/admin/guests/{mine['id']}", json={"name": "Bilal guest 2"}, headers=a_auth).json()["name"] == "Bilal guest 2"
    client.post(f"/public/invite/{mine['code']}/rsvp", json={"attending": {"barat": True}, "headcount": 2})
    client.post(f"/public/invite/{theirs['code']}/rsvp", json={"attending": {"barat": True}, "headcount": 7})
    listed = client.get("/admin/guests", headers=a_auth).json()
    assert len(listed) == 1 and listed[0]["rsvp"]["headcount"] == 2
    rows = list(csv.reader(io.StringIO(client.get("/admin/export.csv", headers=a_auth).text)))
    assert "added by" not in rows[0] and [r[0] for r in rows[1:]] == ["Bilal guest 2"]
    assert "Owner guest" not in client.get("/admin/export.csv", headers=a_auth).text

    # the owner sees both, each with who added it, and can edit the admin's guest
    owner_rows = client.get("/admin/guests", headers=auth).json()
    assert {g["name"]: g["addedBy"] for g in owner_rows} == {
        "Owner guest": {"id": client.get("/admin/me", headers=auth).json()["id"], "name": "Atif"},
        "Bilal guest 2": {"id": admin["id"], "name": "Bilal"}}
    rows = list(csv.reader(io.StringIO(client.get("/admin/export.csv", headers=auth).text)))
    assert rows[0][-1] == "added by" and {r[0]: r[-1] for r in rows[1:]} == {"Owner guest": "Atif", "Bilal guest 2": "Bilal"}
    assert client.patch(f"/admin/guests/{mine['id']}", json={"party": "single"}, headers=auth).json()["addedBy"]["name"] == "Bilal"
    counts = {a["name"]: a["guestCount"] for a in client.get("/admin/admins", headers=auth).json()}
    assert counts == {"Atif": 1, "Bilal": 1}

    assert client.delete(f"/admin/guests/{mine['id']}", headers=a_auth).status_code == 204
    assert client.get("/admin/guests", headers=a_auth).json() == []
    assert [g["name"] for g in client.get("/admin/guests", headers=auth).json()] == ["Owner guest"]


def test_two_admins_are_isolated_from_each_other(client, make_admin):
    _, a = make_admin("Bilal", "bilal@example.com")
    _, b = make_admin("Sara", "sara@example.com")
    ga = client.post("/admin/guests", json={"name": "A1"}, headers=a).json()
    client.post("/admin/guests", json={"name": "B1"}, headers=b)
    assert [g["name"] for g in client.get("/admin/guests", headers=a).json()] == ["A1"]
    assert [g["name"] for g in client.get("/admin/guests", headers=b).json()] == ["B1"]
    assert client.patch(f"/admin/guests/{ga['id']}", json={"name": "x"}, headers=b).status_code == 404
    assert client.delete(f"/admin/guests/{ga['id']}", headers=b).status_code == 404


def test_bulk_by_admin_sets_added_by_and_does_not_reveal_other_phones(client, auth, make_admin):
    admin, a_auth = make_admin()
    client.post("/admin/guests", json={"name": "Owner guest", "phone": "9000000001"}, headers=auth)
    r = client.post("/admin/guests/bulk", headers=a_auth, json={"guests": [
        {"name": "Same phone as the owner's guest", "phone": "9000000001"},
        {"name": "New", "phone": "9000000002"}, {"name": "Dup in batch", "phone": "9000000002"}]}).json()
    assert r["added"] == 2 and r["skipped"] == 1
    assert all("addedBy" not in g for g in r["guests"])
    with SessionLocal() as db:
        assert {db.get(Guest, g["id"]).added_by for g in r["guests"]} == {admin["id"]}
    # the owner sees every phone, so the owner's import skips it
    r = client.post("/admin/guests/bulk", headers=auth, json={"guests": [{"name": "Again", "phone": "9000000002"}]}).json()
    assert r["added"] == 0 and r["skipped"] == 1


def test_deleting_an_admin_moves_their_guests_to_the_owner(client, auth, make_admin):
    admin, a_auth = make_admin()
    g = client.post("/admin/guests", json={"name": "Bilal guest"}, headers=a_auth).json()
    client.post(f"/public/invite/{g['code']}/rsvp", json={"attending": {"walima": True}})
    assert client.delete(f"/admin/admins/{admin['id']}", headers=auth).status_code == 204
    owner = client.get("/admin/me", headers=auth).json()
    rows = client.get("/admin/guests", headers=auth).json()
    assert len(rows) == 1 and rows[0]["addedBy"] == {"id": owner["id"], "name": "Atif"}
    assert rows[0]["rsvp"]["attending"] == {"walima": True}
    assert client.get(f"/public/invite/{g['code']}").status_code == 200  # the link still works
    admins = client.get("/admin/admins", headers=auth).json()
    assert [(a["name"], a["guestCount"]) for a in admins] == [("Atif", 1)]
    # the email is free again
    assert client.post("/admin/admins", json={"name": "Bilal", "email": "bilal@example.com"}, headers=auth).status_code == 201

import csv
import io

import bcrypt


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


# ---- auth ----
def test_login_success_and_failure(client):
    ok = client.post("/admin/login", json={"password": "secret-pass"})
    assert ok.status_code == 200 and ok.json()["token"] and ok.json()["expiresIn"] == 43200 * 60
    assert client.post("/admin/login", json={"password": "nope"}).status_code == 401


def test_admin_routes_require_token(client):
    for method, path in [("get", "/admin/settings"), ("put", "/admin/settings"),
                         ("get", "/admin/guests"), ("post", "/admin/guests"),
                         ("post", "/admin/guests/bulk"), ("patch", "/admin/guests/x"),
                         ("delete", "/admin/guests/x"), ("get", "/admin/export.csv"),
                         ("get", "/admin/me"), ("get", "/admin/admins"), ("post", "/admin/admins"),
                         ("patch", "/admin/admins/x"), ("delete", "/admin/admins/x")]:
        assert getattr(client, method)(path).status_code == 401, (method, path)
    bad = {"Authorization": "Bearer garbage"}
    assert client.get("/admin/guests", headers=bad).status_code == 401


def test_no_password_configured_always_fails(client, monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD")
    assert client.post("/admin/login", json={"password": ""}).status_code == 401
    assert client.post("/admin/login", json={"password": "anything"}).status_code == 401


def test_bcrypt_hash_login(client, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", bcrypt.hashpw(b"hashed-pw", bcrypt.gensalt(4)).decode())
    monkeypatch.delenv("ADMIN_PASSWORD")
    assert client.post("/admin/login", json={"password": "hashed-pw"}).status_code == 200
    assert client.post("/admin/login", json={"password": "secret-pass"}).status_code == 401


def test_login_rate_limit(client):
    codes = [client.post("/admin/login", json={"password": "x"}).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429


# ---- settings ----
def test_settings_seed_update_validation(client, auth):
    s = client.get("/admin/settings", headers=auth).json()
    assert s["countdownEvent"] == "walima" and len(s["events"]) == 3
    s["couple"]["hashtag"] = "#New"
    r = client.put("/admin/settings", json=s, headers=auth)
    assert r.status_code == 200 and r.json()["couple"]["hashtag"] == "#New"
    assert client.get("/admin/settings", headers=auth).json()["couple"]["hashtag"] == "#New"

    def bad(mutate):
        t = client.get("/admin/settings", headers=auth).json()
        mutate(t)
        return client.put("/admin/settings", json=t, headers=auth).status_code

    assert bad(lambda t: t["events"][0].update(date="16-10-2027")) == 422
    assert bad(lambda t: t["events"][0].update(date="2027-02-30")) == 422
    assert bad(lambda t: t["events"][0].update(time="9am")) == 422
    assert bad(lambda t: t["events"][0].update(group="friends")) == 422
    assert bad(lambda t: t["events"][1].update(key="barat")) == 422
    assert bad(lambda t: t.update(countdownEvent="missing")) == 422
    assert client.get("/admin/settings", headers=auth).json()["couple"]["hashtag"] == "#New"


# ---- guests ----
def test_guest_create_defaults_and_phone(client, auth):
    g = client.post("/admin/guests", json={"name": " Ali "}, headers=auth).json()
    assert g["name"] == "Ali" and g["party"] == "family" and g["invited"] == ["barat", "walima"]
    assert len(g["code"]) == 10 and set(g["code"]) <= set("abcdefghjkmnpqrstuvwxyz23456789")
    assert g["rsvp"] is None and g["sentAt"] is None
    p = client.post("/admin/guests", json={"name": "B", "phone": "+91 98765-43210"}, headers=auth).json()
    assert p["phone"] == "919876543210"
    q = client.post("/admin/guests", json={"name": "C", "phone": "9876543211"}, headers=auth).json()
    assert q["phone"] == "919876543211"
    assert client.post("/admin/guests", json={"name": "D", "invited": []}, headers=auth).status_code == 422


def test_guest_bulk_dedupes_by_phone(client, auth):
    client.post("/admin/guests", json={"name": "Existing", "phone": "9876543210"}, headers=auth)
    r = client.post("/admin/guests/bulk", headers=auth, json={"guests": [
        {"name": "Dup existing", "phone": "919876543210"},
        {"name": "New1", "phone": "9000000001"},
        {"name": "Dup in batch", "phone": "919000000001"},
        {"name": "No phone 1"}, {"name": "No phone 2"},
    ]}).json()
    assert r["added"] == 3 and r["skipped"] == 2 and len(r["guests"]) == 3
    assert len({g["code"] for g in r["guests"]}) == 3
    assert len(client.get("/admin/guests", headers=auth).json()) == 4


def test_guest_list_newest_first(client, auth):
    for n in ("one", "two", "three"):
        client.post("/admin/guests", json={"name": n}, headers=auth)
    names = [g["name"] for g in client.get("/admin/guests", headers=auth).json()]
    assert names[0] == "three" and names[-1] == "one"


def test_guest_patch(client, auth, guest):
    gid = guest["id"]
    r = client.patch(f"/admin/guests/{gid}", json={"name": "Z", "party": "single", "invited": ["walima"]},
                     headers=auth).json()
    assert (r["name"], r["party"], r["invited"]) == ("Z", "single", ["walima"])
    assert client.patch(f"/admin/guests/{gid}", json={"sent": True}, headers=auth).json()["sentAt"]
    assert client.patch(f"/admin/guests/{gid}", json={"sent": False}, headers=auth).json()["sentAt"] is None
    assert client.patch(f"/admin/guests/{gid}", json={"phone": "123"}, headers=auth).json()["phone"] == "123"
    assert client.patch("/admin/guests/nope", json={"name": "x"}, headers=auth).status_code == 404


def test_guest_delete_removes_rsvp(client, auth, guest):
    client.post(f"/public/invite/{guest['code']}/rsvp", json={"attending": {"barat": True}})
    assert client.delete(f"/admin/guests/{guest['id']}", headers=auth).status_code == 204
    assert client.get("/admin/guests", headers=auth).json() == []
    assert client.get(f"/public/invite/{guest['code']}").status_code == 404
    assert client.delete(f"/admin/guests/{guest['id']}", headers=auth).status_code == 404


# ---- public ----
def test_public_invite_filters_events_and_sets_opened_once(client, auth):
    g = client.post("/admin/guests", json={"name": "W", "invited": ["walima"]}, headers=auth).json()
    s = client.get("/admin/settings", headers=auth).json()
    s["events"].append({**s["events"][2], "key": "extra", "name": "Extra", "enabled": False})
    assert client.put("/admin/settings", json=s, headers=auth).status_code == 200
    assert g["openedAt"] is None
    inv = client.get(f"/public/invite/{g['code']}").json()
    assert [e["key"] for e in inv["settings"]["events"]] == ["walima"]
    assert inv["guest"] == {"name": "W", "party": "family", "invited": ["walima"]}
    assert inv["rsvp"] is None
    first = next(x for x in client.get("/admin/guests", headers=auth).json())["openedAt"]
    assert first
    client.get(f"/public/invite/{g['code']}")
    assert client.get("/admin/guests", headers=auth).json()[0]["openedAt"] == first


def test_public_invite_leaks_nothing(client, guest):
    inv = client.get(f"/public/invite/{guest['code']}").json()
    text = str(inv)
    assert "phone" not in text and guest["id"] not in text and "9876543210" not in text
    assert set(inv["guest"]) == {"name", "party", "invited"}


def test_unknown_code_404(client):
    assert client.get("/public/invite/zzzzzzzzzz").status_code == 404
    assert client.post("/public/invite/zzzzzzzzzz/rsvp", json={"attending": {}}).status_code == 404


def test_rsvp_upsert_and_validation(client, auth):
    g = client.post("/admin/guests", json={"name": "R", "invited": ["barat"]}, headers=auth).json()
    url = f"/public/invite/{g['code']}/rsvp"
    r = client.post(url, json={"attending": {"barat": True}, "headcount": 4, "message": "hi"})
    assert r.status_code == 200 and r.json()["headcount"] == 4 and r.json()["attending"] == {"barat": True}
    r = client.post(url, json={"attending": {"barat": False}})
    assert r.json()["headcount"] == 1 and r.json()["message"] == ""
    assert client.get(f"/public/invite/{g['code']}").json()["rsvp"]["attending"] == {"barat": False}
    assert client.post(url, json={"attending": {"walima": True}}).status_code == 422
    assert client.post(url, json={"attending": {"barat": True}, "headcount": 0}).status_code == 422
    assert client.post(url, json={"attending": {"barat": True}, "headcount": 51}).status_code == 422
    assert client.post(url, json={"attending": {"barat": True}, "headcount": 50}).status_code == 200
    assert client.post(url, json={"attending": {"barat": True}, "message": "x" * 501}).status_code == 422
    rows = client.get("/admin/guests", headers=auth).json()
    assert rows[0]["rsvp"]["headcount"] == 50


def test_public_rate_limit(client):
    codes = [client.get("/public/invite/zzzzzzzzzz").status_code for _ in range(61)]
    assert codes[59] == 404 and codes[60] == 429


# ---- csv ----
def test_csv_export(client, auth):
    g = client.post("/admin/guests", json={"name": "=HYPERLINK(\"x\")", "phone": "9876543210"},
                    headers=auth).json()
    client.post(f"/public/invite/{g['code']}/rsvp",
                json={"attending": {"barat": True, "walima": False}, "headcount": 3, "message": "+cmd, \"q\""})
    r = client.get("/admin/export.csv", headers=auth)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(r.text)))
    assert rows[0] == ["name", "phone", "party", "invited", "link code", "sent", "opened",
                       "attending barat", "attending walima", "headcount", "message", "rsvp time", "added by"]
    row = dict(zip(rows[0], rows[1]))
    assert row["name"] == "'=HYPERLINK(\"x\")"
    assert row["message"] == "'+cmd, \"q\""
    assert row["attending barat"] == "yes" and row["attending walima"] == "no"
    assert row["added by"] == "Atif"
    assert row["headcount"] == "3" and row["link code"] == g["code"] and row["phone"] == "919876543210"

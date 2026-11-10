# Wedding invite API

FastAPI + SQLAlchemy 2 (sync). SQLite locally, Postgres in production. Contract: `../docs/SPEC.md`.

## Run locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # optional; export the vars yourself, the app does not load .env
ADMIN_PASSWORD=changeme ALLOWED_ORIGINS=http://localhost:5173 \
  .venv/bin/uvicorn app.main:app --reload --port 8004
```

Tables (`wedding_settings`, `wedding_guests`, `wedding_rsvps`) are created on startup and settings are seeded when empty.

Production: `uvicorn app.main:app --host 127.0.0.1 --port 8004 --proxy-headers --root-path /wedding`

## Tests

```bash
.venv/bin/python -m pytest -q
```

## Environment variables

| Var | Notes |
|---|---|
| `DATABASE_URL` | default `sqlite:///./wedding.db`; `postgres://` and `postgresql://` accepted |
| `ADMIN_PASSWORD_HASH` | bcrypt hash (preferred). Takes precedence over `ADMIN_PASSWORD` |
| `ADMIN_PASSWORD` | plain, local use only. If neither is set, admin login always returns 401 |
| `JWT_SECRET` | random one is generated at startup if unset (tokens die on restart) |
| `JWT_EXPIRE_MINUTES` | default 43200 |
| `ALLOWED_ORIGINS` | comma separated CORS origins |

## Generate ADMIN_PASSWORD_HASH

```bash
.venv/bin/python -c "import bcrypt,getpass; print(bcrypt.hashpw(getpass.getpass().encode(), bcrypt.gensalt()).decode())"
```

Bcrypt hashes contain `$`; single-quote the value in shells and `.env` files.

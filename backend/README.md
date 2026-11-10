# Wedding invite API

FastAPI + SQLAlchemy 2 (sync). SQLite locally, Postgres in production. Contract: `../docs/SPEC.md`.

## Run locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # optional; export the vars yourself, the app does not load .env
OWNER_EMAIL=you@example.com OTP_DEBUG=1 ALLOWED_ORIGINS=http://localhost:5173 \
  .venv/bin/uvicorn app.main:app --reload --port 8004
```

Tables (`wedding_settings`, `wedding_admins`, `wedding_otp_codes`, `wedding_guests`, `wedding_rsvps`) are created on startup;
settings are seeded when empty and the owner admin is created if missing. There is no migration tool: `create_all` does not
alter existing tables, so a database made by an older version has to be dropped (or altered by hand) first.

## Admin login

Admins log in with their email and a 6-digit code (valid 10 minutes, single use, 5 wrong tries). The owner comes from
`OWNER_EMAIL`; the owner adds the other admins in the panel. An `admin` sees only the guests they added; the owner sees all.

- Production: set `RESEND_API_KEY` (and a verified sender in `EMAIL_FROM`); codes are emailed through Resend.
- Local: leave the key empty and set `OTP_DEBUG=1`; the code is printed in the server log as
  `OTP_DEBUG login code for <email>: <code>`. Never set `OTP_DEBUG` in production.
- Neither set: asking for a code still answers 200 but no code exists, so only the password fallback can log in.
- `POST /admin/login` (password) still works when `ADMIN_PASSWORD_HASH` or `ADMIN_PASSWORD` is set and logs in as the owner.
- Changing `OWNER_EMAIL` later moves the existing owner record to the new address (there is never a second owner).

Production: `uvicorn app.main:app --host 127.0.0.1 --port 8004 --proxy-headers --root-path /wedding`

## Tests

```bash
.venv/bin/python -m pytest -q
```

## Environment variables

| Var | Notes |
|---|---|
| `DATABASE_URL` | default `sqlite:///./wedding.db`; `postgres://` and `postgresql://` accepted |
| `OWNER_EMAIL` | email of the owner admin, created at startup. Unset: `owner@localhost` (password login only) |
| `OWNER_NAME` | owner's display name when the record is created (default `Owner`) |
| `RESEND_API_KEY` | Resend key used to email login codes. Unset: no codes are created (see `OTP_DEBUG`) |
| `EMAIL_FROM` | sender, default `Atif & Nargis <wedding@fullstackcity.in>` (the domain must be verified in Resend) |
| `OTP_DEBUG` | `1` + no `RESEND_API_KEY`: print login codes to the server log. Local use only |
| `ADMIN_PASSWORD_HASH` | optional owner password fallback, bcrypt hash (preferred). Takes precedence over `ADMIN_PASSWORD` |
| `ADMIN_PASSWORD` | plain, local use only. If neither is set, password login always returns 401 |
| `JWT_SECRET` | random one is generated at startup if unset (tokens die on restart) |
| `JWT_EXPIRE_MINUTES` | default 43200 |
| `ALLOWED_ORIGINS` | comma separated CORS origins |

## Generate ADMIN_PASSWORD_HASH

```bash
.venv/bin/python -c "import bcrypt,getpass; print(bcrypt.hashpw(getpass.getpass().encode(), bcrypt.gensalt()).decode())"
```

Bcrypt hashes contain `$`; single-quote the value in shells and `.env` files.

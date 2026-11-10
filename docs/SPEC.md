# Wedding invite v2: backend + React

Goal: the host manages everything from an admin panel and changes show up on guests' invites without a redeploy.
Guests, event details and RSVPs live in a database behind a small API. The Google Sheet and the signed-link scheme go away.

## Repo layout

```
WdWeb/
  backend/      FastAPI app (deployed inside the shared Render service in ../infra, under /wedding)
  frontend/     React + Vite app (deployed on Vercel): "/" is the invite, "/admin" is the host panel
  docs/SPEC.md  this file
```

The current plain-JS site at the repo root is the visual reference for the React port and is removed once the port is done.

## Data

**settings** (one row, JSON):

```json
{
  "couple": { "groom": "Atif", "groomFull": "Atif Moin", "groomParents": "S/o Late Mr. Moinul Hayat Khan & Mrs. Darakhshan Begum",
              "bride": "Nargis", "brideFull": "Nargis Siddiqui", "brideParents": "D/o Mr. Amanullah Siddiqui & Mrs. Shakeela Bano",
              "hosts": "Mrs. Darakhshan Begum & Family", "hashtag": "#AtifWedsNargis" },
  "contact": { "whatsapp": "917007136187" },
  "timingsTentative": true,
  "countdownEvent": "walima",
  "events": [
    { "key": "barat",  "group": "barat",  "name": "Barat",          "ur": "بارات",        "date": "2027-10-16", "time": "10:00", "timeLabel": "Departure around 10:00 AM", "venue": "Bhitari", "addr": "Saidpur, Ghazipur", "map": "", "enabled": true },
    { "key": "nikah",  "group": "barat",  "name": "Nikah",          "ur": "نکاح",         "date": "2027-10-16", "time": "14:30", "timeLabel": "Around 2 to 3 PM",          "venue": "Bhitari", "addr": "Saidpur, Ghazipur", "map": "", "enabled": true },
    { "key": "walima", "group": "walima", "name": "Dawat-e-Walima", "ur": "دعوتِ ولیمہ", "date": "2027-10-18", "time": "19:00", "timeLabel": "Around 7:00 PM",            "venue": "Hotel Giriraj", "addr": "Basti, Uttar Pradesh", "map": "", "enabled": true }
  ]
}
```

- `date` + `time` are local Indian time (+05:30). `timeLabel` is the text shown to guests; `time` drives the countdown and calendar.
- `group` is what a guest is invited to. There are exactly two groups: `barat` (Barat and Nikah, same day) and `walima`.
- These values are the seed used when the table is empty.

**guest**: `id` (uuid), `code` (10 chars from `abcdefghjkmnpqrstuvwxyz23456789`, unique, random), `name` (as printed on the card),
`phone` (digits with country code, may be empty), `party` (`"single"` | `"family"`), `invited` (subset of `["barat","walima"]`, at least one),
`sent_at`, `opened_at`, `created_at`.

**rsvp** (at most one per guest, upsert): `attending` (object: group -> true/false, only for groups the guest is invited to),
`headcount` (int 1..50, default 1; only meaningful when party is `family`), `message` (<= 500 chars), `updated_at`.

## API

JSON everywhere. Errors: `{ "detail": "..." }` with a proper status code. Paths below are what the app serves; in production
Caddy mounts the app at `/wedding` and strips that prefix.

Public (no auth):

| Method | Path | Result |
|---|---|---|
| GET | `/health` | `{ "status": "ok" }` |
| GET | `/public/invite/{code}` | `{ "guest": { "name", "party", "invited" }, "settings": { ...settings, "events": [only enabled events whose group is in guest.invited] }, "rsvp": {...} or null }`. 404 for an unknown code. First call sets `opened_at`. |
| POST | `/public/invite/{code}/rsvp` | body `{ "attending": { "barat": true, "walima": false }, "headcount": 4, "message": "..." }` -> the stored rsvp. 404 unknown code, 422 if attending has a group the guest is not invited to. |

Never return phone numbers, ids or other guests' data from public routes. Rate limit public routes per IP (in-memory is fine: 60 requests / minute).

Admin (header `Authorization: Bearer <token>`; 401 otherwise):

| Method | Path | Result |
|---|---|---|
| POST | `/admin/login` | body `{ "password" }` -> `{ "token", "expiresIn" }`. 401 on a wrong password. Limit to 10 attempts / 15 min per IP. |
| GET | `/admin/settings` | settings |
| PUT | `/admin/settings` | body = full settings, validated -> settings |
| GET | `/admin/guests` | `[{ id, code, name, phone, party, invited, sentAt, openedAt, createdAt, rsvp }]`, newest first |
| POST | `/admin/guests` | body `{ name, phone?, party?, invited? }` (defaults: `family`, both groups) -> guest |
| POST | `/admin/guests/bulk` | body `{ "guests": [{ name, phone?, party?, invited? }] }` -> `{ "added": n, "skipped": n, "guests": [...] }`. Skip entries whose phone already exists. |
| PATCH | `/admin/guests/{id}` | any of `name, phone, party, invited, sent` (`sent: true` stamps `sent_at`, `false` clears it) -> guest |
| DELETE | `/admin/guests/{id}` | 204; removes its rsvp too |
| GET | `/admin/export.csv` | CSV download: name, phone, party, invited, link code, sent, opened, attending barat, attending walima, headcount, message, rsvp time |

API responses use camelCase keys.

## Backend constraints

- Python 3.12, FastAPI, uvicorn, SQLAlchemy 2 (sync) with psycopg for Postgres. Keep dependencies and memory small: the Render box has 512 MB shared with three other apps.
- Env vars: `DATABASE_URL` (default `sqlite:///./wedding.db` for local use; accept `postgres://` and `postgresql://` URLs),
  `ADMIN_PASSWORD_HASH` (bcrypt) or `ADMIN_PASSWORD` (plain, for local use only), `JWT_SECRET`, `JWT_EXPIRE_MINUTES` (default 43200),
  `ALLOWED_ORIGINS` (comma separated, for CORS).
- Tables are created on startup if missing (no migration tool needed at this size). Use a `wedding_` table prefix so the app can share a database.
- Started in production as `uvicorn app.main:app --host 127.0.0.1 --port 8004 --proxy-headers --root-path /wedding`.
- Client IP for rate limits comes from the proxy headers uvicorn already resolves (`request.client.host`).

## Frontend behaviour

- Guest link: `https://atifwedsnargis.fullstackcity.in/?g=<code>`. Without a valid code the site shows the "Private invitation" screen.
- The API can take 30 to 60 s to wake up. While waiting, show the envelope with "Opening your invitation…". Cache the last good
  response in localStorage and render from it immediately on later visits, then refresh in the background and re-check every 60 s
  while the page is open, so admin changes appear without a reload.
- Envelope and card print the guest's name; a `family` guest reads "<name> & Family" only if the host typed it that way (the name is used as is).
  `family` guests get a headcount field in the RSVP.
- A guest sees only the events of the groups they are invited to: event cards, countdown, scratch card, calendar buttons and the PDF card.
- When `timingsTentative` is true, show `timeLabel` and a short "Timings are tentative and will be confirmed" note.
- RSVP: one yes/no per invited group, name is not asked (the guest is known), optional message, headcount for families. Saved to the API.
- `/admin`: password login, then tabs: Guests (add, import from phone contacts or .vcf, edit name/party/invited, send on WhatsApp, copy link,
  status chips for sent / opened / replied), Event details (edit settings), Replies (totals per group, headcount, messages, CSV download).
- API base URL comes from `VITE_API_BASE_URL`.

## Admins and OTP login (v2.1)

Several people can use the admin panel. They log in with their email and a 6-digit code sent by email.

**admin** (`wedding_admins`): `id` (uuid), `name`, `email` (unique, stored lower-case), `phone` (digits, optional), `role` (`"owner"` | `"admin"`),
`active` (bool), `created_at`. Guests get `added_by` (admin id, nullable).

- The owner is created on startup from env `OWNER_EMAIL` (and optional `OWNER_NAME`) if no admin with that email exists. There is always exactly one way
  to be owner: that record. The owner cannot be deleted, deactivated or demoted through the API.
- Roles:
  - `owner`: everything. Sees all guests (each with `addedBy: { id, name }`), edits settings, manages admins.
  - `admin`: only guests they added themselves (list, create, bulk, patch, delete, export, replies). Guests they create get `added_by` = their id.
    Touching another admin's guest returns 404. `GET /admin/settings` is allowed (the panel needs event names); `PUT /admin/settings` and all
    `/admin/admins` routes return 403.

**OTP**: 6 digits from `secrets`, stored only as an HMAC-SHA256 with `JWT_SECRET`, valid 10 minutes, single use, at most 5 wrong attempts per code,
a new request replaces the old code. Request limits per email: 1 per 60 s and 5 per hour; per IP: 10 per hour.

| Method | Path | Result |
|---|---|---|
| POST | `/admin/otp/request` | body `{ "email" }` -> always `200 { "sent": true }` for a well-formed email, whether or not it belongs to an admin (no account enumeration). A code is emailed only to an active admin. 429 when rate limited. |
| POST | `/admin/otp/verify` | body `{ "email", "code" }` -> `{ "token", "expiresIn", "admin": { "id", "name", "email", "role" } }`. 401 for a wrong, expired or used code (same message for all). |
| GET | `/admin/me` | the logged-in admin `{ id, name, email, phone, role }` |
| GET | `/admin/admins` | owner only: all admins with `guestCount` |
| POST | `/admin/admins` | owner only: body `{ name, email, phone? }` -> admin (role `admin`). 409 if the email exists. |
| PATCH | `/admin/admins/{id}` | owner only: any of `name, phone, active`. |
| DELETE | `/admin/admins/{id}` | owner only: 204. Their guests stay and become the owner's (`added_by` = owner id). |

- The JWT carries the admin id. Every admin route loads the admin and rejects (401) a missing, deleted or inactive one, so removing an admin ends their session.
- `POST /admin/login` (password) stays as an owner-only fallback: it works only when `ADMIN_PASSWORD_HASH`/`ADMIN_PASSWORD` is set and logs in as the owner record.
  If `OWNER_EMAIL` is unset, the owner record is created with the email `owner@localhost` so password login still works locally.
- Email is sent through Resend: `POST https://api.resend.com/emails` with `Authorization: Bearer $RESEND_API_KEY`, JSON `{ from, to: [email], subject, text, html }`.
  New env vars: `RESEND_API_KEY`, `EMAIL_FROM` (default `Atif & Nargis <wedding@fullstackcity.in>`), `OWNER_EMAIL`, `OWNER_NAME`, `OTP_DEBUG`.
  When `RESEND_API_KEY` is unset: if `OTP_DEBUG=1` the code is printed to the server log (local use), otherwise no code is created and the request still answers 200.
  Never log the code otherwise, and never return it in a response.
- CSV export gains an "added by" column for the owner.

Admin panel: login screen asks for email, then the code ("Resend code" after 60 s), with a small "Use password instead" link. The owner gets an
**Admins** tab (add by name, email, phone; deactivate; remove) and sees who added each guest. Other admins do not see the Event details or Admins tabs.

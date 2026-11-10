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

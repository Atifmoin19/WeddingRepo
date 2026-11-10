# Walima invitation

One-page wedding invitation: envelope intro, ayat, monogram, families, scratch-to-reveal date, countdown, events, favour box, RSVP, closing dua.

## Run

    npm install
    npm run dev      # local preview
    npm run build    # production build in dist/

## Edit

All names, dates, venues, phone number and music are in `src/config.js`.

- Music: put an mp3 in `public/audio/` and set `music` in the config.
- RSVP: set `whatsapp` to the number that should receive replies.

## Invite-only access

With `requireInvite: true` in `src/config.js`, the site opens only from a personal link. Each link carries the guest's
name and a signature. The name is printed on the envelope, the RSVP form and the downloadable card.

Make links in either place:

- **Admin page:** open `/admin.html` (or tap the bottom-left corner of the site five times). Unlock it with the
  passphrase in `.admin-passphrase.txt`. Add guests from your phone contacts, a `.vcf` file or by hand, then send each
  link on WhatsApp. The guest list is stored in that browser only.
- **Command line:** `npm run invite -- "Khan Sahab & Family" 9876543210`, or `npm run invite -- guests.csv`
  (lines of `name,phone`) which writes `guest-links.csv`.

Keep `.invite-key.json` and `.admin-passphrase.txt` backed up and private. They are not in git. Anyone holding them can
create links; if they are lost, new links need a new key, which makes every old link stop working.

A personal link can be forwarded, and whoever opens it gets in under that guest's name.

To preview locally without a link: `http://localhost:5173/?preview`.

## Record RSVPs in a Google Sheet

1. Create a new Google Sheet.
2. In the sheet: Extensions > Apps Script. Delete what is there and paste `google-sheet/Code.gs`.
3. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone. Deploy and allow access.
4. Copy the web app URL (ends in `/exec`) into `sheetUrl` in `src/config.js`.

A guest taps "InshaAllah, Yes", enters their name (required) and an optional message, and taps "Confirm my presence". That adds a row: time, name, message, and the name on their invite link. "Can't make it" replies are sent on WhatsApp only.

## Before sharing with guests

The files in `public/images/` (frames, couple, envelope, seal) are placeholder art taken from a reference site.
Replace them with your own artwork, keeping the same file names and sizes, before publishing.
The share preview image is `public/og.jpg` (1200x630). Its names and date are baked into the picture, and the share title and description are in the `<head>` of `index.html`; update both if details change.

## Deploy

Any static host works. On Vercel: import the folder, framework "Vite", no settings needed.

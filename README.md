# Walima invitation

One-page wedding invitation: envelope intro, ayat, monogram, families, scratch-to-reveal date, countdown, events, favour box, RSVP, closing dua.

## Run

    npm install
    npm run dev      # local preview
    npm run build    # production build in dist/

## Edit

All names, dates, venues, phone number and music are in `src/config.js`.

- Per-guest link: add `?to=Guest%20Name` to the address to print that name on the envelope.
- Music: put an mp3 in `public/audio/` and set `music` in the config.
- RSVP: set `whatsapp` to the number that should receive replies.

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

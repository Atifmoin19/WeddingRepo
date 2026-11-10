// Every wedding-specific value lives here. Edit this file only; the rest of the site reads from it.
export const CONFIG = {
  groom: "Atif",
  groomFull: "Atif Moin",
  groomParents: "S/o Late Mr. Moinul Hayat Khan & Mrs. Darakhshan Begum",
  bride: "Nargis",
  brideFull: "Nargis Siddiqui",
  brideParents: "D/o Mr. Amanullah Siddiqui & Mrs. Shakeela Bano",
  hosts: "Mrs. Darakhshan Begum & Family",

  // Name shown on the envelope. A link like https://your-site/?to=Khan%20Sahab overrides it per guest.
  guest: new URLSearchParams(location.search).get("to") || "Family & Friends",

  hashtag: "#AtifWedsNargis",
  whatsapp: "917007136187", // RSVP number with country code (91 = India).
  // Google Sheet recording for "yes" replies: paste the Apps Script web app URL here (steps in README). Empty = not recorded.
  sheetUrl: "https://script.google.com/macros/s/AKfycbyxz-vY3LMr3xybT1BdRsvPtnIoCriNpJ30tkYv8QYWvNynLkIL6fsHn7nqZk4z2pL_uA/exec",
  music: "",               // e.g. "/audio/nasheed.mp3" (put the file in public/audio). Empty = no music button.
  siteUrl: "",             // final site address, used by the Share button. Empty = current address.

  // The countdown and the scratch card use this moment. TODO: confirm the year.
  countdownTo: "2027-10-17T19:00:00+05:30",

  // Set on:false to hide an event.
  events: [
    { on: true, name: "Barat", ur: "بارات", when: "2027-10-16T10:00:00+05:30", venue: "Bhitari", addr: "Saidpur, Ghazipur", map: "https://maps.google.com/?q=Bhitari+Saidpur+Ghazipur" },
    { on: true, name: "Dawat-e-Walima", ur: "دعوتِ ولیمہ", when: "2027-10-17T19:00:00+05:30", venue: "Hotel Giriraj", addr: "Basti, Uttar Pradesh", map: "https://maps.google.com/?q=Hotel+Giriraj+Basti" },
  ],
};

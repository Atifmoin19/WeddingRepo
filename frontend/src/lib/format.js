// Dates, times and wording shared by the invite, the PDF card and the admin panel.
// Event dates and times are Indian time (+05:30) and are shown as written, whatever the viewer's time zone.

export const pad = (n) => String(n).padStart(2, "0");
export const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(e) {
  const [y, m, d] = String(e.date).split("-").map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

export const eventStart = (e) => new Date(`${e.date}T${e.time}:00+05:30`);
export const weekday = (e) => WEEKDAYS[parts(e).wd];
export const dateLong = (e) => { const p = parts(e); return `${ord(p.d)} ${MONTHS[p.m - 1]} ${p.y}`; };
export const dateDots = (e) => { const p = parts(e); return `${pad(p.d)} · ${pad(p.m)} · ${p.y}`; };
// Date line for everything the guest is invited to: one date, or "16th & 18th October 2027" when the events span days.
export function occasionDates(events, style = "long") {
  const days = [...new Map(events.map((e) => [e.date, e])).values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!days.length) return "";
  if (days.length === 1) return style === "dots" ? dateDots(days[0]) : `${weekday(days[0])}, ${dateLong(days[0])}`;
  const p = days.map(parts), last = p[p.length - 1];
  const sameMonth = p.every((x) => x.m === last.m && x.y === last.y);
  if (style === "dots") return sameMonth ? `${p.map((x) => pad(x.d)).join(" & ")} · ${pad(last.m)} · ${last.y}` : days.map(dateDots).join("  &  ");
  return sameMonth ? `${p.map((x) => ord(x.d)).join(" & ")} ${MONTHS[last.m - 1]} ${last.y}` : days.map(dateLong).join(" & ");
}
export const clock = (e) => { const [h, m] = String(e.time).split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`; };

// What the guest reads for the time: the host's label while timings are tentative, otherwise the clock time.
export const timeText = (e, tentative) => (tentative && e.timeLabel ? e.timeLabel : `${clock(e)} onwards`);
export const TENTATIVE_NOTE = "Timings are tentative and will be confirmed";

export const mapUrl = (e) => e.map || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.venue}, ${e.addr}`)}`;

// "Dawat-e-Walima" -> "Walima" for the short script headings.
export const shortName = (e) => e.name.replace(/^Dawat-e-/i, "");

// The event the countdown, scratch card and card front are about.
export function mainEvent(settings) {
  const ev = settings.events || [];
  return ev.find((e) => e.key === settings.countdownEvent) || ev[ev.length - 1] || null;
}

// Which groups the guest actually has events for.
export function guestGroups(data) {
  const fromEvents = ["barat", "walima"].filter((g) => data.settings.events.some((e) => e.group === g));
  return fromEvents.length ? fromEvents : data.guest.invited;
}

// Walima only -> "Dawat-e-Walima", Barat only -> "Nikah", both -> "Nikah and Dawat-e-Walima".
export function occasion(data) {
  const g = guestGroups(data);
  const barat = g.includes("barat"), walima = g.includes("walima");
  if (barat && walima) return "Nikah and Dawat-e-Walima";
  return barat ? "Nikah" : "Dawat-e-Walima";
}

// Label for one group, from the names of its events: "Barat & Nikah".
export function groupLabel(events, group) {
  const names = events.filter((e) => e.group === group).map((e) => e.name);
  return names.join(" & ") || (group === "barat" ? "Barat & Nikah" : "Walima");
}

export const digits = (s) => String(s || "").replace(/\D/g, "");

// Family guests get a "with Family" line under their name, unless the host already typed it into the name.
export const withFamily = (guest) => guest.party === "family" && !/\bfamily\b/i.test(guest.name);

// Add to calendar: Google Calendar on Android and desktop, an .ics file on Apple devices.
import { eventStart, mapUrl } from "./format.js";

const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
const stamp = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");

export function addToCalendar(e, couple) {
  const start = eventStart(e), end = new Date(+start + 4 * 36e5);
  const title = `${e.name} - ${couple.groom} & ${couple.bride}`, where = `${e.venue}, ${e.addr}`;
  const details = `You are invited to the ${e.name} of ${couple.groomFull} & ${couple.brideFull}.\nVenue: ${where}\nMap: ${mapUrl(e)}`;
  if (!isApple) {
    const q = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${stamp(start)}/${stamp(end)}`, details, location: where });
    window.open("https://calendar.google.com/calendar/render?" + q, "_blank", "noopener");
    return;
  }
  const esc = (t) => t.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//wedding-invite//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    "UID:" + stamp(start) + "-" + e.name.replace(/\W+/g, "") + "@invite", "DTSTAMP:" + stamp(new Date()), "DTSTART:" + stamp(start), "DTEND:" + stamp(end),
    "SUMMARY:" + esc(title), "LOCATION:" + esc(where), "DESCRIPTION:" + esc(details), "URL:" + mapUrl(e),
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:" + esc(title + " is tomorrow"), "END:VALARM",
    "BEGIN:VALARM", "TRIGGER:-PT3H", "ACTION:DISPLAY", "DESCRIPTION:" + esc(title + " is today"), "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  a.download = e.name.replace(/\W+/g, "-") + ".ics";
  document.body.appendChild(a); a.click(); a.remove();
}

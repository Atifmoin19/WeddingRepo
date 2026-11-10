// Builds the printable invitation card (3 pages) on canvas and saves it as a PDF.
// Page 1: cover in the couple frame. Page 2: the guest's own page. Page 3: the full invitation.
import { jpegsToPdf } from "./pdf.js";
import { clock, dateLong, digits, guestGroups, mainEvent, occasion, TENTATIVE_NOTE, weekday, withFamily, occasionDates } from "./format.js";

const W = 1412, H = 2509;                       // same proportions as the frame artwork (941 x 1672)
const BOX = { cx: W / 2, w: W * 0.62, top: H * 0.16, bottom: H * 0.83 };          // inside the plain frame
const ARCH = { cx: W / 2, w: W * 0.56, top: H * 0.17, bottom: H * 0.6 };           // inside the arch, clear of the couple
const INK = "#4a3420", SOFT = "#6b4f3a", GOLD = ["#7a5626", "#a67c3d", "#cfa75e", "#a67c3d", "#7a5626"];

const font = {
  script: (px) => `400 ${px}px Allura, cursive`,
  caps: (w) => (px) => `${w} ${px}px Cinzel, serif`,
  body: (w, italic) => (px) => `${italic ? "italic " : ""}${w} ${px}px "Cormorant Garamond", serif`,
  ar: (px) => `400 ${px}px Amiri, serif`,
};

const phone = (n) => { const d = digits(n); return d.length === 12 ? `+${d.slice(0, 2)} ${d.slice(2, 7)} ${d.slice(7)}` : d ? "+" + d : ""; };

const loadImage = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
const loadFonts = () => Promise.all(
  ['400 80px Allura', '500 30px Cinzel', '600 30px Cinzel', '400 30px "Cormorant Garamond"', 'italic 400 30px "Cormorant Garamond"', '600 30px "Cormorant Garamond"', '400 60px Amiri']
    .map((f) => document.fonts.load(f, "Aa بسم"))).catch(() => {});

function setFont(ctx, it, px) {
  ctx.font = it.font(px);
  ctx.direction = it.rtl ? "rtl" : "ltr";
  if ("letterSpacing" in ctx) ctx.letterSpacing = (it.ls || 0) * px + "px";
}

function wrap(ctx, text, maxW) {
  const lines = []; let line = "";
  for (const word of text.split(" ")) {
    const next = line ? line + " " + word : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// Measures every item at a given scale. Text items wrap, or shrink to one line when `fit` is set.
function measure(ctx, items, maxW, s) {
  let h = 0;
  const blocks = items.map((it) => {
    if (it.space) { h += it.space * s; return { it, h: it.space * s }; }
    if (it.orn) { h += 70 * s; return { it, h: 70 * s }; }
    let px = it.size * s;
    setFont(ctx, it, px);
    let lines;
    if (it.fit) {
      const w = ctx.measureText(it.text).width;
      if (w > maxW) px *= maxW / w;
      lines = [it.text];
    } else lines = wrap(ctx, it.text, maxW);
    const bh = lines.length * px * (it.lh || 1.3) + (it.gap || 0) * s;
    h += bh;
    return { it, px, lines, h: bh };
  });
  return { blocks, h };
}

function drawLine(ctx, text, cy, it, px, BOX) {
  setFont(ctx, it, px);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const x = BOX.cx + ((it.ls || 0) * px) / 2;
  const w = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(255,255,255,.85)";                 // light edge below: pressed-into-paper look
  ctx.fillText(text, x, cy + Math.max(1.5, px * 0.022));
  if (it.color === "gold") {
    const g = ctx.createLinearGradient(BOX.cx - w / 2, 0, BOX.cx + w / 2, 0);
    GOLD.forEach((c, i) => g.addColorStop(i / (GOLD.length - 1), c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = it.color || INK;
  ctx.fillText(text, x, cy);
}

function drawOrnament(ctx, cy, s, BOX) {
  const half = 190 * s, gap = 34 * s;
  ctx.strokeStyle = "#a67c3d"; ctx.fillStyle = "#a67c3d"; ctx.lineWidth = Math.max(1.5, 2 * s);
  ctx.beginPath(); ctx.moveTo(BOX.cx - half, cy); ctx.lineTo(BOX.cx - gap, cy); ctx.moveTo(BOX.cx + gap, cy); ctx.lineTo(BOX.cx + half, cy); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, r = (i % 2 ? 7 : 16) * s;
    ctx[i ? "lineTo" : "moveTo"](BOX.cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath(); ctx.fill();
  for (const dx of [-gap + 8 * s, gap - 8 * s]) { ctx.beginPath(); ctx.arc(BOX.cx + dx, cy, 4 * s, 0, 7); ctx.fill(); }
}

// Lays the items out centred in the frame, shrinking everything evenly if they would not fit.
function layout(ctx, items, BOX) {
  const room = BOX.bottom - BOX.top;
  let s = 1, plan = measure(ctx, items, BOX.w, s);
  for (let k = 0; k < 40 && plan.h > room; k++) { s *= 0.96; plan = measure(ctx, items, BOX.w, s); }
  let y = BOX.top + (room - plan.h) / 2;
  for (const b of plan.blocks) {
    if (b.it.orn) drawOrnament(ctx, y + b.h / 2, s, BOX);
    else if (b.lines) {
      const lh = b.px * (b.it.lh || 1.3);
      b.lines.forEach((line, i) => drawLine(ctx, line, y + lh * (i + 0.5), b.it, b.px, BOX));
    }
    y += b.h;
  }
}

function page(paint, items, box = BOX) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f4ecdc"; ctx.fillRect(0, 0, W, H);
  paint(ctx);
  layout(ctx, items, box);
  return c;
}

// An image at full card width with one edge faded out, like the masks on the site's section art.
function faded(img, h, fade, edge) {
  const c = document.createElement("canvas"); c.width = W; c.height = Math.ceil(h);
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0, W, h);
  const g = x.createLinearGradient(0, 0, 0, h), at = fade / h;      // one mask over the whole image
  if (edge === "bottom") { g.addColorStop(0, "#000"); g.addColorStop(1 - at, "#000"); g.addColorStop(1, "transparent"); }
  else { g.addColorStop(0, "transparent"); g.addColorStop(at, "#000"); g.addColorStop(1, "#000"); }
  x.globalCompositeOperation = "destination-in"; x.fillStyle = g; x.fillRect(0, 0, W, c.height);
  return c;
}

// Same build as the site's `.couple` section: band tiled as the base, arch at the top, the couple at the bottom.
const couplePaint = (band, top, bottom) => (ctx) => {
  const k = W / 400;                                           // the site's masks are sized for a ~400px wide phone
  const bh = (W * band.naturalHeight) / band.naturalWidth;
  for (let y = 0; y < H; y += bh) ctx.drawImage(band, 0, y, W, bh + 1);
  const th = (W * 700) / 941, bth = (W * 812) / 941;
  ctx.drawImage(faded(top, th, 24 * k, "bottom"), 0, 0);
  ctx.drawImage(faded(bottom, bth, 40 * k, "top"), 0, H - bth);
};

// data: the API response for this guest ({ guest, settings, rsvp }). Only the guest's own events are in it.
export async function buildCardPages(data) {
  const [frame, band, top, bottom] = await Promise.all([...["frame-plain", "couple-band", "couple-top", "couple-bottom"].map((n) => loadImage(`/images/${n}.webp`)), loadFonts()]);
  const { couple, contact, events, timingsTentative: tentative } = data.settings;
  const main = mainEvent(data.settings);
  const groups = guestGroups(data);
  const kind = groups.length > 1 ? "WEDDING" : groups[0] === "barat" ? "NIKAH" : "WALIMA";
  const what = occasion(data);
  const fullDate = (e) => `${weekday(e)}, ${dateLong(e)}`;
  const when = (e) => (tentative && e.timeLabel ? e.timeLabel : clock(e));
  const T = (text, f, size, extra = {}) => ({ text, font: f, size, ...extra });
  const plain = (ctx) => ctx.drawImage(frame, 0, 0, W, H);

  const cover = [
    T("بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", font.ar, 74, { color: "gold", rtl: true, lh: 1.7, gap: 26, fit: true }),
    T(couple.groom, font.script, 200, { color: "gold", lh: 1.1, fit: true }),
    T("&", font.script, 96, { color: "gold", lh: 1.0 }),
    T(couple.bride, font.script, 200, { color: "gold", lh: 1.1, fit: true, gap: 16 }),
    { orn: true },
    T(what.toUpperCase(), font.caps(600), 40, { ls: 0.22, gap: 10, fit: true }),
    ...(main ? [T(occasionDates(events), font.body(400, true), 52, { color: SOFT, fit: true })] : []),
  ];

  const guestPage = [
    T("WITH LOVE, WE INVITE", font.caps(500), 34, { color: "#a67c3d", ls: 0.34, gap: 30, fit: true }),
    T(data.guest.name || "Family & Friends", font.script, 190, { color: "gold", lh: 1.2, fit: true }),
    ...(withFamily(data.guest) ? [T("with Family", font.body(400, true), 64, { color: SOFT, lh: 1.3 })] : []),
    { space: 40 }, { orn: true }, { space: 30 },
    ...(events.length ? [T("TO JOIN US FOR", font.caps(500), 30, { color: "#a67c3d", ls: 0.34, gap: 30, fit: true })] : []),
    ...events.flatMap((e) => [
      T(e.name.toUpperCase(), font.caps(600), 46, { ls: 0.2, fit: true, gap: 4 }),
      T(fullDate(e), font.body(400, true), 50, { color: SOFT, fit: true, gap: 34 }),
    ]),
  ];

  const inside = [
    T("بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", font.ar, 78, { color: "gold", rtl: true, lh: 1.7 }),
    T("In the name of Allah, the Most Beneficent, the Most Merciful", font.body(400, true), 42, { color: SOFT, gap: 30 }),
    T(couple.hosts, font.body(600), 62, { lh: 1.2, gap: 8 }),
    T(`request the pleasure of your gracious presence on the auspicious occasion of the ${what} of their beloved son`, font.body(400), 50, { lh: 1.32, gap: 24 }),
    T(couple.groomFull, font.script, 150, { color: "gold", lh: 1.15, fit: true }),
    T(couple.groomParents, font.body(400), 42, { color: SOFT, gap: 4 }),
    T("with", font.script, 78, { color: "gold", lh: 1.2 }),
    T(couple.brideFull, font.script, 150, { color: "gold", lh: 1.15, fit: true }),
    T(couple.brideParents, font.body(400), 42, { color: SOFT, gap: 16 }),
    { orn: true },
    ...events.flatMap((e) => [
      T(e.name.toUpperCase(), font.caps(600), 42, { ls: 0.2, fit: true, gap: 2 }),
      T(`${fullDate(e)} · ${when(e)}`, font.body(400), 46, { fit: true }),
      T(`${e.venue}, ${e.addr}`, font.body(400, true), 44, { color: SOFT, fit: true, gap: 24 }),
    ]),
    ...(tentative && events.length ? [T(TENTATIVE_NOTE, font.body(400, true), 36, { color: SOFT, fit: true, gap: 10 })] : []),
    { orn: true },
    T("May Allah bless you both and unite you in goodness. Ameen.", font.body(400, true), 44, { color: SOFT, gap: 22 }),
    T("WITH WARM REGARDS", font.caps(500), 28, { color: "#a67c3d", ls: 0.34, fit: true, gap: 4 }),
    T(couple.hosts, font.body(600), 46, { fit: true }),
    ...(digits(contact.whatsapp) ? [T(`RSVP  ${phone(contact.whatsapp)}`, font.caps(500), 30, { color: SOFT, ls: 0.16, fit: true })] : []),
  ];

  return { pages: [page(couplePaint(band, top, bottom), cover, ARCH), page(plain, guestPage), page(plain, inside)], kind };
}

const toJpeg = (canvas) => new Promise((ok, fail) => canvas.toBlob(async (b) => {
  if (!b) return fail(new Error("Could not draw the card"));
  ok({ data: new Uint8Array(await b.arrayBuffer()), w: canvas.width, h: canvas.height });
}, "image/jpeg", 0.9));

export async function buildCardPdf(data) {
  const { pages, kind } = await buildCardPages(data);
  const pdf = jpegsToPdf(await Promise.all(pages.map(toJpeg)), 360);   // 5 in wide
  const who = (data.guest.name || "Guest").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  const title = kind[0] + kind.slice(1).toLowerCase();
  return { blob: new Blob([pdf], { type: "application/pdf" }), filename: `${title}-Invitation-${who}.pdf` };
}

export async function downloadCard(data) {
  const { blob, filename } = await buildCardPdf(data);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

// Builds the printable invitation card (2 pages) on canvas and saves it as a PDF.
// Page 1: front, with the guest's name. Page 2: the full invitation.
import { jpegsToPdf } from "./pdf.js";

const W = 1412, H = 2509;                       // same proportions as the frame artwork (941 x 1672)
const BOX = { cx: W / 2, w: W * 0.62, top: H * 0.16, bottom: H * 0.83 };
const INK = "#4a3420", SOFT = "#6b4f3a", GOLD = ["#7a5626", "#a67c3d", "#cfa75e", "#a67c3d", "#7a5626"];

const font = {
  script: (px) => `400 ${px}px Allura, cursive`,
  caps: (w) => (px) => `${w} ${px}px Cinzel, serif`,
  body: (w, italic) => (px) => `${italic ? "italic " : ""}${w} ${px}px "Cormorant Garamond", serif`,
  ar: (px) => `400 ${px}px Amiri, serif`,
};

const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const longDate = (d) => `${d.toLocaleString("en-GB", { weekday: "long" })}, ${ord(d.getDate())} ${d.toLocaleString("en-GB", { month: "long" })} ${d.getFullYear()}`;
const clock = (d) => d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
const phone = (n) => { const d = String(n || "").replace(/\D/g, ""); return d.length === 12 ? `+${d.slice(0, 2)} ${d.slice(2, 7)} ${d.slice(7)}` : d ? "+" + d : ""; };

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

function drawLine(ctx, text, cy, it, px) {
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

function drawOrnament(ctx, cy, s) {
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
function layout(ctx, items) {
  const room = BOX.bottom - BOX.top;
  let s = 1, plan = measure(ctx, items, BOX.w, s);
  for (let k = 0; k < 40 && plan.h > room; k++) { s *= 0.96; plan = measure(ctx, items, BOX.w, s); }
  let y = BOX.top + (room - plan.h) / 2;
  for (const b of plan.blocks) {
    if (b.it.orn) drawOrnament(ctx, y + b.h / 2, s);
    else if (b.lines) {
      const lh = b.px * (b.it.lh || 1.3);
      b.lines.forEach((line, i) => drawLine(ctx, line, y + lh * (i + 0.5), b.it, b.px));
    }
    y += b.h;
  }
}

function page(frame, items) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f4ecdc"; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(frame, 0, 0, W, H);
  layout(ctx, items);
  return c;
}

export async function buildCardPages(CONFIG) {
  const [frame] = await Promise.all([loadImage("/images/frame-plain.webp"), loadFonts()]);
  const main = CONFIG.events.find((e) => e.when === CONFIG.countdownTo) || CONFIG.events[0];
  const when = new Date(main.when);
  const T = (text, f, size, extra = {}) => ({ text, font: f, size, ...extra });

  const front = [
    T("بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", font.ar, 96, { color: "gold", rtl: true, lh: 1.7, gap: 30 }),
    T("WALIMA INVITATION", font.caps(500), 36, { color: "#a67c3d", ls: 0.34, gap: 40, fit: true }),
    T(CONFIG.groom, font.script, 230, { color: "gold", lh: 1.12, fit: true }),
    T("&", font.script, 110, { color: "gold", lh: 1.05 }),
    T(CONFIG.bride, font.script, 230, { color: "gold", lh: 1.12, fit: true, gap: 20 }),
    { orn: true },
    T("DAWAT-E-WALIMA", font.caps(600), 50, { ls: 0.26, gap: 14, fit: true }),
    T(longDate(when), font.body(400, true), 60, { color: SOFT, fit: true }),
    T(`${clock(when)} onwards · ${main.venue}, ${main.addr.split(",")[0]}`, font.body(400, true), 52, { color: SOFT, fit: true, gap: 70 }),
    T("WITH LOVE, WE INVITE", font.caps(500), 30, { color: "#a67c3d", ls: 0.34, gap: 6, fit: true }),
    T(CONFIG.guest || "Family & Friends", font.script, 150, { color: "gold", lh: 1.2, fit: true }),
  ];

  const inside = [
    T("بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", font.ar, 78, { color: "gold", rtl: true, lh: 1.7 }),
    T("In the name of Allah, the Most Beneficent, the Most Merciful", font.body(400, true), 42, { color: SOFT, gap: 30 }),
    T(CONFIG.hosts, font.body(600), 62, { lh: 1.2, gap: 8 }),
    T("request the pleasure of your gracious presence on the auspicious occasion of the Dawat-e-Walima of their beloved son", font.body(400), 50, { lh: 1.32, gap: 24 }),
    T(CONFIG.groomFull, font.script, 150, { color: "gold", lh: 1.15, fit: true }),
    T(CONFIG.groomParents, font.body(400), 42, { color: SOFT, gap: 4 }),
    T("with", font.script, 78, { color: "gold", lh: 1.2 }),
    T(CONFIG.brideFull, font.script, 150, { color: "gold", lh: 1.15, fit: true }),
    T(CONFIG.brideParents, font.body(400), 42, { color: SOFT, gap: 16 }),
    { orn: true },
    ...CONFIG.events.filter((e) => e.on).flatMap((e) => {
      const d = new Date(e.when);
      return [
        T(e.name.toUpperCase(), font.caps(600), 42, { ls: 0.2, fit: true, gap: 2 }),
        T(`${longDate(d)} · ${clock(d)}`, font.body(400), 46, { fit: true }),
        T(`${e.venue}, ${e.addr}`, font.body(400, true), 44, { color: SOFT, fit: true, gap: 24 }),
      ];
    }),
    { orn: true },
    T("May Allah bless you both and unite you in goodness. Ameen.", font.body(400, true), 44, { color: SOFT, gap: 22 }),
    T("WITH WARM REGARDS", font.caps(500), 28, { color: "#a67c3d", ls: 0.34, fit: true, gap: 4 }),
    T(CONFIG.hosts, font.body(600), 46, { fit: true }),
    ...(CONFIG.whatsapp ? [T(`RSVP  ${phone(CONFIG.whatsapp)}`, font.caps(500), 30, { color: SOFT, ls: 0.16, fit: true })] : []),
  ];

  return [page(frame, front), page(frame, inside)];
}

const toJpeg = (canvas) => new Promise((ok) => canvas.toBlob(async (b) => ok({ data: new Uint8Array(await b.arrayBuffer()), w: canvas.width, h: canvas.height }), "image/jpeg", 0.9));

export async function downloadCard(CONFIG) {
  const pages = await buildCardPages(CONFIG);
  const pdf = jpegsToPdf(await Promise.all(pages.map(toJpeg)), 360);   // 5 in wide
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  a.download = `Walima-Invitation-${(CONFIG.guest || "Guest").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

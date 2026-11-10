import "./style.css";
import "./extra.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInvite } from "./useInvite.js";
import { mainEvent, occasion, occasionDates, withFamily } from "../lib/format.js";
import { buildSections } from "./sections.jsx";

// Shown on the locked screen and on the envelope until the API has answered (the public API needs a guest code).
const FALLBACK_COUPLE = { groom: "Atif", bride: "Nargis" };
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

function CoupleLine({ couple, size }) {
  return (
    <p className="script gold" style={{ fontSize: size }}>
      {couple.groom}&nbsp;<span style={{ fontSize: ".6em" }}>&amp;</span>&nbsp;{couple.bride}
    </p>
  );
}

/* Envelope: the doors slide apart when the seal is tapped. Visible at once, even while the API wakes up. */
function Envelope({ status, data, opening, onOpen, onRetry, sealRef }) {
  const [ready, setReady] = useState(false);
  const locked = status === "locked";
  useEffect(() => {
    if (locked) return undefined;
    let b; const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setReady(true)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [locked]);

  const couple = data?.settings.couple || FALLBACK_COUPLE;
  const main = data ? mainEvent(data.settings) : null;
  const what = data ? occasion(data) : "";
  const act = status === "ready" ? onOpen : status === "error" ? onRetry : undefined;
  const capsSm = { fontSize: 10, letterSpacing: ".24em", color: "var(--ink)" };

  return (
    <div className={`intro${ready ? " ready" : ""}${opening ? " open" : ""}`} id="intro" role="button" tabIndex={locked ? -1 : 0}
      aria-hidden={locked || undefined} aria-label={status === "ready" ? "Tap to open the invitation" : "Opening your invitation"}
      onClick={act} onKeyDown={(e) => { if (act && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); act(); } }}>
      <div className="half l"><img src="/images/envelope.webp" alt="" draggable="false" /></div>
      <div className="half r"><img src="/images/envelope.webp" alt="" draggable="false" /></div>
      <div className="sealbox"><div className="seal" ref={sealRef}><div className="glow2" /><img src="/images/seal.webp" alt="" draggable="false" /><div className="shine"><i /></div></div></div>
      <div className="cover">
        <div className="top">
          <p className="eyebrow">Bismillah</p>
          <p className="caps" style={{ fontSize: 10, letterSpacing: ".24em", color: "var(--ink-soft)" }}>You are cordially invited</p>
          {data && <p className="caps guestline" style={{ fontSize: 10, letterSpacing: ".2em", color: "var(--ink)" }}>Dear {data.guest.name}</p>}
          {data && withFamily(data.guest) && <p className="caps" style={{ fontSize: 10, letterSpacing: ".2em", color: "var(--ink)" }}>with Family</p>}
        </div>
        <div className="bot">
          <CoupleLine couple={couple} size="clamp(44px,13cqw,56px)" />
          {data && (what.length > 16
            ? <><p className="caps" style={capsSm}>{what}</p>{main && <p className="caps" style={capsSm}>{occasionDates(data.settings.events, "dots")}</p>}</>
            : <p className="caps" style={capsSm}>{what}{main ? ` · ${occasionDates(data.settings.events, "dots")}` : ""}</p>)}
          {status === "error" ? (
            <>
              <p className="sm waitmsg" role="alert">We could not open your invitation just now. Please check your internet connection and try again.</p>
              <button className="btn" type="button" onClick={(e) => { e.stopPropagation(); onRetry(); }}>Try again</button>
            </>
          ) : (
            <p className={`caps hint${status === "ready" ? "" : " wait"}`} role="status" style={{ fontSize: 9.5, letterSpacing: ".3em", color: "var(--gold)", marginTop: 8 }}>
              {status === "ready" ? "Tap the seal to open" : "Opening your invitation…"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Locked() {
  return (
    <div className="locked" id="locked">
      <div className="lockcard">
        <p className="eyebrow">Private invitation</p>
        <CoupleLine couple={FALLBACK_COUPLE} size="clamp(40px,12cqw,52px)" />
        <p className="lead" style={{ fontSize: 17 }}>This invitation is personal. Please open it using the link that was sent to you.</p>
        <p className="sm" style={{ fontSize: 14 }}>If your link is not working, please contact the family.</p>
      </div>
    </div>
  );
}

/* Falling petals (leaf-shaped, tumbling). Random values are made once. */
function Petals() {
  const petals = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    i, left: Math.random() * 100, dx: (Math.random() * 120 - 60).toFixed(0), dur: 10 + Math.random() * 9, delay: -Math.random() * 16, flutter: 2.2 + Math.random() * 3, size: 9 + Math.random() * 8,
  })), []);
  return petals.map((p) => (
    <span className="petal" key={p.i} style={{ left: `${p.left}%`, "--dx": `${p.dx}px`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}>
      <svg width={p.size} height={p.size * 1.25} viewBox="0 0 20 25" style={{ animationDuration: `${p.flutter}s` }}>
        <defs><radialGradient id={`pg${p.i}`} cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#FFFDF7" /><stop offset=".7" stopColor="#F3E6CC" /><stop offset="1" stopColor="#E2CFA8" /></radialGradient></defs>
        <path d="M10 1C17 6 19 15 10 24C1 15 3 6 10 1Z" fill={`url(#pg${p.i})`} opacity=".92" />
        <path d="M10 4C11 10 11 16 10 21" stroke="#E0C99C" strokeWidth=".6" fill="none" opacity=".6" />
      </svg>
    </span>
  ));
}

/* Gold dust drifting up the page; reacts a little to scrolling. */
function useDust(canvasRef, deckRef) {
  useEffect(() => {
    const cv = canvasRef.current, cx = cv.getContext("2d");
    let W = 0, H = 0, raf = 0, lastS = 0;
    const size = () => { const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); addEventListener("resize", size);
    const sprite = document.createElement("canvas"); sprite.width = sprite.height = 32;
    { const s = sprite.getContext("2d"), g = s.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, "rgba(255,250,230,1)"); g.addColorStop(0.25, "rgba(243,223,166,.9)"); g.addColorStop(1, "rgba(214,180,112,0)"); s.fillStyle = g; s.fillRect(0, 0, 32, 32); }
    const PT = Array.from({ length: 44 }, () => ({ x: Math.random(), y: Math.random(), r: 2 + Math.random() * 7, v: 0.00015 + Math.random() * 0.0004, ph: Math.random() * 6.28, sw: 0.5 + Math.random() }));
    const loop = (t) => {
      cx.clearRect(0, 0, W, H);
      const top = deckRef.current?.scrollTop || 0, ds = H ? (top - lastS) / H : 0; lastS = top;
      for (const p of PT) {
        p.y -= p.v + ds * p.r * 0.04; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); } if (p.y > 1.06) p.y = -0.04;
        cx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin((t / 900) * p.sw + p.ph));
        const x = (p.x + Math.sin(t / 3000 + p.ph) * 0.02) * W;
        cx.drawImage(sprite, x - p.r, p.y * H - p.r, p.r * 2, p.r * 2);
      }
      if (!RM) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", size); };
  }, [canvasRef, deckRef]);
}

export default function InviteApp() {
  const invite = useInvite();
  const { status, data, code } = invite;
  const stageRef = useRef(null), deckRef = useRef(null), dustRef = useRef(null), tapsRef = useRef(null), sealRef = useRef(null);
  const [phase, setPhase] = useState("closed");          // closed -> opening -> opened (sections animate in) -> gone (envelope removed)
  const opened = phase === "opened" || phase === "gone";
  const openedRef = useRef(false); openedRef.current = opened;
  const [seen, setSeen] = useState(() => new Set());     // sections that have played their reveal
  const [current, setCurrent] = useState(0);

  useDust(dustRef, deckRef);

  // Tap sparkles: a small burst of gold at a point on the screen.
  const burst = useCallback((px, py, n = 10) => {
    const stage = stageRef.current, taps = tapsRef.current; if (!stage || !taps) return;
    const r = stage.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i"); s.className = "spark";
      const a = Math.random() * 6.28, d = 20 + Math.random() * (n > 12 ? 110 : 45);
      s.style.left = px - r.left + "px"; s.style.top = py - r.top + "px";
      s.style.setProperty("--x", Math.cos(a) * d + "px"); s.style.setProperty("--y", Math.sin(a) * d + "px");
      taps.appendChild(s); setTimeout(() => s.remove(), 950);
    }
  }, []);

  const markVisible = useCallback(() => {
    const deck = deckRef.current; if (!deck) return;
    const d = deck.getBoundingClientRect();
    const ids = [...deck.querySelectorAll(".blk")].filter((b) => { const r = b.getBoundingClientRect(); return r.top < d.bottom && r.bottom > d.top; }).map((b) => b.id);
    setSeen((s) => new Set([...s, ...ids]));
  }, []);

  const open = useCallback(() => {
    if (phase !== "closed") return;
    setPhase("opening"); navigator.vibrate?.(30);
    setTimeout(() => { const r = sealRef.current?.getBoundingClientRect(); if (r) burst(r.left + r.width / 2, r.top + r.height / 2, 28); }, 450);
    setTimeout(() => { setPhase("opened"); markVisible(); }, 1500);
    setTimeout(() => setPhase("gone"), 2700);
  }, [phase, burst, markVisible]);

  const sections = useMemo(() => (data ? buildSections(data) : []), [data]);
  const ids = sections.map((s) => s.id).join(",");

  // Section dots and one-shot reveals.
  useEffect(() => {
    const deck = deckRef.current; if (!deck || !ids) return undefined;
    const blocks = [...deck.querySelectorAll(".blk")];
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      setCurrent(blocks.indexOf(e.target));
      if (openedRef.current) setSeen((s) => (s.has(e.target.id) ? s : new Set(s).add(e.target.id)));
    }), { root: deck, threshold: 0.55 });
    blocks.forEach((b) => io.observe(b));
    return () => io.disconnect();
  }, [ids]);

  // Host shortcut: five quick taps on the bottom-left corner open the admin page.
  const hostTaps = useRef([]);
  const hostTap = () => { const now = Date.now(); hostTaps.current = hostTaps.current.filter((t) => now - t < 3000); hostTaps.current.push(now); if (hostTaps.current.length >= 5) location.href = "/admin"; };

  const ctx = { data, code, burst, onRsvpSaved: invite.setRsvp };

  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <main className="stage" id="stage" ref={stageRef}>
        <div className="deck" id="deck" ref={deckRef} onPointerDown={(e) => { if (!e.target.closest("canvas,input,button,a")) burst(e.clientX, e.clientY); }}>
          {sections.map((s) => (
            <section className={`blk ${s.kind}${seen.has(s.id) ? " in" : ""}`} id={s.id} key={s.id} aria-label={s.name}>
              <div className="bg" aria-hidden="true"><i className="m" /><i className="t" /><i className="b" /></div>
              <s.Body {...ctx} />
            </section>
          ))}
        </div>
        <canvas className="dust" id="dust" ref={dustRef} aria-hidden="true" />
        <div className="petals" id="petals" aria-hidden="true">{opened && !RM && <Petals />}</div>
        <div className="taps" id="taps" ref={tapsRef} aria-hidden="true" />
        <nav className="dots" id="dots" aria-label="Sections">
          {sections.map((s, i) => (
            <button type="button" key={s.id} aria-label={`Go to ${s.name}`} aria-current={i === current}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" })} />
          ))}
        </nav>
        {status === "locked" && <Locked />}
        <div id="hostspot" aria-hidden="true" onClick={hostTap} />
        {phase !== "gone" && <Envelope status={status} data={data} opening={phase !== "closed"} onOpen={open} onRetry={invite.retry} sealRef={sealRef} />}
      </main>
    </>
  );
}

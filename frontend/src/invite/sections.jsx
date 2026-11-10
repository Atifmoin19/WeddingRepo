// The framed sections of the invitation. Every Body is a stable component, so a data refresh
// re-renders text in place and never restarts animations or resets the scratch card or the RSVP form.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { addToCalendar } from "../lib/calendar.js";
import { dateDots, dateLong, eventStart, guestGroups, mainEvent, mapUrl, occasion, pad, shortName, TENTATIVE_NOTE, timeText, weekday } from "../lib/format.js";
import { GIFT_SVG, WREATH_SVG } from "./art.js";
import Rsvp from "./Rsvp.jsx";

const WREATH_HTML = { __html: WREATH_SVG }, GIFT_HTML = { __html: GIFT_SVG };   // static art only

const Rv = ({ d = 0, cls = "rv", children }) => <div className={cls} style={{ "--d": `${(d * 0.45).toFixed(2)}s` }}>{children}</div>;
const Wide = ({ children }) => <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>{children}</div>;
const Orn = ({ d = 0 }) => (
  <svg className="orn" style={{ "--d": `${d}s` }} viewBox="0 0 150 16" aria-hidden="true">
    <path d="M0 8H62M88 8H150" stroke="#a67c3d" strokeOpacity=".7" /><path d="M75 1l3 4 5 1-4 3 1 5-5-2-5 2 1-5-4-3 5-1z" fill="#a67c3d" /><circle cx="66" cy="8" r="1.6" fill="#a67c3d" /><circle cx="84" cy="8" r="1.6" fill="#a67c3d" />
  </svg>
);
const Pin = ({ w, h }) => (
  <svg width={w} height={h} viewBox="0 0 24 28" aria-hidden="true"><path d="M12 26C5 17 2 13 2 9.5a10 10 0 0 1 20 0C22 13 19 17 12 26z" fill="none" stroke="#a67c3d" strokeWidth="1.6" /><circle cx="12" cy="10" r="3.4" fill="none" stroke="#a67c3d" strokeWidth="1.6" /></svg>
);
// "A & B" on separate lines, as the original card set it.
const splitAmp = (text) => { const i = text.indexOf(" & "); return i < 0 ? [text] : [text.slice(0, i), text.slice(i + 3)]; };
const Chars = ({ text, d0 = 0, step = 0.06 }) => (
  <span className="chars" aria-label={text}>
    {[...text].map((c, i) => <span aria-hidden="true" key={i} style={{ transitionDelay: `${(d0 * 0.45 + i * step * 0.6).toFixed(2)}s` }}>{c === " " ? " " : c}</span>)}
  </span>
);

function Verse() {
  return (
    <div className="safe">
      <Rv d={0.1} cls="wipe"><p className="ar gold" style={{ fontSize: "clamp(36px,11cqw,46px)", lineHeight: 1.9 }}>وَخَلَقْنَاكُمْ أَزْوَاجًا</p></Rv>
      <Rv d={1.2}><p className="lead" style={{ fontSize: 21 }}>“And We created you in pairs”</p></Rv>
      <Rv d={1.5}><p className="eyebrow" style={{ marginTop: 6, fontSize: 12 }}>Qur'an 78 : 8</p></Rv>
      <Orn d={1.7} />
      <Rv d={2.4}><div className="hintdown" aria-hidden="true" style={{ marginTop: 40 }}>SCROLL<svg width="12" height="8" viewBox="0 0 12 8"><path d="M1 1l5 5 5-5" fill="none" stroke="#a67c3d" /></svg></div></Rv>
    </div>
  );
}

function Qubool({ data }) {
  const { groom, bride } = data.settings.couple;
  return (
    <div className="safe">
      <Rv d={0.1}>
        <div className="wreath">
          <span style={{ display: "contents" }} dangerouslySetInnerHTML={WREATH_HTML} />
          <div className="mg"><b className="gold">{[...groom][0]}</b><i className="gold">&amp;</i><b className="gold">{[...bride][0]}</b></div>
        </div>
      </Rv>
      <Rv d={1.2}><p className="lead" style={{ fontSize: 22 }}>saying.....</p></Rv>
      <Rv d={1.5} cls="wipe"><p className="ur gold" style={{ fontSize: "clamp(38px,11.5cqw,48px)", lineHeight: 2, padding: "0 .2em" }}>قبول ہے</p></Rv>
      <Rv d={2.3}><p className="caps" style={{ fontSize: 13, letterSpacing: ".32em", color: "var(--ink-soft)", marginTop: 10 }}>Qubool Hai</p></Rv>
    </div>
  );
}

function Families({ data }) {
  const c = data.settings.couple;
  const hosts = splitAmp(c.hosts), gp = splitAmp(c.groomParents), bp = splitAmp(c.brideParents);
  const script = { fontSize: "clamp(36px,10.5cqw,44px)" };
  return (
    <div className="safe">
      <Rv d={0.1} cls="wipe"><p className="ar gold" style={{ fontSize: "clamp(24px,7.4cqw,30px)", lineHeight: 1.7 }}>بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p></Rv>
      <Rv d={1}><p className="par" style={{ fontStyle: "italic" }}>In the name of Allah, the Most Beneficent, the Most Merciful</p></Rv>
      <Rv d={1.3}><p className="host" style={{ marginTop: 4 }}>{hosts[0]}{hosts[1] && <><br />&amp;<br />{hosts[1]}</>}</p></Rv>
      <Rv d={1.6}><p className="req">Request the pleasure of your gracious presence on the auspicious occasion of the {occasion(data)} of their beloved son</p></Rv>
      <Rv d={1.9}><p className="script gold" style={script}>{c.groomFull}</p><p className="par">{gp[0]}{gp[1] && <><br />&amp; {gp[1]}</>}</p></Rv>
      <Rv d={2.2}><svg width="34" height="26" viewBox="0 0 44 34" aria-hidden="true"><g fill="none" stroke="#a67c3d" strokeWidth="1.8"><circle cx="16" cy="20" r="10" /><circle cx="28" cy="20" r="10" /></g><path d="M22 4l3 4-3 3-3-3z" fill="#a67c3d" /><g fill="#a67c3d"><circle cx="9" cy="5" r="1" /><circle cx="35" cy="5" r="1" /></g></svg></Rv>
      <Rv d={2.4}><p className="script gold" style={script}>{c.brideFull}</p><p className="par">{bp[0]}{bp[1] && <><br />&amp; {bp[1]}</>}</p></Rv>
    </div>
  );
}

/* Scratch the gold foil to reveal the date. The foil is drawn once; data refreshes only change the text under it. */
function Scratch({ data, burst }) {
  const main = mainEvent(data.settings);
  const wrap = useRef(null), canvas = useRef(null), touched = useRef(false);
  const [done, setDone] = useState(false);
  const burstRef = useRef(burst); burstRef.current = burst;

  useEffect(() => {
    const sc = canvas.current, sx = sc.getContext("2d", { willReadFrequently: true });
    let down = false, finished = false;
    const foil = () => {
      if (touched.current) return;
      sx.globalCompositeOperation = "source-over";
      const g = sx.createLinearGradient(0, 0, 440, 440); g.addColorStop(0, "#8a6a32"); g.addColorStop(0.3, "#e9cf8f"); g.addColorStop(0.5, "#fff1c4"); g.addColorStop(0.7, "#c9a45f"); g.addColorStop(1, "#7a5626"); sx.fillStyle = g; sx.fillRect(0, 0, 440, 440);
      for (let i = 0; i < 2600; i++) { sx.fillStyle = `rgba(${Math.random() < 0.5 ? "255,248,220" : "90,60,20"},${Math.random() * 0.18})`; sx.fillRect(Math.random() * 440, Math.random() * 440, 1.5, 1.5); }
      sx.strokeStyle = "rgba(255,250,230,.45)"; sx.lineWidth = 1.2; for (let r = 60; r < 220; r += 26) { sx.beginPath(); sx.arc(220, 220, r, 0, 7); sx.stroke(); }
      sx.fillStyle = "#4a3420"; sx.textAlign = "center"; sx.font = "500 26px Cinzel, serif"; sx.fillText("SCRATCH", 220, 212); sx.font = "italic 26px 'Cormorant Garamond', serif"; sx.fillText("to reveal", 220, 246);
    };
    const pt = (e) => { const r = sc.getBoundingClientRect(); return [((e.clientX - r.left) * 440) / r.width, ((e.clientY - r.top) * 440) / r.height]; };
    const scratch = (e) => {
      if (!down || finished) return;
      touched.current = true;
      const [x, y] = pt(e); sx.globalCompositeOperation = "destination-out"; sx.beginPath(); sx.arc(x, y, 34, 0, 7); sx.fill();
      const d = sx.getImageData(0, 0, 440, 440).data; let n = 0, t = 0; for (let i = 3; i < d.length; i += 120) { t++; if (d[i] < 40) n++; }
      if (n / t > 0.48) {
        finished = true; setDone(true); navigator.vibrate?.([20, 40, 20]);
        const r = sc.getBoundingClientRect(); burstRef.current(r.left + r.width / 2, r.top + r.height / 2, 30);
      }
    };
    const onDown = (e) => { down = true; sc.setPointerCapture(e.pointerId); scratch(e); };
    const onUp = () => { down = false; };
    sc.addEventListener("pointerdown", onDown); sc.addEventListener("pointermove", scratch); sc.addEventListener("pointerup", onUp); sc.addEventListener("pointercancel", onUp);
    foil(); document.fonts?.ready.then(foil);
    return () => { sc.removeEventListener("pointerdown", onDown); sc.removeEventListener("pointermove", scratch); sc.removeEventListener("pointerup", onUp); sc.removeEventListener("pointercancel", onUp); };
  }, []);

  return (
    <div className="safe">
      <Rv d={0.1}><p className="eyebrow">A little surprise</p></Rv>
      <Rv d={0.3}><h2 className="script gold mid">Save the Date</h2></Rv>
      <Rv d={0.6}>
        <div className={`scr${done ? " done" : ""}`} id="scr" ref={wrap}>
          <div className="under">
            <span className="caps" style={{ fontSize: 9, color: "var(--gold)" }}>{weekday(main)}</span>
            <span className="script gold" style={{ fontSize: 30 }}>{shortName(main)}</span>
            <b className="caps" style={{ fontSize: 17, letterSpacing: ".12em", color: "var(--ink)" }}>{dateDots(main)}</b>
            <span className="sm scrtime">{timeText(main, data.settings.timingsTentative)}</span>
          </div>
          <canvas ref={canvas} width="440" height="440" style={{ opacity: done ? 0 : 1 }} aria-label="Scratch the gold seal to reveal the date" />
        </div>
      </Rv>
      <Rv d={0.9}><p className="caps hint" style={{ fontSize: 9.5, color: "var(--gold)" }} id="scrhint">{done ? "See you there, InshaAllah" : "Scratch the gold seal"}</p></Rv>
      {done && <a className="btn solid" href="#" id="savebtn" onClick={(e) => { e.preventDefault(); addToCalendar(main, data.settings.couple); }}>Save the Date</a>}
    </div>
  );
}

function CountdownBoxes({ target }) {
  const [now, setNow] = useState(null);                  // "--" until the first tick, like the original
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, target - (now ?? target));
  const v = now == null ? ["--", "--", "--", "--"] : [ms / 864e5, (ms / 36e5) % 24, (ms / 6e4) % 60, (ms / 1e3) % 60].map((n) => pad(Math.floor(n)));
  return (
    <div className="cd" id="cd">
      {["Days", "Hours", "Mins", "Secs"].map((label, i) => <div key={label}><b key={v[i]} className={now == null ? undefined : "flip"}>{v[i]}</b><span>{label}</span></div>)}
    </div>
  );
}

function Countdown({ data }) {
  const main = mainEvent(data.settings);
  return (
    <div className="safe">
      <Rv d={0.1} cls="wipe"><p className="ar gold" style={{ fontSize: 28 }}>إِنْ شَاءَ ٱللَّٰهُ</p></Rv>
      <Rv d={0.9}><p className="lead">Counting every moment to the</p></Rv>
      <Wide><Rv d={1.1}><h2 className="script gold big">{shortName(main)}</h2></Rv></Wide>
      <Rv d={1.4}><CountdownBoxes target={+eventStart(main)} /></Rv>
      <Orn d={0.8} />
      <Rv d={1.9}>
        <p className="caps" style={{ fontSize: 10.5, color: "var(--ink)" }}>{weekday(main)} · {dateLong(main)}</p>
        <p className="sm">{timeText(main, data.settings.timingsTentative)}</p>
      </Rv>
    </div>
  );
}

function Letter({ data }) {
  const { groom, bride } = data.settings.couple;
  return (
    <div className="safe">
      <Rv d={0.1}><p className="eyebrow">Our invitation</p></Rv>
      <Rv d={0.3}><h2 className="script gold" style={{ fontSize: "clamp(30px,8.6cqw,38px)" }}>Dear Family &amp; Friends</h2></Rv>
      <Orn d={0.25} />
      <Rv d={0.7}><p className="lead" style={{ fontSize: 17, maxWidth: "28ch" }}>By the grace of Allah, we joyfully invite you to share in our celebrations. Your presence, prayers and blessings would mean the world to us as we begin this new journey together.</p></Rv>
      <Rv d={1.2}><p className="sm" style={{ marginTop: 8 }}>With love,</p><p className="script gold" style={{ fontSize: 46 }}>{groom}&nbsp;<span style={{ fontSize: ".62em" }}>&amp;</span>&nbsp;{bride}</p></Rv>
    </div>
  );
}

function Events({ data }) {
  const { events, couple, timingsTentative: tentative } = data.settings;
  const [active, setActive] = useState(0);
  const onScroll = (e) => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth));
  return (
    <div className="safe">
      <Rv d={0.1}><p className="eyebrow">Celebrating together</p></Rv>
      <Rv d={0.3}><h2 className="script gold mid">Wedding Events</h2></Rv>
      <Orn d={0.4} />
      <Rv d={0.6}>
        <div className="evx" id="evx" onScroll={onScroll}>
          {events.map((e) => (
            <article className="ecard" key={e.key}>
              <p className="d1">{weekday(e)}</p><p className="d1">{dateLong(e)}</p>
              <p className="tm">{timeText(e, tentative)}</p>
              <p className="nm">{e.name}</p><p className="u">{e.ur}</p>
              <Pin w="20" h="24" /><p className="vn">{e.venue}</p><p className="ad">{e.addr}</p>
              <a className="ebtn" href={mapUrl(e)} target="_blank" rel="noopener" style={{ marginTop: 12 }}><Pin w="15" h="18" />Open in Maps</a>
              <a className="ebtn g" href="#" style={{ marginTop: 8 }} onClick={(ev) => { ev.preventDefault(); addToCalendar(e, couple); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" /></svg>Add to Calendar
              </a>
            </article>
          ))}
        </div>
      </Rv>
      <Rv d={0.8}>
        {events.length > 1 && (
          <>
            <div className="edots" id="edots">{events.map((e, i) => <i key={e.key} className={i === Math.min(active, events.length - 1) ? "on" : ""} />)}</div>
            <p className="caps" style={{ fontSize: 9.5, letterSpacing: ".26em", color: "var(--gold)", marginTop: 8 }}>Swipe for next event</p>
          </>
        )}
        {tentative && <p className="sm tent">{TENTATIVE_NOTE}</p>}
      </Rv>
    </div>
  );
}

function Gift({ data, burst }) {
  const { groom, bride } = data.settings.couple;
  const main = mainEvent(data.settings);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const g = [...groom][0] || "", b = [...bride][0] || "";
  const greeting = guestGroups(data).includes("barat") ? "Nikah Mubarak" : "Walima Mubarak";
  const dots = main ? dateDots(main) : "";

  // The box is static SVG art; its few text slots are filled as plain text.
  useLayoutEffect(() => {
    const text = { initials: `${g} & ${b}`, seal: `${g}&${b}`, greeting, dots };
    box.current.querySelectorAll("[data-t]").forEach((el) => { el.textContent = text[el.dataset.t] ?? ""; });
  }, [g, b, greeting, dots]);

  const toggle = () => {
    const next = !open; setOpen(next);
    if (next) { navigator.vibrate?.([15, 30, 15]); setTimeout(() => { const r = box.current?.getBoundingClientRect(); if (r) burst(r.left + r.width / 2, r.top, 26); }, 350); }
  };
  return (
    <div className={`safe${open ? " gift-open" : ""}`}>
      <Rv d={0.1}><p className="eyebrow">A sweet gesture</p></Rv>
      <Rv d={0.3}><h2 className="script gold mid">Shirini for You</h2></Rv>
      <div className="giftwrap" id="giftwrap">
        <div className={`hb${open ? " open" : ""}`} id="giftbox" ref={box} role="button" tabIndex={0} aria-label={open ? "Close the favour box" : "Open the favour box"}
          onClick={toggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }} dangerouslySetInnerHTML={GIFT_HTML} />
      </div>
      <p className="gmsg script gold" style={{ fontSize: 34 }}>Muh Meetha Kijiye!</p>
      <Rv d={0.6}><button className="btn solid" type="button" id="giftbtn" onClick={toggle}>{open ? "Close the box" : "Open your gift"}</button></Rv>
    </div>
  );
}

function Duas(props) {
  return (
    <div className="safe">
      <Rv d={0.1}><p className="eyebrow">RSVP</p></Rv>
      <Wide><Rv d={0.3}><h2 className="script gold mid">Send your Duas</h2></Rv></Wide>
      <Rsvp {...props} Rv={Rv} />
    </div>
  );
}

function Closing({ data }) {
  const { couple } = data.settings;
  const [label, setLabel] = useState(""), busy = label !== "";
  const dataRef = useRef(data); dataRef.current = data;
  const download = async () => {
    setLabel("Preparing your card…");
    try { const { downloadCard } = await import("../lib/card.js"); await downloadCard(dataRef.current); setLabel("Card downloaded"); }
    catch { setLabel("Could not make the card. Try again"); }
    setTimeout(() => setLabel(""), 2500);
  };
  return (
    <div className="safe">
      <Rv d={0.1} cls="wipe"><p className="ar gold" style={{ fontSize: 20, lineHeight: 1.9 }}>بَارَكَ اللَّهُ لَكُمَا وَبَارَكَ عَلَيْكُمَا<br />وَجَمَعَ بَيْنَكُمَا فِي خَيْرٍ</p></Rv>
      <Rv d={1.6}><p className="sm" style={{ fontStyle: "italic" }}>May Allah bless you both and unite you in goodness. Ameen.</p></Rv>
      <Orn d={0.8} />
      <h2 className="script gold" style={{ fontSize: "clamp(36px,10.5cqw,46px)", marginTop: 4 }}><Chars text={`${couple.groom} & ${couple.bride}`} d0={1.9} step={0.05} /></h2>
      <Rv d={2.6}><p className="caps" style={{ fontSize: 10, color: "var(--gold)" }}>{couple.hashtag}</p></Rv>
      <Rv d={2.9}><p className="sm" style={{ marginTop: 4 }}>With warm regards<br /><b>{couple.hosts}</b></p></Rv>
      <Rv d={3.1}><button className="btn solid" type="button" id="card" style={{ marginTop: 8 }} disabled={busy} onClick={download}>{label || "Download Invitation Card"}</button></Rv>
    </div>
  );
}

// Sections in page order. The date-driven ones need at least one event the guest can see.
export function buildSections(data) {
  const has = data.settings.events.length > 0;
  return [
    { id: "verse", kind: "frame", name: "Opening ayat", Body: Verse },
    { id: "qubool", kind: "couple", name: "Monogram · Qubool Hai", Body: Qubool },
    { id: "families", kind: "plain", name: "Bismillah & families", Body: Families },
    has && { id: "scratch", kind: "plain", name: "Scratch to reveal", Body: Scratch },
    has && { id: "countdown", kind: "frame", name: "Countdown", Body: Countdown },
    { id: "letter", kind: "plain", name: "Dear family letter", Body: Letter },
    has && { id: "events", kind: "plain", name: "Wedding events", Body: Events },
    { id: "gift", kind: "frame", name: "Favour box", Body: Gift },
    { id: "duas", kind: "frame", name: "Duas & RSVP", Body: Duas },
    { id: "closing", kind: "frame", name: "Closing dua", Body: Closing },
  ].filter(Boolean);
}

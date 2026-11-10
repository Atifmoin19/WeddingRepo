// RSVP: one yes/no per invited group, a headcount for families, an optional message. Saved to the API.
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { digits, groupLabel, guestGroups } from "../lib/format.js";

const joinAnd = (list) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0] || "");

export default function Rsvp({ data, code, burst, onRsvpSaved, Rv }) {
  const { guest, settings, rsvp } = data;
  const groups = guestGroups(data);
  const label = (g) => groupLabel(settings.events, g);
  const family = guest.party === "family";

  const [answers, setAnswers] = useState(() => ({ ...(rsvp?.attending || {}) }));
  const [headcount, setHeadcount] = useState(rsvp?.headcount || 1);
  const [message, setMessage] = useState(rsvp?.message || "");
  const [editing, setEditing] = useState(!rsvp);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const touched = useRef(false);
  const form = useRef(null);

  // A reply that arrives with a background refresh (e.g. sent from another phone) is shown, unless the guest is typing.
  const stamp = rsvp?.updatedAt || "";
  useEffect(() => {
    if (!rsvp || touched.current) return;
    setAnswers({ ...rsvp.attending }); setHeadcount(rsvp.headcount || 1); setMessage(rsvp.message || ""); setEditing(false);
  }, [stamp]);   // eslint-disable-line react-hooks/exhaustive-deps

  const touch = () => { touched.current = true; setError(""); };
  const anyYes = groups.some((g) => answers[g] === true);
  const started = groups.some((g) => typeof answers[g] === "boolean");

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    if (!groups.every((g) => typeof answers[g] === "boolean")) { setError("Please choose yes or no for each event."); return; }
    setSaving(true); setError("");
    try {
      const saved = await api(`/public/invite/${code}/rsvp`, {
        method: "POST",
        body: { attending: Object.fromEntries(groups.map((g) => [g, answers[g]])), headcount: family && anyYes ? headcount : 1, message: message.trim() },
      });
      touched.current = false;
      onRsvpSaved(saved); setEditing(false);
      const r = form.current?.getBoundingClientRect(); if (r) burst(r.left + r.width / 2, r.top + 40, 22);
    } catch (err) {
      setError(err.status === 404 ? "This invitation is no longer active. Please contact the family."
        : err.status === 422 || err.status === 429 ? "Your reply could not be saved. Please reload the page and try again."
        : "Your reply could not be sent. Please check your internet connection and try again.");
    } finally { setSaving(false); }
  }

  if (rsvp && !editing) {
    const saved = rsvp.attending || {};
    const yes = groups.filter((g) => saved[g] === true), no = groups.filter((g) => saved[g] === false);
    const { groom, bride } = settings.couple;
    const wa = digits(settings.contact?.whatsapp);
    const text = `Assalamu Alaikum! This is ${guest.name}. `
      + [yes.length && `InshaAllah I will attend the ${joinAnd(yes.map(label))}`, no.length && `${yes.length ? "sorry, I" : "Sorry, I"} will not be able to attend the ${joinAnd(no.map(label))}`].filter(Boolean).join(", but ")
      + ` of ${groom} & ${bride}.`
      + (family && yes.length ? ` We will be ${rsvp.headcount} ${rsvp.headcount === 1 ? "person" : "people"}.` : "")
      + (rsvp.message ? ` ${rsvp.message}` : "");
    return (
      <Rv d={0.5}>
        <div className="duaf" ref={form}>
          <div className="thanks" id="rsvpthanks">
            <p className="script gold" style={{ fontSize: 34 }}>JazakAllah Khair</p>
            <p className="sm" id="rsvpmsg">{yes.length
              ? `Thank you, ${guest.name}. We have noted your presence and look forward to seeing you.`
              : `Thank you for letting us know, ${guest.name}. Please keep us in your duas.`}</p>
            <ul className="reply" aria-label="Your reply">
              {groups.map((g) => <li key={g}><span>{label(g)}</span><b>{saved[g] === true ? "Attending" : saved[g] === false ? "Not attending" : "No reply yet"}</b></li>)}
              {family && yes.length > 0 && <li><span>Guests</span><b>{rsvp.headcount}</b></li>}
              {rsvp.message && <li className="msg">“{rsvp.message}”</li>}
            </ul>
            <button className="btn" type="button" id="rsvpchange" onClick={() => { touched.current = true; setEditing(true); }}>Change my reply</button>
            {wa && <a className="btn" id="rsvpwa" href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">Also message us on WhatsApp</a>}
          </div>
        </div>
      </Rv>
    );
  }

  return (
    <>
      <Rv d={0.5}><p className="lead rsvplead" style={{ fontSize: 17, maxWidth: "26ch" }}>Let us know you will be joining us, and keep us in your prayers.</p></Rv>
      <Rv d={0.8}>
        <form className="duaf" id="duaf" ref={form} noValidate onSubmit={submit}>
          {groups.map((g) => (
            <div className="grp" key={g}>
              <p className="lbl" id={`lbl-${g}`}>{label(g)}</p>
              <div className="seg" role="group" aria-labelledby={`lbl-${g}`}>
                <button type="button" aria-pressed={answers[g] === true} onClick={() => { touch(); setAnswers((a) => ({ ...a, [g]: true })); }}>InshaAllah, Yes</button>
                <button type="button" aria-pressed={answers[g] === false} onClick={() => { touch(); setAnswers((a) => ({ ...a, [g]: false })); }}>Can't make it</button>
              </div>
            </div>
          ))}
          {started && (
            <div className="fields" id="rsvpfields">
              {family && anyYes && (
                <div className="step" role="group" aria-label="How many of you will come?">
                  <span className="lbl">Guests coming</span>
                  <button type="button" aria-label="One less" disabled={headcount <= 1} onClick={() => { touch(); setHeadcount((n) => Math.max(1, n - 1)); }}>−</button>
                  <b aria-live="polite">{headcount}</b>
                  <button type="button" aria-label="One more" disabled={headcount >= 50} onClick={() => { touch(); setHeadcount((n) => Math.min(50, n + 1)); }}>+</button>
                </div>
              )}
              <input id="dt" name="t" placeholder="Your dua or message (optional)" aria-label="Your dua or message" maxLength={500} value={message} onChange={(e) => { touch(); setMessage(e.target.value); }} />
              {error && <p className="err" id="rsvperr" role="alert">{error}</p>}
              <button className="btn solid" type="submit" id="rsvpgo" disabled={saving} style={{ justifyContent: "center", marginTop: 6 }}>{saving ? "Sending…" : "Send reply"}</button>
              {rsvp && <button className="linkbtn" type="button" onClick={() => { touched.current = false; setAnswers({ ...rsvp.attending }); setHeadcount(rsvp.headcount || 1); setMessage(rsvp.message || ""); setError(""); setEditing(false); }}>Keep my earlier reply</button>}
            </div>
          )}
        </form>
      </Rv>
    </>
  );
}

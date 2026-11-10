// Event details tab: everything the invitation shows. Saved with PUT /admin/settings.
import { useState } from "react";

const COUPLE_FIELDS = [
  ["groom", "Groom (short name)"], ["groomFull", "Groom (full name)"], ["groomParents", "Groom's parents line"],
  ["bride", "Bride (short name)"], ["brideFull", "Bride (full name)"], ["brideParents", "Bride's parents line"],
  ["hosts", "Hosts line"], ["hashtag", "Hashtag"],
];
const EVENT_FIELDS = [
  ["name", "Name", {}], ["ur", "Urdu name", { dir: "rtl" }], ["date", "Date", { type: "date" }], ["time", "Time (drives countdown and calendar)", { type: "time" }],
  ["timeLabel", "Time label (shown while timings are tentative)", {}], ["venue", "Venue", {}], ["addr", "Address", {}],
  ["map", "Map link (empty = search by venue and address)", { type: "url", inputMode: "url" }],
];
const tidy = (msg) => String(msg || "Not valid").replace(/^Value error, /, "");

function Field({ id, label, error, children }) {
  return <label className={`fld${error ? " bad" : ""}`} htmlFor={id}><span>{label}</span>{children}{error && <em role="alert">{error}</em>}</label>;
}

export default function Settings({ settings, setSettings, call }) {
  const [draft, setDraft] = useState(() => structuredClone(settings));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ text: "", bad: false });
  const [saving, setSaving] = useState(false);

  const edit = (fn) => { setDraft((d) => { const n = structuredClone(d); fn(n); return n; }); setStatus({ text: "", bad: false }); };
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setErrors({}); setStatus({ text: "", bad: false });
    try {
      const saved = await call("/admin/settings", { method: "PUT", body: draft });
      setSettings(saved); setDraft(structuredClone(saved));
      setStatus({ text: "Saved. Open invitations pick up the change within a minute.", bad: false });
    } catch (err) {
      if (err.status === 401) return;
      if (err.status === 422 && Array.isArray(err.detail)) {
        const map = {}; const general = [];
        for (const d of err.detail) {
          const path = (d.loc || []).slice(1).join(".");
          if (path) map[path] = tidy(d.msg); else general.push(tidy(d.msg));
        }
        setErrors(map);
        const n = Object.keys(map).length;
        setStatus({ text: ["Not saved.", n ? `Please fix the ${n === 1 ? "field" : `${n} fields`} marked in red.` : "", ...general].filter(Boolean).join(" "), bad: true });
      } else setStatus({ text: typeof err.detail === "string" && err.status ? `Not saved. ${err.detail}` : "Not saved. Could not reach the server, try again.", bad: true });
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 14 }} noValidate>
      <div className="card">
        <h2>Couple and family</h2>
        <div className="row">
          {COUPLE_FIELDS.map(([k, label]) => (
            <Field key={k} id={`c-${k}`} label={label} error={errors[`couple.${k}`]}>
              <input id={`c-${k}`} value={draft.couple[k]} onChange={(e) => edit((d) => { d.couple[k] = e.target.value; })} />
            </Field>
          ))}
          <Field id="c-wa" label="WhatsApp number for replies (with country code, digits only)" error={errors["contact.whatsapp"]}>
            <input id="c-wa" inputMode="tel" value={draft.contact.whatsapp} onChange={(e) => edit((d) => { d.contact.whatsapp = e.target.value; })} />
          </Field>
        </div>
      </div>

      <div className="card">
        <h2>Timings</h2>
        <label className="chk"><input id="tentative" type="checkbox" checked={draft.timingsTentative} onChange={(e) => edit((d) => { d.timingsTentative = e.target.checked; })} />
          Timings are tentative (guests see each event's time label and a "to be confirmed" note)</label>
        <Field id="cdev" label="Countdown and scratch card count down to" error={errors.countdownEvent}>
          <select id="cdev" value={draft.countdownEvent} onChange={(e) => edit((d) => { d.countdownEvent = e.target.value; })}>
            {draft.events.map((ev) => <option key={ev.key} value={ev.key}>{ev.name || ev.key}</option>)}
          </select>
        </Field>
        <p>A guest who is not invited to that event sees the countdown for their own last event.</p>
      </div>

      <div className="card">
        <h2>Events</h2>
        {draft.events.map((ev, i) => (
          <div className="evbox" key={ev.key} data-event={ev.key}>
            <div className="row tight" style={{ justifyContent: "space-between" }}>
              <strong>{ev.name || ev.key} <span className="chip">{ev.group === "barat" ? "Barat guests" : "Walima guests"}</span></strong>
              <label className="chk"><input id={`e-${ev.key}-enabled`} type="checkbox" checked={ev.enabled} onChange={(e) => edit((d) => { d.events[i].enabled = e.target.checked; })} />Shown to guests</label>
            </div>
            <div className="row">
              {EVENT_FIELDS.map(([k, label, attrs]) => (
                <Field key={k} id={`e-${ev.key}-${k}`} label={label} error={errors[`events.${i}.${k}`]}>
                  <input id={`e-${ev.key}-${k}`} {...attrs} value={ev[k] ?? ""} onChange={(e) => edit((d) => { d.events[i][k] = e.target.value; })} />
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="savebar">
        {status.text && <p className={status.bad ? "err" : "ok"} role="status" id="savestatus">{status.text}</p>}
        <div className="row">
          <button className="primary" type="submit" id="savesettings" disabled={saving || !dirty}>{saving ? "Saving…" : dirty ? "Save changes" : "No changes to save"}</button>
          {dirty && <button type="button" style={{ flex: "0 0 auto" }} onClick={() => { setDraft(structuredClone(settings)); setErrors({}); setStatus({ text: "", bad: false }); }}>Undo edits</button>}
        </div>
      </div>
    </form>
  );
}

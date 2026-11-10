// Guests tab: add, import, edit, and send each guest their personal link on WhatsApp.
import { useEffect, useMemo, useRef, useState } from "react";
import { store } from "../lib/api.js";
import { groupLabel } from "../lib/format.js";

const K_MSG = "wd-admin-message";
const GROUPS = ["barat", "walima"];
const SITE = (import.meta.env.VITE_SITE_URL || location.origin).replace(/\/+$/, "");
export const inviteLink = (g) => `${SITE}/?g=${g.code}`;
const defaultMessage = (c) => `Assalamu Alaikum {name}! With the blessings of Allah, you are cordially invited to the wedding of ${c.groom} & ${c.bride}. This is your personal invitation:\n{link}`;
const problem = (err, fallback) => (err.status === 401 ? "" : typeof err.detail === "string" && err.status !== 0 ? err.detail
  : Array.isArray(err.detail) && err.detail[0]?.msg ? String(err.detail[0].msg).replace(/^Value error, /, "") : fallback);

function parseVcf(text) {
  return text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split(/END:VCARD/i).map((card) => {
    const name = (card.match(/^FN[^:\n]*:(.*)$/im) || [])[1];
    const tel = (card.match(/^(?:item\d+\.)?TEL[^:\n]*:(.*)$/im) || [])[1];
    return { name: name && name.trim(), phone: tel && tel.trim() };
  }).filter((c) => c.name);
}

function PartyToggle({ value, onChange, label }) {
  return (
    <div className="seg2" role="group" aria-label={label}>
      <button type="button" aria-pressed={value === "family"} onClick={() => value !== "family" && onChange("family")}>Family</button>
      <button type="button" aria-pressed={value === "single"} onClick={() => value !== "single" && onChange("single")}>Single</button>
    </div>
  );
}

function GuestRow({ g, picked, onPick, onPatch, onSend, onRemove, labels, showAdder }) {
  const [name, setName] = useState(g.name);
  const [phone, setPhone] = useState(g.phone);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setName(g.name), [g.name]);
  useEffect(() => setPhone(g.phone), [g.phone]);

  const patch = async (body) => { setError(""); try { await onPatch(g.id, body); return true; } catch (err) { setError(problem(err, "Could not save. Try again.")); return false; } };
  const saveName = async () => { const v = name.trim(); if (!v) { setName(g.name); return; } if (v !== g.name && !(await patch({ name: v }))) setName(g.name); };
  const savePhone = async () => { if (phone.trim() !== g.phone && !(await patch({ phone: phone.trim() }))) setPhone(g.phone); };
  const toggleGroup = (group, on) => {
    const next = GROUPS.filter((x) => (x === group ? on : g.invited.includes(x)));
    if (!next.length) { setError("A guest must be invited to at least one event."); return; }
    patch({ invited: next });
  };
  const copy = async () => {
    const link = inviteLink(g);
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { window.prompt("Copy this link", link); }
  };
  const blurOnEnter = (e) => { if (e.key === "Enter") e.currentTarget.blur(); };
  const att = g.rsvp?.attending || {};

  return (
    <div className="guest" data-guest={g.id}>
      <input type="checkbox" checked={picked} aria-label={`Include ${g.name} in Send next`} onChange={(e) => onPick(g.id, e.target.checked)} />
      <input value={name} aria-label="Name printed on the card" maxLength={200} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={blurOnEnter} />
      <div className="meta">
        <input className="phone" value={phone} inputMode="tel" placeholder="Phone with country code" aria-label="Phone number" maxLength={40} onChange={(e) => setPhone(e.target.value)} onBlur={savePhone} onKeyDown={blurOnEnter} />
        <PartyToggle value={g.party} label="Single or family" onChange={(party) => patch({ party })} />
      </div>
      <div className="meta">
        {GROUPS.map((group) => (
          <label className="chk" key={group}><input type="checkbox" checked={g.invited.includes(group)} onChange={(e) => toggleGroup(group, e.target.checked)} />{labels[group]}</label>
        ))}
      </div>
      <div className="meta">
        <span className={`chip${g.sentAt ? " on" : ""}`}>{g.sentAt ? "Sent" : "Not sent"}</span>
        <span className={`chip${g.openedAt ? " on" : ""}`}>{g.openedAt ? "Opened" : "Not opened"}</span>
        {g.rsvp
          ? g.invited.map((group) => (
            <span key={group} className={`chip${att[group] === true ? " on" : att[group] === false ? " no" : ""}`}>
              {group === "barat" ? "Barat" : "Walima"}: {att[group] === true ? "yes" : att[group] === false ? "no" : "no reply"}
            </span>
          ))
          : <span className="chip">No reply</span>}
        {g.rsvp && g.party === "family" && Object.values(att).some(Boolean) && <span className="chip on">{g.rsvp.headcount} coming</span>}
      </div>
      {showAdder && g.addedBy && <div className="meta addedby">added by {g.addedBy.name}</div>}
      <div className="meta">
        <button className="small" type="button" onClick={() => onSend(g)}>{g.sentAt ? "Send again" : "Send"}</button>
        <button className="small" type="button" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
        {confirm
          ? <><button className="small danger" type="button" onClick={() => onRemove(g).catch((err) => { setConfirm(false); setError(problem(err, "Could not remove. Try again.")); })}>Yes, remove</button><button className="small" type="button" onClick={() => setConfirm(false)}>Cancel</button></>
          : <button className="small" type="button" onClick={() => setConfirm(true)}>Remove</button>}
      </div>
      {confirm && <p className="meta err">Remove {g.name} and their reply? Their link will stop working.</p>}
      {error && <p className="meta err" role="alert">{error}</p>}
    </div>
  );
}

export default function Guests({ guests, setGuests, settings, call, me }) {
  const labels = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g, groupLabel(settings.events, g)])), [settings]);
  const fallbackMsg = defaultMessage(settings.couple);
  const [message, setMessage] = useState(() => store.get(K_MSG) || fallbackMsg);
  const [filter, setFilter] = useState("");
  const isOwner = me?.role === "owner";
  const [by, setBy] = useState("");                             // owner only: show one admin's guests
  const adders = useMemo(() => [...new Map(guests.filter((g) => g.addedBy).map((g) => [g.addedBy.id, g.addedBy.name])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])), [guests]);
  const byId = adders.some(([id]) => id === by) ? by : "";      // that admin's last guest may have gone
  const [skip, setSkip] = useState(() => new Set());          // guests left out of "Send next"
  const [form, setForm] = useState({ name: "", phone: "", party: "family", barat: true, walima: true });
  const [note, setNote] = useState({ text: "", bad: false });
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  const canPick = "contacts" in navigator && "select" in navigator.contacts;

  const say = (text, bad = false) => setNote({ text, bad });
  const invitedOf = () => GROUPS.filter((g) => form[g]);
  const replace = (g) => setGuests((list) => list.map((x) => (x.id === g.id ? g : x)));

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return say("Type the guest's name first.", true);
    if (!invitedOf().length) return say("Choose at least one event.", true);
    setBusy(true);
    try {
      const g = await call("/admin/guests", { method: "POST", body: { name: form.name, phone: form.phone, party: form.party, invited: invitedOf() } });
      setGuests((list) => [g, ...list]); setForm((f) => ({ ...f, name: "", phone: "" })); say("Guest added.");
    } catch (err) { say(problem(err, "Could not add the guest. Try again."), true); }
    finally { setBusy(false); }
  };

  const importList = async (list) => {
    const clean = list.map((c) => ({ name: (c.name || "").trim().slice(0, 200), phone: (c.phone || "").trim().slice(0, 40) })).filter((c) => c.name);
    if (!clean.length) return say("No contacts with a name were found.", true);
    if (!invitedOf().length) return say("Choose at least one event for the imported guests.", true);
    setBusy(true);
    try {
      let added = 0, skipped = 0; const fresh = [];
      for (let i = 0; i < clean.length; i += 500) {
        const res = await call("/admin/guests/bulk", { method: "POST", timeout: 60000, body: { guests: clean.slice(i, i + 500).map((c) => ({ ...c, party: form.party, invited: invitedOf() })) } });
        added += res.added; skipped += res.skipped; fresh.unshift(...res.guests);
      }
      setGuests((g) => [...fresh, ...g]);
      say(`${added} added${skipped ? `, ${skipped} skipped (phone number already in the list)` : ""}.`);
    } catch (err) { say(problem(err, "Could not import the contacts. Try again."), true); }
    finally { setBusy(false); }
  };
  const pickContacts = async () => {
    let picked;
    try { picked = await navigator.contacts.select(["name", "tel"], { multiple: true }); } catch { return; }   // picker closed
    importList(picked.map((c) => ({ name: c.name?.[0], phone: c.tel?.[0] })));
  };
  const onFile = async (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importList(parseVcf(await f.text())); };

  // Edits are sent one after another, so a slow earlier answer can never overwrite a newer one on screen.
  const queue_ = useRef(Promise.resolve());
  const onPatch = (id, body) => {
    const run = queue_.current.then(async () => replace(await call(`/admin/guests/${id}`, { method: "PATCH", body })));
    queue_.current = run.catch(() => {});
    return run;
  };
  const onRemove = async (g) => { await call(`/admin/guests/${g.id}`, { method: "DELETE" }); setGuests((list) => list.filter((x) => x.id !== g.id)); };
  const onSend = async (g) => {
    const text = message.replace(/\{name\}/g, g.name).replace(/\{link\}/g, inviteLink(g));
    window.open(`https://wa.me/${g.phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    try { await onPatch(g.id, { sent: true }); } catch (err) { say(problem(err, `WhatsApp was opened, but ${g.name} could not be marked as sent.`), true); }
  };
  const saveMessage = (v) => { const m = v.includes("{link}") ? v : `${v.trimEnd()}\n{link}`; setMessage(m); store.set(K_MSG, m); };

  const q = filter.trim().toLowerCase();
  const shown = guests.filter((g) => (!byId || g.addedBy?.id === byId) && (!q || `${g.name} ${g.phone}`.toLowerCase().includes(q)));
  const queue = guests.filter((g) => !skip.has(g.id) && !g.sentAt && g.phone);
  const allPicked = shown.length > 0 && shown.every((g) => !skip.has(g.id));
  const count = (f) => guests.filter(f).length;

  return (
    <>
      <p>{guests.length} guests · {count((g) => g.sentAt)} sent · {count((g) => g.openedAt)} opened · {count((g) => g.rsvp)} replied</p>

      <form className="card" onSubmit={add} aria-label="Add guest">
        <h2>Add guest</h2>
        <div className="row">
          <input id="new-name" placeholder="Name on the card, e.g. Khan Sahab & Family" aria-label="Guest name as printed on the card" maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input id="new-phone" placeholder="Phone number" inputMode="tel" aria-label="Phone number" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="row tight">
          <PartyToggle value={form.party} label="Single or family" onChange={(party) => setForm({ ...form, party })} />
          {GROUPS.map((g) => <label className="chk" key={g}><input type="checkbox" checked={form[g]} onChange={(e) => setForm({ ...form, [g]: e.target.checked })} />{labels[g]}</label>)}
        </div>
        <button className="primary" type="submit" disabled={busy}>Add guest</button>
        <div className="row">
          {canPick && <button type="button" disabled={busy} onClick={pickContacts}>Pick from phone contacts</button>}
          <button type="button" disabled={busy} onClick={() => file.current.click()}>Import contacts file (.vcf)</button>
        </div>
        <input ref={file} id="vcf" type="file" accept=".vcf,text/vcard,text/x-vcard" hidden onChange={onFile} />
        <p>Imported contacts get the Family / Single choice and the events ticked above. A 10-digit number is treated as Indian (+91).{!canPick && " This browser cannot open your contacts directly: on Android use Chrome, on iPhone export contacts as a .vcf file and import it here."}</p>
        {note.text && <p className={note.bad ? "err" : "ok"} role="status">{note.text}</p>}
      </form>

      <details className="card">
        <summary>WhatsApp message</summary>
        <p>Sent with each link. {"{name}"} and {"{link}"} are filled in for each guest.</p>
        <textarea id="msg" aria-label="Message template" value={message} onChange={(e) => setMessage(e.target.value)} onBlur={(e) => saveMessage(e.target.value)} />
        <button className="small" type="button" onClick={() => saveMessage(fallbackMsg)}>Reset message</button>
      </details>

      <div className="card">
        <div className="row">
          <input id="search" placeholder="Search guests" aria-label="Search guests" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {isOwner && adders.length > 1 && (
            <select id="byadmin" aria-label="Show guests added by" value={byId} onChange={(e) => setBy(e.target.value)}>
              <option value="">Added by anyone</option>
              {adders.map(([id, name]) => <option key={id} value={id}>Added by {name}</option>)}
            </select>
          )}
          <button className="small" type="button" style={{ flex: "0 0 auto" }} disabled={!shown.length}
            onClick={() => setSkip((s) => { const n = new Set(s); shown.forEach((g) => (allPicked ? n.add(g.id) : n.delete(g.id))); return n; })}>{allPicked ? "Unselect all" : "Select all"}</button>
        </div>
        <div>
          {shown.length
            ? shown.map((g) => <GuestRow key={g.id} g={g} labels={labels} showAdder={isOwner} picked={!skip.has(g.id)} onPatch={onPatch} onSend={onSend} onRemove={onRemove}
              onPick={(id, on) => setSkip((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; })} />)
            : <p className="empty">{guests.length ? (byId && !q ? "No guests added by this admin." : "No guest matches that search.") : "No guests yet. Add them above."}</p>}
        </div>
      </div>
      <p>The name in each box is what is printed on that guest's envelope and card. Ticked guests are included in "Send next".</p>

      <div className="bar"><div>
        <button className="primary" type="button" id="sendnext" disabled={!queue.length} onClick={() => onSend(queue[0])}>
          {queue.length ? `Send next: ${queue[0].name} (${queue.length} left)` : "Nothing left to send"}
        </button>
      </div></div>
    </>
  );
}

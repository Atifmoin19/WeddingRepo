// Admins tab (owner only): who else may use this panel. Each admin sees only the guests they added.
import { useCallback, useEffect, useState } from "react";

const problem = (err, fallback) => (err.status === 401 ? "" : typeof err.detail === "string" && err.status !== 0 ? err.detail
  : Array.isArray(err.detail) && err.detail[0]?.msg ? String(err.detail[0].msg).replace(/^Value error, /, "") : fallback);

function AdminRow({ a, onPatch, onRemove }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const owner = a.role === "owner";
  const run = async (fn, fallback) => { setBusy(true); setError(""); try { await fn(); } catch (err) { setConfirm(false); setError(problem(err, fallback)); } finally { setBusy(false); } };

  return (
    <div className="admin-item" data-admin={a.email}>
      <div className="row tight" style={{ justifyContent: "space-between" }}>
        <span className="who">{a.name}</span>
        <span className="row tight">
          <span className={`chip${owner ? " on" : ""}`}>{owner ? "Owner" : "Admin"}</span>
          <span className={`chip${a.active ? " on" : " no"}`}>{a.active ? "Active" : "Inactive"}</span>
        </span>
      </div>
      <p className="contact">{a.email}{a.phone ? ` · +${a.phone}` : ""}</p>
      <p>{a.guestCount} {a.guestCount === 1 ? "guest" : "guests"} added</p>
      {!owner && (
        <div className="row tight">
          <button className="small" type="button" disabled={busy} onClick={() => run(() => onPatch(a, { active: !a.active }), "Could not save. Try again.")}>{a.active ? "Deactivate" : "Activate"}</button>
          {confirm
            ? <><button className="small danger" type="button" disabled={busy} onClick={() => run(() => onRemove(a), "Could not remove. Try again.")}>Yes, remove</button><button className="small" type="button" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button></>
            : <button className="small" type="button" disabled={busy} onClick={() => setConfirm(true)}>Remove</button>}
        </div>
      )}
      {confirm && <p className="err">Remove {a.name}? They are logged out at once. {a.guestCount ? `Their ${a.guestCount === 1 ? "guest stays" : `${a.guestCount} guests stay`} in the list and become${a.guestCount === 1 ? "s" : ""} yours.` : "They have not added any guests."}</p>}
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}

export default function Admins({ call }) {
  const [admins, setAdmins] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [note, setNote] = useState({ text: "", bad: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError("");
    try { setAdmins(await call("/admin/admins", { timeout: 90000 })); }
    catch (err) { if (err.status !== 401) setLoadError("Could not load the admins. Try again."); }
  }, [call]);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setNote({ text: "Type the admin's name first.", bad: true });
    if (!form.email.trim()) return setNote({ text: "Type the admin's email: login codes are sent to it.", bad: true });
    setBusy(true);
    try {
      const a = await call("/admin/admins", { method: "POST", body: { name: form.name, email: form.email, phone: form.phone } });
      setAdmins((list) => [...(list || []), a]); setForm({ name: "", email: "", phone: "" });
      setNote({ text: `${a.name} can now log in with a code sent to ${a.email}.`, bad: false });
    } catch (err) { setNote({ text: problem(err, "Could not add the admin. Try again."), bad: true }); }
    finally { setBusy(false); }
  };
  const onPatch = async (a, body) => { const next = await call(`/admin/admins/${a.id}`, { method: "PATCH", body }); setAdmins((list) => list.map((x) => (x.id === a.id ? next : x))); };
  const onRemove = async (a) => { await call(`/admin/admins/${a.id}`, { method: "DELETE" }); await load(); };   // reload: their guests are now the owner's

  return (
    <>
      <form className="card" onSubmit={add} aria-label="Add admin">
        <h2>Add admin</h2>
        <div className="row">
          <input id="adm-name" placeholder="Name" aria-label="Admin's name" maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input id="adm-email" type="email" placeholder="Email address" aria-label="Admin's email address" autoCapitalize="none" spellCheck={false} maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input id="adm-phone" placeholder="Phone number (optional)" inputMode="tel" aria-label="Admin's phone number (optional)" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <button className="primary" type="submit" disabled={busy}>Add admin</button>
        <p>An admin logs in with a code emailed to this address. They can add guests and see only the guests and replies they added themselves; they cannot change event details or other admins.</p>
        {note.text && <p className={note.bad ? "err" : "ok"} role="status">{note.text}</p>}
      </form>

      <div className="card">
        <h2>Admins{admins ? ` (${admins.length})` : ""}</h2>
        {loadError && <><p className="err" role="alert">{loadError}</p><button type="button" onClick={load}>Try again</button></>}
        {!loadError && !admins && <p>Loading…</p>}
        {admins && <div>{admins.map((a) => <AdminRow key={a.id} a={a} onPatch={onPatch} onRemove={onRemove} />)}</div>}
      </div>
    </>
  );
}

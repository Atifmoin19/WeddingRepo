// Replies tab: totals per group, every reply with its message, and the CSV download.
import { useState } from "react";
import { groupLabel } from "../lib/format.js";

const GROUPS = ["barat", "walima"];
const when = (iso) => { try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch { return ""; } };

export default function Replies({ guests, settings, call, reload }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const totals = GROUPS.map((group) => {
    const invited = guests.filter((g) => g.invited.includes(group));
    const yes = invited.filter((g) => g.rsvp?.attending?.[group] === true);
    const no = invited.filter((g) => g.rsvp?.attending?.[group] === false);
    return { group, label: groupLabel(settings.events, group), invited: invited.length, yes: yes.length, no: no.length,
      none: invited.length - yes.length - no.length, heads: yes.reduce((n, g) => n + (g.party === "family" ? g.rsvp.headcount || 1 : 1), 0) };
  });
  const replies = guests.filter((g) => g.rsvp).sort((a, b) => String(b.rsvp.updatedAt).localeCompare(String(a.rsvp.updatedAt)));

  const download = async () => {
    setBusy(true); setNote("");
    try {
      const res = await call("/admin/export.csv", { raw: true, timeout: 60000 });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await res.blob()); a.download = "wedding-guests.csv";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    } catch (err) { if (err.status !== 401) setNote("Could not download the file. Try again."); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="card">
        <h2>Totals</h2>
        <table className="tot">
          <thead><tr><th scope="col">Event</th><th scope="col">Invited</th><th scope="col">Yes</th><th scope="col">No</th><th scope="col">No reply</th><th scope="col">People coming</th></tr></thead>
          <tbody>
            {totals.map((t) => <tr key={t.group} data-group={t.group}><th scope="row">{t.label}</th><td>{t.invited}</td><td>{t.yes}</td><td>{t.no}</td><td>{t.none}</td><td><b>{t.heads}</b></td></tr>)}
          </tbody>
        </table>
        <p>"People coming" adds up the headcount of families who said yes, and counts 1 for each single guest.</p>
        <div className="row">
          <button className="primary" type="button" id="csv" disabled={busy} onClick={download}>{busy ? "Preparing…" : "Download CSV"}</button>
          <button type="button" onClick={reload}>Refresh</button>
        </div>
        {note && <p className="err" role="alert">{note}</p>}
      </div>

      <div className="card">
        <h2>Replies ({replies.length})</h2>
        <div>
          {replies.length ? replies.map((g) => {
            const att = g.rsvp.attending || {};
            return (
              <div className="reply-item" key={g.id}>
                <div className="row tight" style={{ justifyContent: "space-between" }}><span className="who">{g.name}</span><span style={{ fontSize: 12, color: "var(--soft)" }}>{when(g.rsvp.updatedAt)}</span></div>
                <div className="row tight">
                  {g.invited.map((group) => (
                    <span key={group} className={`chip${att[group] === true ? " on" : att[group] === false ? " no" : ""}`}>{group === "barat" ? "Barat" : "Walima"}: {att[group] === true ? "yes" : att[group] === false ? "no" : "no reply"}</span>
                  ))}
                  {g.party === "family" && Object.values(att).some(Boolean) && <span className="chip on">{g.rsvp.headcount} coming</span>}
                </div>
                {g.rsvp.message && <p className="said">“{g.rsvp.message}”</p>}
              </div>
            );
          }) : <p className="empty">No replies yet.</p>}
        </div>
      </div>
    </>
  );
}

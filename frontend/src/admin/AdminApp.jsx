// Host panel at /admin: password login, then Guests / Event details / Replies.
import "./admin.css";
import { useCallback, useEffect, useState } from "react";
import { api, store } from "../lib/api.js";
import Guests from "./Guests.jsx";
import Settings from "./Settings.jsx";
import Replies from "./Replies.jsx";

const K_TOKEN = "wd-admin-token", K_TAB = "wd-admin-tab";
const TABS = [["guests", "Guests"], ["settings", "Event details"], ["replies", "Replies"]];

function Login({ onToken, notice }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true); setError("");
    try { onToken((await api("/admin/login", { method: "POST", body: { password }, timeout: 90000 })).token); }
    catch (err) {
      setError(err.status === 401 ? "That password is not right. Try again."
        : err.status === 429 ? "Too many attempts. Wait 15 minutes and try again."
        : "Could not reach the server. It may be waking up: wait a minute and try again.");
    } finally { setBusy(false); }
  };
  return (
    <main className="adm">
      <h1>Wedding admin</h1>
      <form className="card" onSubmit={go}>
        <p>{notice || "Enter the host password to manage guests, event details and replies."}</p>
        <input id="pass" type="password" placeholder="Password" autoComplete="current-password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="err" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Logging in… (the server can take a minute to wake)" : "Log in"}</button>
      </form>
    </main>
  );
}

export default function AdminApp() {
  const [token, setToken] = useState(() => store.get(K_TOKEN));
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState(() => (TABS.some(([k]) => k === store.get(K_TAB)) ? store.get(K_TAB) : "guests"));
  const [guests, setGuests] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    document.title = "Wedding admin";
    const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex, nofollow"; document.head.appendChild(m);
    return () => m.remove();
  }, []);

  const logout = useCallback((why = "") => { store.del(K_TOKEN); setToken(null); setGuests(null); setSettings(null); setNotice(why); }, []);

  // Every admin request goes through here: adds the token, and any 401 returns to the login screen.
  const call = useCallback(async (path, opts = {}) => {
    try { return await api(path, { ...opts, token }); }
    catch (err) { if (err.status === 401) logout("Your session has ended. Please log in again."); throw err; }
  }, [token, logout]);

  const reload = useCallback(async () => {
    setLoadError("");
    try {
      const [g, s] = await Promise.all([call("/admin/guests", { timeout: 90000 }), call("/admin/settings", { timeout: 90000 })]);
      setGuests(g); setSettings(s);
    } catch (err) { if (err.status !== 401) setLoadError("Could not load the data. The server may be waking up: try again in a minute."); }
  }, [call]);

  useEffect(() => { if (token) reload(); }, [token, reload]);

  if (!token) return <Login notice={notice} onToken={(t) => { store.set(K_TOKEN, t); setNotice(""); setToken(t); }} />;

  const pick = (k) => { setTab(k); store.set(K_TAB, k); if (k !== "settings") reload(); };
  return (
    <main className="adm">
      <div className="head"><h1>Wedding admin</h1><button className="small" type="button" onClick={() => logout()}>Log out</button></div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} onClick={() => pick(k)}>{label}</button>)}
      </div>
      {loadError && <div className="card"><p className="err" role="alert">{loadError}</p><button type="button" onClick={reload}>Try again</button></div>}
      {!loadError && (!guests || !settings) && <p>Loading…</p>}
      {guests && settings && tab === "guests" && <Guests guests={guests} setGuests={setGuests} settings={settings} call={call} />}
      {guests && settings && tab === "settings" && <Settings settings={settings} setSettings={setSettings} call={call} />}
      {guests && settings && tab === "replies" && <Replies guests={guests} settings={settings} call={call} reload={reload} />}
    </main>
  );
}

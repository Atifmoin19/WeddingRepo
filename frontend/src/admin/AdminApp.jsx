// Host panel at /admin: email + code login, then Guests / Event details / Replies / Admins (by role).
import "./admin.css";
import { useCallback, useEffect, useState } from "react";
import { api, store } from "../lib/api.js";
import Guests from "./Guests.jsx";
import Settings from "./Settings.jsx";
import Replies from "./Replies.jsx";
import Admins from "./Admins.jsx";

const K_TOKEN = "wd-admin-token", K_TAB = "wd-admin-tab";
const OWNER_TABS = [["guests", "Guests"], ["settings", "Event details"], ["replies", "Replies"], ["admins", "Admins"]];
const ADMIN_TABS = [["guests", "Guests"], ["replies", "Replies"]];
const RESEND_AFTER = 60;   // seconds, same as the API's one-code-per-minute limit
const WAKING = "Could not reach the server. It may be waking up: wait a minute and try again.";
const tooMany = (err, fallback) => (typeof err.detail === "string" && /code/i.test(err.detail) ? err.detail : fallback);

function PasswordLogin({ onToken, notice, onBack }) {
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
        : WAKING);
    } finally { setBusy(false); }
  };
  return (
    <form className="card" onSubmit={go} aria-label="Log in with the password">
      <p>{notice || "Enter the host password to manage guests, event details and replies."}</p>
      <input id="pass" type="password" placeholder="Password" autoComplete="current-password" aria-label="Password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="err" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={busy}>{busy ? "Logging in… (the server can take a minute to wake)" : "Log in"}</button>
      <button className="link" type="button" id="useemail" onClick={onBack}>Use an email code instead</button>
    </form>
  );
}

function CodeLogin({ onToken, notice, onPassword }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);          // seconds until "Resend code" is enabled

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // Asks the API to email a code. The answer is the same whether or not the email is an admin's.
  const request = async (again) => {
    const addr = email.trim();
    if (!addr || busy) return;
    setBusy(true); setError(""); setInfo("");
    try {
      await api("/admin/otp/request", { method: "POST", body: { email: addr }, timeout: 90000 });
      setStep("code"); setCode(""); setWait(RESEND_AFTER);
      if (again) setInfo("A new code is on its way. The earlier code no longer works.");
    } catch (err) {
      if (err.status === 429) { setError(tooMany(err, "Too many codes requested. Wait a while and try again.")); if (again) setWait(RESEND_AFTER); }
      else setError(err.status === 422 ? "That does not look like an email address." : WAKING);
    } finally { setBusy(false); }
  };

  const verify = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (code.length !== 6) { setError("Type all 6 digits of the code."); return; }
    setBusy(true); setError(""); setInfo("");
    try { onToken((await api("/admin/otp/verify", { method: "POST", body: { email: email.trim(), code }, timeout: 90000 })).token); }
    catch (err) {
      setCode("");
      setError(err.status === 401 || err.status === 422 ? "That code is not right or has expired. Check the latest email, or ask for a new code."
        : err.status === 429 ? "Too many attempts. Wait 15 minutes and try again."
        : WAKING);
    } finally { setBusy(false); }
  };

  if (step === "email") {
    return (
      <form className="card" onSubmit={(e) => { e.preventDefault(); request(false); }} aria-label="Log in with your email">
        <p>{notice || "Enter your email and we will send you a 6-digit login code."}</p>
        <input id="email" type="email" placeholder="Email address" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} aria-label="Email address" maxLength={254} autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <p className="err" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy || !email.trim()}>{busy ? "Sending… (the server can take a minute to wake)" : "Send code"}</button>
        <button className="link" type="button" id="usepass" onClick={onPassword}>Use password instead</button>
      </form>
    );
  }
  return (
    <form className="card" onSubmit={verify} aria-label="Enter the login code">
      <p>If <b>{email.trim()}</b> belongs to an admin, a 6-digit code has been emailed to it. The code works once and expires in 10 minutes.</p>
      <input id="code" className="code" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" placeholder="••••••" aria-label="6-digit code" autoFocus
        value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} />
      {error && <p className="err" role="alert">{error}</p>}
      {info && !error && <p className="ok" role="status">{info}</p>}
      <button className="primary" type="submit" disabled={busy}>{busy ? "Checking…" : "Log in"}</button>
      <div className="row tight">
        <button className="small" type="button" id="resend" disabled={busy || wait > 0} onClick={() => request(true)}>{wait > 0 ? `Resend code (in ${wait} s)` : "Resend code"}</button>
        <button className="link" type="button" id="changeemail" onClick={() => { setStep("email"); setError(""); setInfo(""); }}>Use a different email</button>
      </div>
      <button className="link" type="button" id="usepass" onClick={onPassword}>Use password instead</button>
    </form>
  );
}

function Login({ onToken, notice }) {
  const [mode, setMode] = useState("code");
  return (
    <main className="adm">
      <h1>Wedding admin</h1>
      {mode === "code"
        ? <CodeLogin onToken={onToken} notice={notice} onPassword={() => setMode("password")} />
        : <PasswordLogin onToken={onToken} notice={notice} onBack={() => setMode("code")} />}
    </main>
  );
}

export default function AdminApp() {
  const [token, setToken] = useState(() => store.get(K_TOKEN));
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState(() => store.get(K_TAB) || "guests");
  const [me, setMe] = useState(null);
  const [guests, setGuests] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    document.title = "Wedding admin";
    const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex, nofollow"; document.head.appendChild(m);
    return () => m.remove();
  }, []);

  const logout = useCallback((why = "") => { store.del(K_TOKEN); setToken(null); setMe(null); setGuests(null); setSettings(null); setNotice(why); }, []);

  // Every admin request goes through here: adds the token, and any 401 returns to the login screen.
  const call = useCallback(async (path, opts = {}) => {
    try { return await api(path, { ...opts, token }); }
    catch (err) { if (err.status === 401) logout("Your session has ended. Please log in again."); throw err; }
  }, [token, logout]);

  const reload = useCallback(async () => {
    setLoadError("");
    try {
      const [m, g, s] = await Promise.all([call("/admin/me", { timeout: 90000 }), call("/admin/guests", { timeout: 90000 }), call("/admin/settings", { timeout: 90000 })]);
      setMe(m); setGuests(g); setSettings(s);
    } catch (err) { if (err.status !== 401) setLoadError("Could not load the data. The server may be waking up: try again in a minute."); }
  }, [call]);

  useEffect(() => { if (token) reload(); }, [token, reload]);

  if (!token) return <Login notice={notice} onToken={(t) => { store.set(K_TOKEN, t); setNotice(""); setToken(t); }} />;

  const ready = me && guests && settings;
  const tabs = me?.role === "owner" ? OWNER_TABS : ADMIN_TABS;
  const shown = tabs.some(([k]) => k === tab) ? tab : "guests";   // a remembered tab this role may not have
  const pick = (k) => { setTab(k); store.set(K_TAB, k); if (k !== "settings") reload(); };
  return (
    <main className="adm">
      <div className="head">
        <h1>Wedding admin</h1>
        <div className="who">{me && <span id="me" title={me.email}>{me.name}{me.role === "owner" ? " (owner)" : ""}</span>}<button className="small" type="button" id="logout" onClick={() => logout()}>Log out</button></div>
      </div>
      {me && (
        <div className="tabs" role="tablist">
          {tabs.map(([k, label]) => <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={shown === k} onClick={() => pick(k)}>{label}</button>)}
        </div>
      )}
      {loadError && <div className="card"><p className="err" role="alert">{loadError}</p><button type="button" onClick={reload}>Try again</button></div>}
      {!loadError && !ready && <p>Loading…</p>}
      {ready && shown === "guests" && <Guests guests={guests} setGuests={setGuests} settings={settings} call={call} me={me} />}
      {ready && shown === "settings" && <Settings settings={settings} setSettings={setSettings} call={call} />}
      {ready && shown === "replies" && <Replies guests={guests} settings={settings} call={call} reload={reload} />}
      {ready && shown === "admins" && <Admins call={call} me={me} />}
    </main>
  );
}

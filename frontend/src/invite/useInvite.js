// Loads the guest's invitation from the API.
// - code comes from ?g=, or the last code that worked on this device
// - the last good response is cached, shown at once on later visits and refreshed in the background
// - the API can take up to a minute to wake: retry with backoff for ~90 s before giving up
// - re-checks every 60 s and when the tab becomes visible, so admin edits appear without a reload
import { useCallback, useEffect, useRef, useState } from "react";
import { api, store } from "../lib/api.js";

const K_CODE = "wd-invite-code", K_CACHE = "wd-invite-cache";
const WAKE_BUDGET = 90000, REFRESH_EVERY = 60000;
const CODE_RE = /^[a-z0-9]{4,32}$/;
const clean = (c) => { const s = String(c || "").trim().toLowerCase(); return CODE_RE.test(s) ? s : ""; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function candidates() {
  const fromUrl = clean(new URLSearchParams(location.search).get("g"));
  const saved = clean(store.get(K_CODE));
  return [...new Set([fromUrl, saved].filter(Boolean))];
}

function cached(code) {
  const c = store.get(K_CACHE);
  return c && c.code === code && c.data?.guest && c.data?.settings ? c.data : null;
}

export function useInvite() {
  const [state, setState] = useState(() => {
    const codes = candidates();                       // the link's own code wins over the remembered one
    if (!codes.length) return { status: "locked", code: "", data: null };
    const data = cached(codes[0]);
    return { status: data ? "ready" : "loading", code: codes[0], data };
  });
  const stateRef = useRef(state); stateRef.current = state;
  const busy = useRef(false);

  const accept = useCallback((code, data) => {
    store.set(K_CODE, code); store.set(K_CACHE, { code, data });
    setState((s) => (s.status === "ready" && s.code === code && JSON.stringify(s.data) === JSON.stringify(data) ? s : { status: "ready", code, data }));
  }, []);

  // Tries each code in turn. Unknown code (404) moves on to the next; a sleeping or unreachable API is retried.
  const load = useCallback(async (patient) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const current = stateRef.current;
      const codes = current.status === "ready" ? [current.code] : candidates();
      const until = Date.now() + (patient ? WAKE_BUDGET : 0);
      for (const code of codes) {
        for (let attempt = 0; ; attempt++) {
          try {
            const left = until - Date.now();
            accept(code, await api(`/public/invite/${code}`, { timeout: patient ? Math.max(8000, Math.min(45000, left)) : 20000 }));
            return;
          } catch (err) {
            if (err.status === 404) {
              if (store.get(K_CODE) === code) { store.del(K_CODE); store.del(K_CACHE); }
              break;                                                    // not an invitation: try the next code
            }
            const wait = Math.min(8000, 1000 * 2 ** attempt);
            if (Date.now() + wait >= until) {
              if (patient) setState((s) => (s.status === "loading" ? { ...s, status: "error" } : s));
              return;                                                   // background refresh: keep what is on screen
            }
            await sleep(wait);
          }
        }
      }
      setState({ status: "locked", code: "", data: null });
    } finally { busy.current = false; }
  }, [accept]);

  useEffect(() => {
    if (stateRef.current.status === "locked") return;
    load(stateRef.current.status === "loading");
    const refresh = () => { if (!document.hidden && stateRef.current.status === "ready") load(false); };
    const timer = setInterval(refresh, REFRESH_EVERY);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  const retry = useCallback(() => { setState((s) => ({ ...s, status: "loading" })); stateRef.current = { ...stateRef.current, status: "loading" }; load(true); }, [load]);

  // After the guest saves a reply: show it at once and keep the cache in step.
  const setRsvp = useCallback((rsvp) => {
    setState((s) => {
      if (s.status !== "ready") return s;
      const data = { ...s.data, rsvp };
      store.set(K_CACHE, { code: s.code, data });
      return { ...s, data };
    });
  }, []);

  return { ...state, retry, setRsvp };
}

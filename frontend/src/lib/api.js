// Thin fetch wrapper for the wedding API.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8004").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : "Request failed");
    this.status = status;      // 0 = network problem or timeout
    this.detail = detail;      // string, or FastAPI's list of validation errors
  }
}

export async function api(path, { method = "GET", body, token, timeout = 30000, raw = false } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      signal: ctl.signal,
      cache: "no-store",
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Could not reach the server");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch { /* not JSON */ }
    throw new ApiError(res.status, detail);
  }
  if (raw) return res;
  return res.status === 204 ? null : res.json();
}

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

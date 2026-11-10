// Personal invite links.
// A link carries the guest's name plus a signature made with a private key that never leaves the
// host's computer (see scripts/invite.mjs). The site holds only the public key, so it can check a
// link but nobody can create a new one from the site's code.
import { INVITE_PUBLIC_KEY } from "./invite-key.js";

const PREFIX = "walima-invite-v1|";
const STORE = "walima-invite";

const fromB64Url = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function verify(token) {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !globalThis.crypto?.subtle) return null;
    const name = new TextDecoder("utf-8", { fatal: true }).decode(fromB64Url(payload));
    const key = await crypto.subtle.importKey("jwk", INVITE_PUBLIC_KEY, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromB64Url(signature), new TextEncoder().encode(PREFIX + name));
    return ok && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

// Returns { name } for a valid invite, otherwise null.
// A valid link is remembered on that device, so the guest can reopen the plain site address later.
export async function readInvite() {
  let stored = null;
  try { stored = localStorage.getItem(STORE); } catch { /* storage blocked: the link itself still works */ }
  for (const token of [new URLSearchParams(location.search).get("i"), stored]) {
    if (!token) continue;
    const name = await verify(token);
    if (name) {
      try { localStorage.setItem(STORE, token); } catch { /* ignore */ }
      return { name };
    }
  }
  return null;
}

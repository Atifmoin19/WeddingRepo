// Host-only page for creating and sending personal invite links.
// The signing key ships encrypted; it can only be opened with the host's passphrase.
// The guest list lives in this browser only and is never uploaded.
import { CONFIG } from "./config.js";
import { ADMIN_KEY } from "./admin-key.js";

const PREFIX = "walima-invite-v1|";
const K_GUESTS = "walima-admin-guests", K_KEY = "walima-admin-key", K_MSG = "walima-admin-message";
const DEFAULT_MSG = `Assalamu Alaikum {name}! With the blessings of Allah, you are cordially invited to the Walima of ${CONFIG.groom} & ${CONFIG.bride}. This is your personal invitation:\n{link}`;
const app = document.getElementById("app");
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Tiny DOM helper: h("button", {class:"x", onclick}, "text", child)
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

let signKey = null;
let guests = store.get(K_GUESTS, []);
let message = store.get(K_MSG, DEFAULT_MSG);
let filter = "";
const save = () => store.set(K_GUESTS, guests);

async function importSignKey(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function unlock(passphrase, remember) {
  const pass = passphrase.toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const aes = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: bytes(ADMIN_KEY.salt), iterations: ADMIN_KEY.iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(ADMIN_KEY.iv) }, aes, bytes(ADMIN_KEY.data));   // throws on a wrong passphrase
  const jwk = JSON.parse(new TextDecoder().decode(plain));
  signKey = await importSignKey(jwk);
  if (remember) store.set(K_KEY, jwk);
}

async function inviteLink(name) {
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signKey, new TextEncoder().encode(PREFIX + name));
  const base = (CONFIG.siteUrl || location.origin).replace(/\/$/, "");
  return `${base}/?i=${b64url(new TextEncoder().encode(name))}.${b64url(sig)}`;
}

function cleanPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10) d = "91" + d;            // Indian mobile without country code
  return d;
}

function addGuests(list) {
  let added = 0;
  for (const g of list) {
    const name = (g.name || "").trim(), phone = cleanPhone(g.phone);
    if (!name || guests.some((x) => (phone && x.phone === phone) || (!phone && x.name === name))) continue;
    guests.push({ id: crypto.randomUUID(), name, phone, sent: false, picked: true });
    added++;
  }
  save(); render();
  return added;
}

function parseVcf(text) {
  return text.split(/END:VCARD/i).map((card) => {
    const name = (card.match(/^FN[^:\n]*:(.*)$/im) || [])[1];
    const tel = (card.match(/^(?:item\d+\.)?TEL[^:\n]*:(.*)$/im) || [])[1];
    return { name: name && name.trim(), phone: tel && tel.trim() };
  }).filter((c) => c.name);
}

async function sendTo(g) {
  const link = await inviteLink(g.name.trim());
  const text = message.replace(/\{name\}/g, g.name.trim()).replace(/\{link\}/g, link);
  window.open(`https://wa.me/${g.phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  g.sent = true; save(); render();
}

async function copyLink(g, btn) {
  const link = await inviteLink(g.name.trim());
  try { await navigator.clipboard.writeText(link); btn.textContent = "Copied"; }
  catch { window.prompt("Copy this link", link); }
}

function lockScreen(error) {
  const pass = h("input", { id: "pass", type: "password", placeholder: "Passphrase", autocomplete: "current-password", "aria-label": "Passphrase" });
  const remember = h("input", { id: "remember", type: "checkbox", checked: true });
  const go = async () => {
    try { await unlock(pass.value, remember.checked); render(); }
    catch { lockScreen("That passphrase is not right. Try again."); }
  };
  pass.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  app.replaceChildren(
    h("h1", {}, "Guest links"),
    h("div", { class: "card" },
      h("p", {}, "Enter your passphrase to create invite links."),
      pass,
      error && h("p", { class: "err" }, error),
      h("label", { class: "chk" }, remember, "Remember on this phone"),
      h("button", { class: "primary", onclick: go }, "Unlock")));
}

function render() {
  if (!signKey) return lockScreen();
  const shown = guests.filter((g) => !filter || (g.name + " " + g.phone).toLowerCase().includes(filter));
  const queue = guests.filter((g) => g.picked && !g.sent && g.phone);
  const sentCount = guests.filter((g) => g.sent).length;

  const nameIn = h("input", { id: "new-name", placeholder: "Name on the card, e.g. Khan Sahab & Family", "aria-label": "Guest name" });
  const phoneIn = h("input", { id: "new-phone", placeholder: "Phone number", inputmode: "tel", "aria-label": "Phone number" });
  const file = h("input", { id: "vcf", type: "file", accept: ".vcf,text/vcard", hidden: true,
    onchange: async (e) => { const f = e.target.files[0]; if (f) note.textContent = `${addGuests(parseVcf(await f.text()))} contacts added.`; } });
  const note = h("p", {}, "");
  const canPick = "contacts" in navigator && "select" in navigator.contacts;

  const list = shown.length ? shown.map((g) => {
    const name = h("input", { id: "n-" + g.id, value: g.name, "aria-label": "Name printed on the card", onchange: (e) => { g.name = e.target.value.trim() || g.name; g.sent = false; save(); render(); } });
    return h("div", { class: "guest" },
      h("input", { id: "c-" + g.id, type: "checkbox", checked: !!g.picked, "aria-label": "Select " + g.name, onchange: (e) => { g.picked = e.target.checked; save(); render(); } }),
      name,
      h("div", { class: "meta" },
        h("span", {}, g.phone ? "+" + g.phone : "No phone"),
        h("span", { class: "chip" + (g.sent ? " sent" : "") }, g.sent ? "Sent" : "Not sent"),
        g.phone && h("button", { class: "small", onclick: () => sendTo(g) }, g.sent ? "Send again" : "Send"),
        h("button", { class: "small", onclick: (e) => copyLink(g, e.target) }, "Copy link"),
        h("button", { class: "small", onclick: () => { guests = guests.filter((x) => x !== g); save(); render(); } }, "Remove")));
  }) : [h("p", { class: "empty" }, guests.length ? "No guest matches that search." : "No guests yet. Add them above.")];

  app.replaceChildren(
    h("h1", {}, "Guest links"),
    h("p", {}, `${guests.length} guests · ${sentCount} sent. This list is saved on this phone only.`),
    h("div", { class: "card" },
      h("div", { class: "row" },
        canPick && h("button", { class: "primary", onclick: async () => {
          try { const picked = await navigator.contacts.select(["name", "tel"], { multiple: true });
            note.textContent = `${addGuests(picked.map((c) => ({ name: c.name?.[0], phone: c.tel?.[0] })))} contacts added.`; } catch { /* picker closed */ } } }, "Pick from phone contacts"),
        h("button", { onclick: () => file.click() }, "Import contacts file (.vcf)")),
      !canPick && h("p", {}, "This browser cannot open your contacts directly. On Android, use Chrome. On iPhone, export contacts as a .vcf file and import it here."),
      file,
      h("div", { class: "row" }, nameIn, phoneIn),
      h("button", { onclick: () => { if (nameIn.value.trim()) note.textContent = addGuests([{ name: nameIn.value, phone: phoneIn.value }]) ? "Guest added." : "That guest is already in the list."; } }, "Add guest"),
      note),
    h("div", { class: "card" },
      h("p", {}, "Message sent with each link. {name} and {link} are filled in for each guest."),
      h("textarea", { id: "msg", "aria-label": "Message", onchange: (e) => { message = e.target.value.includes("{link}") ? e.target.value : e.target.value + "\n{link}"; store.set(K_MSG, message); render(); } }, message),
      h("button", { class: "small", onclick: () => { message = DEFAULT_MSG; store.set(K_MSG, message); render(); } }, "Reset message")),
    h("div", { class: "card" },
      h("div", { class: "row" },
        h("input", { id: "search", placeholder: "Search guests", value: filter, "aria-label": "Search guests", oninput: (e) => { filter = e.target.value.toLowerCase(); render(); document.getElementById("search").focus(); } }),
        h("button", { class: "small", onclick: () => { const all = shown.every((g) => g.picked); shown.forEach((g) => (g.picked = !all)); save(); render(); } }, shown.every((g) => g.picked) && shown.length ? "Unselect all" : "Select all")),
      h("div", {}, list)),
    h("p", {}, "The name in each box is what gets printed on that guest's envelope and card. Edit it before sending."),
    h("button", { class: "small", onclick: () => { store.del(K_KEY); signKey = null; render(); } }, "Lock this phone"),
    h("div", { class: "bar" }, h("div", {},
      h("button", { class: "primary", disabled: !queue.length, onclick: () => sendTo(queue[0]) },
        queue.length ? `Send next: ${queue[0].name} (${queue.length} left)` : "Nothing left to send"))));
}

(async () => {
  if (!globalThis.crypto?.subtle) { app.replaceChildren(h("p", { class: "err" }, "Open this page over https.")); return; }
  const remembered = store.get(K_KEY, null);
  if (remembered) { try { signKey = await importSignKey(remembered); } catch { store.del(K_KEY); } }
  render();
})();

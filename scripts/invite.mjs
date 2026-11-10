#!/usr/bin/env node
// Creates personal invite links.
//
//   npm run invite -- "Khan Sahab & Family" 9876543210     one guest (phone optional)
//   npm run invite -- guests.csv                            many guests; each line: name,phone
//
// The first run creates a signing key in .invite-key.json. Keep that file safe and private:
// anyone who has it can create valid links, and without it you cannot create new ones.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY_FILE = join(root, ".invite-key.json");
const PUBLIC_FILE = join(root, "src/invite-key.js");
const PREFIX = "walima-invite-v1|";
const ALG = { name: "ECDSA", namedCurve: "P-256" };
const { subtle } = webcrypto;
const b64url = (bytes) => Buffer.from(bytes).toString("base64url");

async function loadKeys() {
  if (!existsSync(KEY_FILE)) {
    const pair = await subtle.generateKey(ALG, true, ["sign", "verify"]);
    const priv = await subtle.exportKey("jwk", pair.privateKey);
    const pub = await subtle.exportKey("jwk", pair.publicKey);
    writeFileSync(KEY_FILE, JSON.stringify({ privateKey: priv, publicKey: pub }, null, 2), { mode: 0o600 });
    console.error("Created a new signing key in .invite-key.json. Back it up and never share or commit it.");
    console.error("The site must be rebuilt and deployed once so it knows the matching public key.\n");
  }
  const { privateKey, publicKey } = JSON.parse(readFileSync(KEY_FILE, "utf8"));
  const pub = { kty: publicKey.kty, crv: publicKey.crv, x: publicKey.x, y: publicKey.y };
  const wanted = `// Public key used to check invite links. Safe to publish. Written by scripts/invite.mjs.\nexport const INVITE_PUBLIC_KEY = ${JSON.stringify(pub)};\n`;
  if (!existsSync(PUBLIC_FILE) || readFileSync(PUBLIC_FILE, "utf8") !== wanted) writeFileSync(PUBLIC_FILE, wanted);
  await ensureAdminKey(privateKey);
  return {
    sign: await subtle.importKey("jwk", privateKey, ALG, false, ["sign"]),
    verify: await subtle.importKey("jwk", pub, ALG, false, ["verify"]),
  };
}

// The admin page (admin.html) signs links in the browser. For that it carries the signing key,
// encrypted with a passphrase that is written to .admin-passphrase.txt on this computer only.
async function ensureAdminKey(privateKey) {
  const PASS_FILE = join(root, ".admin-passphrase.txt");
  const ADMIN_FILE = join(root, "src/admin-key.js");
  if (existsSync(PASS_FILE) && existsSync(ADMIN_FILE)) return;
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const pass = existsSync(PASS_FILE)
    ? readFileSync(PASS_FILE, "utf8").trim()
    : Array.from(webcrypto.getRandomValues(new Uint8Array(40))).filter((b) => b < 248).slice(0, 20)
        .map((b) => alphabet[b % alphabet.length]).join("").replace(/(.{5})(?=.)/g, "$1-");
  const iterations = 250000;
  const salt = webcrypto.getRandomValues(new Uint8Array(16)), iv = webcrypto.getRandomValues(new Uint8Array(12));
  const base = await subtle.importKey("raw", new TextEncoder().encode(pass.toLowerCase().replace(/[^a-z0-9]/g, "")), "PBKDF2", false, ["deriveKey"]);
  const aes = await subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const data = await subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(privateKey)));
  const b64 = (u) => Buffer.from(u).toString("base64");
  writeFileSync(PASS_FILE, pass + "\n", { mode: 0o600 });
  writeFileSync(ADMIN_FILE, `// Signing key for the admin page, encrypted with the host's passphrase. Written by scripts/invite.mjs.\nexport const ADMIN_KEY = ${JSON.stringify({ iterations, salt: b64(salt), iv: b64(iv), data: b64(data) })};\n`);
  console.error("Admin passphrase saved in .admin-passphrase.txt (this computer only). You need it to open /admin.html.\n");
}

function siteUrl() {
  const m = readFileSync(join(root, "src/config.js"), "utf8").match(/siteUrl:\s*"([^"]*)"/);
  return (m && m[1] ? m[1] : "http://localhost:5173").replace(/\/$/, "");
}

async function makeLink(keys, name) {
  const data = new TextEncoder().encode(PREFIX + name);
  const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.sign, data));
  if (!(await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, keys.verify, sig, data))) throw new Error("signature self-check failed");
  return `${siteUrl()}/?i=${b64url(new TextEncoder().encode(name))}.${b64url(sig)}`;
}

function whatsappLink(phone, name, link) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) digits = "91" + digits;           // Indian mobile without country code
  const text = `Assalamu Alaikum ${name}! With the blessings of Allah, you are cordially invited to the Walima of Atif & Nargis. This is your personal invitation:\n${link}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage:\n  npm run invite -- "Guest Name" [phone]\n  npm run invite -- guests.csv');
  process.exit(1);
}
const keys = await loadKeys();

if (args.length === 1 && args[0].toLowerCase().endsWith(".csv")) {
  const rows = readFileSync(args[0], "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => { const i = l.lastIndexOf(","); return i < 0 ? [l, ""] : [l.slice(0, i).replace(/^"|"$/g, "").trim(), l.slice(i + 1).trim()]; })
    .filter(([name]) => name && name.toLowerCase() !== "name");
  const out = ["name,phone,invite_link,whatsapp_send_link"];
  for (const [name, phone] of rows) {
    const link = await makeLink(keys, name);
    out.push([name, phone, link, whatsappLink(phone, name, link)].map(csvCell).join(","));
  }
  const file = join(root, "guest-links.csv");
  writeFileSync(file, out.join("\n") + "\n");
  console.log(`${rows.length} links written to ${file}`);
} else {
  const [name, phone] = args;
  const link = await makeLink(keys, name.trim());
  console.log(`Guest:  ${name.trim()}\nLink:   ${link}`);
  const wa = whatsappLink(phone, name.trim(), link);
  if (wa) console.log(`Send:   ${wa}`);
}

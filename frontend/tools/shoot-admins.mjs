// Real-run check of email-code login and multiple admins, with screenshots.
// Needs a FRESH backend on :8004 started with OWNER_EMAIL=owner@example.com OTP_DEBUG=1 (no RESEND_API_KEY),
// its output written to a log file, and `vite preview` on :4173. Takes about 90 s (it waits for "Resend code").
// Usage: API_LOG=/path/to/uvicorn.log node tools/shoot-admins.mjs
import { readFileSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const SITE = "http://localhost:4173", OUT = new URL("./shots/", import.meta.url).pathname;
const LOG = process.env.API_LOG;
if (!LOG) { console.error("Set API_LOG to the backend's log file"); process.exit(2); }
const OWNER = "owner@example.com", ADMIN = "bilal@example.com";
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  [" + extra + "]" : ""}`); console.log(results.at(-1)); };

// Login codes are read from the server log (OTP_DEBUG=1), newest last.
const codes = (email) => [...readFileSync(LOG, "utf8").matchAll(new RegExp(`OTP_DEBUG login code for ${email.replace(/\./g, "\\.")}: (\\d{6})`, "g"))].map((m) => m[1]);
async function nextCode(email, had) { for (let i = 0; i < 80; i++) { const c = codes(email); if (c.length > had) return c.at(-1); await sleep(100); } throw new Error("No login code in the log for " + email); }

const chrome = await launch();
const fill = async (p, sel, text) => { await p.eval(`(()=>{const i=document.querySelector(${JSON.stringify(sel)});i.focus();i.select&&i.select()})()`); await p.type(text); };
const submit = (p, sel = "form") => p.eval(`document.querySelector(${JSON.stringify(sel)}).requestSubmit()`);
const text = (p, sel) => p.eval(`document.querySelector(${JSON.stringify(sel)})?.innerText || ""`);
const tabs = (p) => p.eval(`[...document.querySelectorAll(".tabs button")].map(b=>b.textContent).join(", ")`);
const guestNames = (p) => p.eval(`[...document.querySelectorAll('.guest')].map(r=>r.querySelector("input[aria-label='Name printed on the card']").value+" | "+(r.querySelector(".addedby")?.textContent||"-")).join(" ; ")`);
const addGuest = async (p, name, phone) => {
  await fill(p, "#new-name", name); await fill(p, "#new-phone", phone); await submit(p, 'form[aria-label="Add guest"]');
  await p.until(`[...document.querySelectorAll('.guest input[aria-label="Name printed on the card"]')].some(i=>i.value===${JSON.stringify(name)})`, 8000, "guest row " + name);
};
async function emailStep(p, email) {
  const had = codes(email).length;
  await p.goto(SITE + "/admin"); await p.until(`document.querySelector("#email")`, 10000, "email step");
  await fill(p, "#email", email); await submit(p);
  await p.until(`document.querySelector("#code")`, 10000, "code step");
  return nextCode(email, had);
}

try {
  /* 1. owner: email step, code step, wrong code, right code */
  const a = await chrome.page();
  await a.goto(SITE + "/admin"); await a.until(`document.querySelector("#email")`, 10000, "email step"); await sleep(400);
  await a.shot(`${OUT}admin-otp-0-email.png`);
  check("login opens on the email step with a 'Use password instead' link", await a.eval(`!document.querySelector("#pass") && document.querySelector("#usepass").textContent === "Use password instead"`));
  await a.eval(`document.querySelector("#usepass").click()`); await a.until(`document.querySelector("#pass")`, 3000, "password form");
  check("'Use password instead' shows the password form, and back", await a.eval(`document.querySelector("#pass").type === "password"`));
  await a.eval(`document.querySelector("#useemail").click()`); await a.until(`document.querySelector("#email")`, 3000, "email step again");

  const ownerCode = await emailStep(a, OWNER); await sleep(300);
  await a.shot(`${OUT}admin-otp-1-code.png`);
  check("code step: numeric one-time-code input, Resend disabled at first", await a.eval(`(()=>{const i=document.querySelector("#code"),r=document.querySelector("#resend");return i.autocomplete==="one-time-code"&&i.inputMode==="numeric"&&r.disabled&&/Resend code \\(in \\d+ s\\)/.test(r.textContent)})()`), await text(a, "#resend"));
  await fill(a, "#code", "123 456 7"); check("code input keeps digits only, 6 at most (a pasted '123 456' works)", await a.eval(`document.querySelector("#code").value`) === "123456");
  await fill(a, "#code", ownerCode === "000000" ? "111111" : "000000"); await submit(a);
  await a.until(`document.querySelector(".err")`, 8000, "wrong code message");
  check("wrong code -> clear message, still on the code step", await a.eval(`!!document.querySelector("#code")`), await text(a, ".err"));
  await a.shot(`${OUT}admin-otp-1b-wrong-code.png`);
  await fill(a, "#code", ownerCode); await submit(a);
  await a.until(`document.querySelector("#tab-admins")`, 10000, "owner panel");
  check("owner logs in with the emailed code; sees 4 tabs and their name", await tabs(a) === "Guests, Event details, Replies, Admins", `${await tabs(a)} | ${await text(a, "#me")}`);

  /* 2. owner adds an admin and a guest */
  await a.eval(`document.querySelector("#tab-admins").click()`); await a.until(`document.querySelector(".admin-item")`, 8000, "admins list");
  check("owner row has no Deactivate / Remove controls", await a.eval(`document.querySelectorAll(".admin-item").length === 1 && document.querySelectorAll(".admin-item button").length === 0`), (await text(a, ".admin-item")).replace(/\s+/g, " "));
  await fill(a, "#adm-name", "Bilal Ahmed"); await fill(a, "#adm-email", "Bilal@Example.com"); await fill(a, "#adm-phone", "98111 11111");
  await submit(a, 'form[aria-label="Add admin"]');
  await a.until(`document.querySelector('.admin-item[data-admin="${ADMIN}"]')`, 8000, "new admin row");
  check("owner adds an admin (name, email, phone)", true, (await text(a, `.admin-item[data-admin="${ADMIN}"]`)).replace(/\s+/g, " "));
  await submit(a, 'form[aria-label="Add admin"]'); await fill(a, "#adm-name", "Dup"); await fill(a, "#adm-email", ADMIN); await submit(a, 'form[aria-label="Add admin"]');
  await a.until(`/already exists/.test(document.querySelector('form[aria-label="Add admin"] [role=status]')?.textContent||"")`, 8000, "duplicate email message");
  check("adding the same email again is refused", true, await text(a, 'form[aria-label="Add admin"] [role=status]'));
  await fill(a, "#adm-name", ""); await fill(a, "#adm-email", "");
  await a.eval(`document.querySelector("#tab-guests").click()`); await a.until(`document.querySelector("#new-name")`, 8000, "guests tab");
  await addGuest(a, "Owner Guest & Family", "98765 00001");
  check("owner adds a guest", true, await guestNames(a));

  /* 3. the new admin logs in (separate browser profile), using Resend after 60 s */
  const b = await chrome.page();
  const firstCode = await emailStep(b, ADMIN);
  const t0 = Date.now();
  await b.until(`!document.querySelector("#resend").disabled`, 70000, "Resend enabled");
  const waited = Math.round((Date.now() - t0) / 1000);
  check("Resend code becomes enabled after about 60 s", waited >= 57 && waited <= 64, `${waited} s`);
  await b.eval(`document.querySelector("#resend").click()`);
  const secondCode = await nextCode(ADMIN, 1);
  await b.until(`document.querySelector("#resend").disabled && document.querySelector(".ok")`, 8000, "resent note");
  if (firstCode !== secondCode) {
    await fill(b, "#code", firstCode); await submit(b); await b.until(`document.querySelector(".err")`, 8000, "old code refused");
    check("after Resend the earlier code no longer works", true, await text(b, ".err"));
  }
  await fill(b, "#code", secondCode); await submit(b);
  await b.until(`document.querySelector("#tab-guests") && document.querySelector("#new-name")`, 10000, "admin panel");
  check("admin logs in with the resent code; sees only Guests and Replies", await tabs(b) === "Guests, Replies" && !(await b.eval(`!!document.querySelector("#tab-settings") || !!document.querySelector("#tab-admins")`)), `${await tabs(b)} | ${await text(b, "#me")}`);
  check("admin sees none of the owner's guests", await b.eval(`document.querySelectorAll(".guest").length === 0`) && /No guests yet/.test(await text(b, ".empty")), await text(b, ".empty"));
  await addGuest(b, "Bilal Guest", "98765 00002");
  check("admin adds their own guest; no 'added by' line or admin filter for them", await b.eval(`document.querySelectorAll(".guest").length === 1 && !document.querySelector(".addedby") && !document.querySelector("#byadmin")`), await guestNames(b));
  await b.shot(`${OUT}admin-otp-4-admin-guests.png`);
  await b.eval(`localStorage.setItem("wd-admin-tab", JSON.stringify("admins"))`); await b.goto(SITE + "/admin");
  await b.until(`document.querySelector("#new-name")`, 10000, "admin panel after reload");
  check("a remembered Admins tab falls back to Guests for an admin", await tabs(b) === "Guests, Replies" && await b.eval(`document.querySelector("#tab-guests").getAttribute("aria-selected") === "true"`));

  /* 4. back as the owner: both guests, with who added them, and the filter */
  await a.eval(`document.querySelector("#tab-replies").click()`); await sleep(300);
  await a.eval(`document.querySelector("#tab-guests").click()`);
  await a.until(`document.querySelectorAll(".guest").length === 2`, 10000, "both guests for the owner"); await sleep(300);
  const both = await guestNames(a);
  check("owner sees both guests with 'added by'", both === "Bilal Guest | added by Bilal Ahmed ; Owner Guest & Family | added by Owner", both);
  await a.eval(`window.scrollTo(0, document.querySelector("#search").getBoundingClientRect().top + scrollY - 70)`); await sleep(300);
  await a.shot(`${OUT}admin-otp-3-owner-guests.png`); await a.shot(`${OUT}admin-otp-3-owner-guests-full.png`, { full: true });
  const options = await a.eval(`[...document.querySelectorAll("#byadmin option")].map(o=>o.textContent).join(", ")`);
  await a.eval(`(()=>{const s=document.querySelector("#byadmin");const v=[...s.options].find(o=>o.textContent==="Added by Bilal Ahmed").value;Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(s,v);s.dispatchEvent(new Event("change",{bubbles:true}))})()`); await sleep(300);
  check("owner's filter by admin narrows the list", options === "Added by anyone, Added by Bilal Ahmed, Added by Owner" && await guestNames(a) === "Bilal Guest | added by Bilal Ahmed", `${options} -> ${await guestNames(a)}`);
  await a.eval(`window.scrollTo(0, 0)`);
  await a.eval(`document.querySelector("#tab-admins").click()`); await a.until(`document.querySelectorAll(".admin-item").length === 2`, 8000, "admins list"); await sleep(300);
  const list = (await a.eval(`[...document.querySelectorAll(".admin-item")].map(e=>e.innerText.replace(/\\s+/g," ")).join(" ; ")`));
  check("Admins tab lists name, email, phone, role, state and guest count", /Owner OWNER ACTIVE owner@example\.com 1 guest added ; Bilal Ahmed ADMIN ACTIVE bilal@example\.com · \+919811111111 1 guest added Deactivate Remove/i.test(list), list);
  await a.shot(`${OUT}admin-otp-2-admins.png`); await a.shot(`${OUT}admin-otp-2-admins-full.png`, { full: true });

  /* 5. deactivate ends the admin's session; remove hands their guests to the owner */
  const row = `document.querySelector('.admin-item[data-admin="${ADMIN}"]')`;
  const click = (label) => a.eval(`[...${row}.querySelectorAll("button")].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
  await click("Deactivate"); await a.until(`/INACTIVE/i.test(${row}.innerText)`, 8000, "inactive chip");
  await b.eval(`document.querySelector("#tab-replies").click()`);
  await b.until(`document.querySelector("#email")`, 10000, "admin back at login");
  check("deactivating an admin ends their session (401 -> login screen)", true, await text(b, ".card p"));
  await click("Activate"); await a.until(`!/INACTIVE/i.test(${row}.innerText)`, 8000, "active again");
  await click("Remove"); await sleep(300); await a.shot(`${OUT}admin-otp-2b-remove-confirm.png`);
  check("Remove asks to confirm in the page", /Remove Bilal Ahmed\?/.test(await a.eval(`${row}.innerText`)), (await a.eval(`${row}.querySelector("p.err").textContent`)));
  await click("Yes, remove"); await a.until(`document.querySelectorAll(".admin-item").length === 1`, 8000, "admin removed");
  check("removed admin's guest now counts for the owner", /2 guests added/.test(await text(a, ".admin-item")), (await text(a, ".admin-item")).replace(/\s+/g, " "));
  await a.eval(`document.querySelector("#tab-guests").click()`); await a.until(`document.querySelectorAll(".guest").length === 2`, 8000, "guests after removal"); await sleep(300);
  check("their guest stays and shows 'added by Owner'", await guestNames(a) === "Bilal Guest | added by Owner ; Owner Guest & Family | added by Owner", await guestNames(a));

  /* 6. rate limit message, and log out */
  await a.eval(`document.querySelector("#logout").click()`); await a.until(`document.querySelector("#email")`, 5000, "login after log out");
  const c = await chrome.page();
  await c.goto(SITE + "/admin"); await c.until(`document.querySelector("#email")`);
  await fill(c, "#email", "someone-else@example.com"); await submit(c); await c.until(`document.querySelector("#code")`, 8000, "code step for a stranger");
  check("an unknown email gets the same code step (no account enumeration) and no code", codes("someone-else@example.com").length === 0, (await text(c, ".card p")).replace(/\s+/g, " "));
  await c.eval(`document.querySelector("#changeemail").click()`); await c.until(`document.querySelector("#email")`);
  await submit(c); await c.until(`document.querySelector(".err")`, 8000, "rate limit message");
  check("asking again within a minute -> clear rate-limit message", /minute/.test(await text(c, ".err")), await text(c, ".err"));
  await c.shot(`${OUT}admin-otp-0b-rate-limited.png`);

  for (const [n, p] of [["owner", a], ["admin", b], ["third", c]]) { const l = [...new Set(p.logs)]; if (l.length) console.log(`${n} page console:\n  ` + l.join("\n  ")); }
} catch (err) { check("SCRIPT ERROR", false, err.message); }
finally { await chrome.close(); }
console.log("\n" + results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);

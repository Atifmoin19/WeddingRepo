// Real-run checks with screenshots: locked, loading, RSVP round trip, scratch, gift, PDF card, walima-only guest,
// live refresh after an admin change, and the three admin tabs. Needs the backend on :8004 and `vite preview` on :4173.
// Usage: node tools/shoot-flows.mjs [invite|admin|all]
import { writeFileSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";
import { seed } from "./seed.mjs";

const SITE = "http://localhost:4173", API = "http://localhost:8004";
const OUT = new URL("./shots/", import.meta.url).pathname;
const what = process.argv[2] || "all";
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  [" + extra + "]" : ""}`); console.log(results.at(-1)); };
const s = await seed();
const chrome = await launch();

const ready = (p) => p.until(`document.querySelector(".intro.ready .hint")?.textContent.includes("Tap the seal")`, 20000, "envelope ready");
async function openInvite(p, code) {
  await p.goto(`${SITE}/?g=${code}`); await ready(p); await p.until(`document.fonts.status === "loaded"`); await sleep(1800);
  await p.eval(`document.querySelector("#intro").click()`); await sleep(3300);
}
const show = async (p, id, wait = 3000) => { await p.eval(`document.getElementById("${id}").scrollIntoView()`); await sleep(wait); };
const hookDownloads = (p) => p.eval(`window.__blobs=[];window.__names=[];(()=>{const o=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{window.__blobs.push(b);return o(b)};const c=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.__names.push(this.download);return}return c.call(this)}})()`);
const blob64 = (p, i = 0) => p.eval(`new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(",")[1]);f.readAsDataURL(window.__blobs[${i}])})`);

async function pdfCard(p, prefix) {
  await hookDownloads(p); await show(p, "closing", 4000);
  await p.eval(`document.querySelector("#card").click()`);
  await p.until(`window.__blobs.length > 0`, 30000, "pdf blob");
  const pdf = Buffer.from(await blob64(p), "base64");
  writeFileSync(`${OUT}${prefix}-card.pdf`, pdf);
  const txt = pdf.toString("latin1"); let at = 0, n = 0;
  for (;;) {
    const m = /\/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g; m.lastIndex = at; const hit = m.exec(txt); if (!hit) break;
    const start = hit.index + hit[0].length, len = +hit[1];
    writeFileSync(`${OUT}${prefix}-card-p${++n}.jpg`, pdf.subarray(start, start + len)); at = start + len;
  }
  const name = await p.eval(`window.__names[0]`);
  check(`${prefix}: PDF card built`, pdf.subarray(0, 5).toString() === "%PDF-" && n === 3, `${name}, ${pdf.length} bytes, ${n} pages`);
}

try {
  if (what === "invite" || what === "all") {
    /* A. locked: no code, and an unknown code */
    let p = await chrome.page();
    await p.goto(SITE + "/"); await p.until(`document.querySelector("#locked") && document.fonts.status === "loaded"`); await sleep(1200);
    await p.shot(`${OUT}locked.png`);
    check("no code -> Private invitation screen", await p.eval(`document.querySelector("#locked").innerText.includes("PRIVATE INVITATION") && !document.querySelector(".blk")`));
    await p.goto(SITE + "/?g=zzzzzzzzzz"); await p.until(`document.querySelector("#locked")`, 15000, "locked for unknown code");
    check("unknown code -> Private invitation screen", true);
    await p.close();

    /* B. loading: API unreachable -> envelope at once with "Opening your invitation…" */
    p = await chrome.page();
    await p.block([API + "/*"]);
    await p.goto(`${SITE}/?g=${s.family.code}`);
    await p.until(`document.querySelector(".intro.ready")`, 8000); await p.until(`document.fonts.status === "loaded"`); await sleep(2200);
    await p.shot(`${OUT}envelope-loading.png`);
    check("API down -> envelope shows 'Opening your invitation…'", await p.eval(`document.querySelector(".intro .hint").textContent.includes("Opening your invitation") && !document.querySelector(".blk")`));
    await p.eval(`document.querySelector("#intro").click()`); await sleep(300);
    check("envelope cannot be opened before data arrives", await p.eval(`!document.querySelector(".intro.open")`));
    await p.block([]);                                       // API "wakes up": the retry loop should pick it up without a reload
    await ready(p);
    check("API back -> invitation loads by itself (retry with backoff)", true);
    await p.close();

    /* C. family guest, both groups */
    p = await chrome.page();
    await openInvite(p, s.family.code);
    await show(p, "scratch");
    const box = await p.eval(`(()=>{const r=document.querySelector("#scr canvas").getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}})()`);
    await p.mouse("mousePressed", box.x + box.w * 0.2, box.y + box.h * 0.2);
    for (let row = 0.15; row <= 0.9; row += 0.12) for (let col = 0.1; col <= 0.92; col += 0.08) await p.mouse("mouseMoved", box.x + box.w * col, box.y + box.h * row);
    await p.mouse("mouseReleased", box.x + box.w * 0.5, box.y + box.h * 0.5);
    await sleep(1500); await p.shot(`${OUT}family-04b-scratch-revealed.png`);
    check("scratch card reveals date and Save the Date button", await p.eval(`document.querySelector("#scr.done") && !!document.querySelector("#savebtn") && document.querySelector("#scrhint").textContent.includes("See you there")`));

    await show(p, "gift"); await p.eval(`document.querySelector("#giftbtn").click()`); await sleep(2600); await p.shot(`${OUT}family-08b-gift-open.png`);
    check("gift box opens", await p.eval(`document.querySelector("#giftbox.open") && document.querySelector("#giftbtn").textContent === "Close the box"`));

    await show(p, "duas");
    await p.eval(`document.querySelectorAll("#duaf .seg")[0].children[0].click();document.querySelectorAll("#duaf .seg")[1].children[1].click()`); await sleep(300);
    await p.eval(`document.querySelector('.step button[aria-label="One more"]').click();document.querySelector('.step button[aria-label="One more"]').click();document.querySelector('.step button[aria-label="One more"]').click()`);
    await p.eval(`document.querySelector("#dt").focus()`); await p.type("Mubarak ho! Allah bless you both."); await sleep(700);
    await p.shot(`${OUT}family-09b-rsvp-filled.png`);
    // a failed save keeps the input and shows an error
    await p.block([API + "/*"]); await p.eval(`document.querySelector("#rsvpgo").click()`);
    await p.until(`document.querySelector("#rsvperr")`, 40000, "rsvp error"); await sleep(300); await p.shot(`${OUT}family-09c-rsvp-error.png`);
    check("RSVP save failure -> clear error, input kept", await p.eval(`document.querySelector("#dt").value === "Mubarak ho! Allah bless you both." && document.querySelector(".step b").textContent === "4" && document.querySelector("#rsvperr").textContent.length > 10`), await p.eval(`document.querySelector("#rsvperr").textContent`));
    await p.block([]); await p.eval(`document.querySelector("#rsvpgo").click()`);
    await p.until(`document.querySelector("#rsvpthanks")`, 15000, "rsvp thanks"); await sleep(1200); await p.shot(`${OUT}family-09d-rsvp-sent.png`);
    const thanks = await p.eval(`document.querySelector("#rsvpthanks").innerText.replace(/\\s+/g," ")`);
    check("RSVP saved -> saved reply shown with Change my reply + WhatsApp link", /Attending/.test(thanks) && /Not attending/.test(thanks) && /CHANGE MY REPLY/i.test(thanks) && /WHATSAPP/i.test(thanks), thanks);
    console.log("   whatsapp link:", decodeURIComponent(await p.eval(`document.querySelector("#rsvpwa").href`)));
    await pdfCard(p, "family");
    // later visit with the API asleep: renders at once from the cache, including the saved reply
    await p.block([API + "/*"]); await p.goto(`${SITE}/`); await ready(p);
    check("later visit, plain address, API down -> opens from cache with remembered code", true);
    await p.eval(`document.querySelector("#intro").click()`); await sleep(3300); await show(p, "duas", 2500);
    check("cached visit shows the saved reply", await p.eval(`!!document.querySelector("#rsvpthanks") && document.querySelector("#rsvpthanks").innerText.includes("4")`));
    await p.eval(`document.querySelector("#rsvpchange").click()`); await sleep(600); await p.shot(`${OUT}family-09e-rsvp-change.png`);
    check("Change my reply reopens the form prefilled", await p.eval(`document.querySelectorAll('#duaf .seg button[aria-pressed="true"]').length === 2 && document.querySelector("#dt").value.startsWith("Mubarak")`));
    if (p.logs.length) console.log("family logs:\n" + [...new Set(p.logs)].join("\n"));
    await p.close();

    /* D. walima-only single guest */
    p = await chrome.page();
    await p.goto(`${SITE}/?g=${s.single.code}`); await ready(p); await p.until(`document.fonts.status === "loaded"`); await sleep(2600);
    await p.shot(`${OUT}single-00-envelope.png`);
    await p.eval(`document.querySelector("#intro").click()`); await sleep(3300);
    for (const id of ["families", "scratch", "countdown", "events", "gift", "duas"]) { await show(p, id, id === "families" ? 4200 : 3000); await p.shot(`${OUT}single-${id}.png`); }
    const all = await p.eval(`document.querySelector("#stage").innerText + " " + [...document.querySelectorAll("[aria-label]")].map(e=>e.getAttribute("aria-label")).join(" ") + " " + document.querySelector("#giftbox").textContent`);
    check("walima-only guest: no Barat / Nikah / Bhitari anywhere on the page", !/barat|nikah|bhitari|ghazipur|نکاح|بارات/i.test(all), (all.match(/.{20}(barat|nikah).{20}/i) || [""])[0]);
    check("walima-only guest: families line reads 'Dawat-e-Walima of their beloved son'", /occasion of the Dawat-e-Walima of their beloved son/.test(all.replace(/\s+/g, " ")));
    check("walima-only guest: one event card, one RSVP choice, no headcount", await p.eval(`document.querySelectorAll(".ecard").length === 1 && document.querySelectorAll("#duaf .seg").length === 1`));

    // live refresh: unsent RSVP input + scroll position must survive an admin change arriving
    await p.eval(`document.querySelector("#duaf .seg").children[0].click()`); await sleep(300);
    await p.eval(`document.querySelector("#dt").focus()`); await p.type("typing, not sent yet");
    check("single guest gets no headcount stepper", await p.eval(`!document.querySelector(".step")`));
    await show(p, "events", 1500);
    const before = await p.eval(`({top:document.querySelector("#deck").scrollTop,seen:document.querySelectorAll(".blk.in").length,venue:document.querySelector(".ecard .vn").textContent})`);
    const settings = await s.j("/admin/settings", { headers: s.auth });
    const edited = structuredClone(settings); edited.events.find((e) => e.key === "walima").venue = "Hotel Giriraj Palace";
    await s.j("/admin/settings", { method: "PUT", headers: s.auth, body: JSON.stringify(edited) });
    const t0 = Date.now();
    await p.until(`document.querySelector(".ecard .vn").textContent === "Hotel Giriraj Palace"`, 75000, "venue change to appear by the 60 s refresh");
    const after = await p.eval(`({top:document.querySelector("#deck").scrollTop,seen:document.querySelectorAll(".blk.in").length,msg:document.querySelector("#dt").value,pressed:document.querySelectorAll('#duaf .seg button[aria-pressed="true"]').length,intro:!!document.querySelector("#intro")})`);
    await sleep(400); await p.shot(`${OUT}single-events-after-admin-change.png`);
    check("admin venue change appears on an open invite without reload (60 s timer)", true, `${before.venue} -> Hotel Giriraj Palace after ${Math.round((Date.now() - t0) / 1000)} s`);
    check("refresh keeps scroll, revealed sections, unsent RSVP input; envelope does not return", after.top === before.top && after.seen === before.seen && after.msg === "typing, not sent yet" && after.pressed === 1 && !after.intro, JSON.stringify({ before, after }));
    await s.j("/admin/settings", { method: "PUT", headers: s.auth, body: JSON.stringify(settings) });
    await p.eval(`document.dispatchEvent(new Event("visibilitychange"))`);
    await p.until(`document.querySelector(".ecard .vn").textContent === "Hotel Giriraj"`, 10000, "venue restore via visibilitychange");
    check("visibilitychange triggers a refresh", true);
    await show(p, "duas", 1200); await p.eval(`document.querySelector("#rsvpgo").click()`);
    await p.until(`document.querySelector("#rsvpthanks")`, 15000); await sleep(1200); await p.shot(`${OUT}single-duas-sent.png`);
    await pdfCard(p, "single");
    if (p.logs.length) console.log("single logs:\n" + [...new Set(p.logs)].join("\n"));
    await p.close();
  }

  if (what === "pdf") {            // just the envelope and the PDF card pages for both test guests
    for (const who of ["family", "single"]) {
      const p = await chrome.page();
      await p.goto(`${SITE}/?g=${s[who].code}`); await ready(p); await p.until(`document.fonts.status === "loaded"`); await sleep(2600);
      await p.shot(`${OUT}${who}-00-envelope.png`);
      await p.eval(`document.querySelector("#intro").click()`); await sleep(3300);
      await pdfCard(p, who);
      if (p.logs.length) console.log(who + " logs:\n" + [...new Set(p.logs)].join("\n"));
      await p.close();
    }
  }

  if (what === "admin" || what === "all") {
    const p = await chrome.page();
    await p.goto(SITE + "/admin"); await p.until(`document.querySelector("#usepass")`); await p.eval(`document.querySelector("#usepass").click()`); await p.until(`document.querySelector("#pass")`); await sleep(500);
    await p.shot(`${OUT}admin-0-login.png`);
    check("/admin has noindex and no wedding theme", await p.eval(`document.querySelector('meta[name="robots"]')?.content.includes("noindex") && !document.querySelector(".stage")`));
    await p.eval(`document.querySelector("#pass").focus()`); await p.type("wrong-password"); await p.eval(`document.querySelector("form").requestSubmit()`);
    await p.until(`document.querySelector(".err")`, 8000); check("wrong password -> error", true, await p.eval(`document.querySelector(".err").textContent`));
    await p.eval(`document.querySelector("#pass").select()`); await p.type("localpass"); await p.eval(`document.querySelector("form").requestSubmit()`);
    await p.until(`document.querySelectorAll(".guest").length >= 2`, 15000, "guest list"); await sleep(500);

    // add through the form, then edit, send, copy, remove
    await p.eval(`window.__opened=[];window.open=(u)=>{window.__opened.push(u);return null};window.__copied=[];navigator.clipboard.writeText=async(t)=>{window.__copied.push(t)}`);
    await p.eval(`document.querySelector("#new-name").focus()`); await p.type("Test Uncle & Family");
    await p.eval(`document.querySelector("#new-phone").focus()`); await p.type("98765 00001");
    await p.eval(`document.querySelector('form[aria-label="Add guest"]').requestSubmit()`);
    await p.until(`[...document.querySelectorAll('.guest input[aria-label="Name printed on the card"]')].some(i=>i.value==="Test Uncle & Family")`, 8000, "new guest row");
    check("add guest through the form", true);
    await p.shot(`${OUT}admin-1-guests.png`); await p.shot(`${OUT}admin-1-guests-full.png`, { full: true });
    const row = `[...document.querySelectorAll(".guest")].find(r=>r.querySelector("input[aria-label='Name printed on the card']").value.startsWith("Test Uncle"))`;
    await p.eval(`${row}.querySelector(".seg2 button:nth-child(2)").click()`);                         // -> single
    await p.eval(`${row}.querySelectorAll(".chk input")[0].click()`);                                   // un-invite from barat
    await p.eval(`(()=>{const i=${row}.querySelector("input[aria-label='Name printed on the card']");i.focus();i.select()})()`); await p.type("Test Uncle"); await p.eval(`document.activeElement.blur()`);
    await sleep(900);
    const viaApi = (await s.j("/admin/guests", { headers: s.auth })).find((g) => g.phone === "919876500001");
    check("edit name / party / invited saves by PATCH", viaApi && viaApi.name === "Test Uncle" && viaApi.party === "single" && viaApi.invited.join() === "walima", JSON.stringify(viaApi && { name: viaApi.name, party: viaApi.party, invited: viaApi.invited }));
    await p.eval(`[...${row}.querySelectorAll("button")].find(b=>b.textContent==="Send").click()`); await sleep(900);
    const opened = await p.eval(`window.__opened[0]`);
    check("Send opens wa.me with name + link and marks Sent", /^https:\/\/wa\.me\/919876500001\?text=/.test(opened) && decodeURIComponent(opened).includes("Test Uncle") && decodeURIComponent(opened).includes(`/?g=${viaApi.code}`) && await p.eval(`${row}.querySelector(".chip").textContent === "Sent"`), decodeURIComponent(opened).replace(/\n/g, " ").slice(0, 200));
    await p.eval(`[...${row}.querySelectorAll("button")].find(b=>b.textContent==="Copy link").click()`); await sleep(300);
    check("Copy link copies the guest link", await p.eval(`window.__copied[0]`) === `${SITE}/?g=${viaApi.code}`, await p.eval(`window.__copied[0]`));
    check("Send next bar names the next unsent guest", await p.eval(`/^Send next: .+ \\(\\d+ left\\)$/.test(document.querySelector("#sendnext").textContent)`), await p.eval(`document.querySelector("#sendnext").textContent`));
    await p.eval(`[...${row}.querySelectorAll("button")].find(b=>b.textContent==="Remove").click()`); await sleep(300);
    await p.shot(`${OUT}admin-1b-remove-confirm.png`);
    await p.eval(`[...${row}.querySelectorAll("button")].find(b=>b.textContent==="Yes, remove").click()`); await sleep(900);
    check("Remove (with confirm step) deletes the guest", !(await s.j("/admin/guests", { headers: s.auth })).some((g) => g.phone === "919876500001") && await p.eval(`!${row}`));
    // .vcf import through the same code path as the file input
    await p.eval(`(()=>{const dt=new DataTransfer();dt.items.add(new File(["BEGIN:VCARD\\nVERSION:3.0\\nFN:Vcf Chacha\\nTEL;TYPE=CELL:+91 98765 00002\\nEND:VCARD\\nBEGIN:VCARD\\nFN:Khan Duplicate\\nTEL:9876543210\\nEND:VCARD\\n"],"c.vcf",{type:"text/vcard"}));const i=document.querySelector("#vcf");i.files=dt.files;i.dispatchEvent(new Event("change",{bubbles:true}))})()`);
    await p.until(`/skipped/.test(document.querySelector('form[aria-label="Add guest"] [role=status]')?.textContent||"")`, 8000, "import note");
    check(".vcf import -> bulk add, duplicate phone skipped", await p.eval(`document.querySelector('form[aria-label="Add guest"] [role=status]').textContent`) === "1 added, 1 skipped (phone number already in the list).", await p.eval(`document.querySelector('form[aria-label="Add guest"] [role=status]').textContent`));
    const chacha = (await s.j("/admin/guests", { headers: s.auth })).find((g) => g.name === "Vcf Chacha");
    if (chacha) await s.j(`/admin/guests/${chacha.id}`, { method: "DELETE", headers: s.auth });

    /* Event details */
    await p.eval(`document.querySelector("#tab-settings").click()`); await p.until(`document.querySelector("#e-walima-venue")`); await sleep(400);
    await p.shot(`${OUT}admin-2-settings.png`); await p.shot(`${OUT}admin-2-settings-full.png`, { full: true });
    const setVal = (id, v) => p.eval(`(()=>{const i=document.querySelector("#${id}");const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;set.call(i,${JSON.stringify(v)});i.dispatchEvent(new Event("input",{bubbles:true}))})()`);
    await setVal("e-walima-date", ""); await setVal("e-nikah-time", "");
    await p.eval(`document.querySelector("#savesettings").click()`); await p.until(`document.querySelector("#savestatus.err")`, 8000, "validation message"); await sleep(300);
    await p.eval(`document.querySelector("#e-nikah-time").scrollIntoView({block:"center"})`); await sleep(300); await p.shot(`${OUT}admin-2b-settings-errors.png`);
    check("settings validation errors from the API shown next to fields", await p.eval(`document.querySelectorAll(".fld.bad em").length === 2`), await p.eval(`document.querySelector("#savestatus").textContent + " | " + [...document.querySelectorAll(".fld.bad em")].map(e=>e.textContent).join(" | ")`));
    await setVal("e-walima-date", "2027-10-18"); await setVal("e-nikah-time", "14:30"); await setVal("e-walima-venue", "Hotel Giriraj (UI edit)");
    await p.eval(`document.querySelector("#savesettings").click()`); await p.until(`document.querySelector("#savestatus.ok")`, 8000, "saved message");
    const pub = await (await fetch(`${API}/public/invite/${s.single.code}`)).json();
    check("settings save from the UI reaches the public API", pub.settings.events[0].venue === "Hotel Giriraj (UI edit)", pub.settings.events[0].venue);
    await setVal("e-walima-venue", "Hotel Giriraj"); await p.eval(`document.querySelector("#savesettings").click()`); await sleep(900);

    /* Replies */
    await p.eval(`document.querySelector("#tab-replies").click()`); await p.until(`document.querySelector(".tot")`); await sleep(900);
    await p.shot(`${OUT}admin-3-replies.png`); await p.shot(`${OUT}admin-3-replies-full.png`, { full: true });
    const tot = await p.eval(`document.querySelector(".tot").innerText.replace(/\\s+/g," ") + " || " + [...document.querySelectorAll(".reply-item")].map(e=>e.innerText.replace(/\\s+/g," ")).join(" || ")`);
    check("Replies tab shows the RSVPs sent from the invite", /Khan Sahab & Family/.test(tot) && /Mubarak ho/.test(tot) && /4 COMING/i.test(tot), tot);
    await hookDownloads(p); await p.eval(`document.querySelector("#csv").click()`); await p.until(`window.__blobs.length > 0`, 10000, "csv blob");
    const csv = Buffer.from(await blob64(p), "base64").toString("utf8"); writeFileSync(`${OUT}export.csv`, csv);
    check("Download CSV saves a file containing the RSVP", await p.eval(`window.__names[0]`) === "wedding-guests.csv" && /Khan Sahab & Family,919876543210,family,"barat, walima",\w+,[^,]*,[^,]+,yes,no,4,Mubarak ho! Allah bless you both\./.test(csv), csv.split("\n").slice(0, 3).join(" ⏎ "));
    // expired / invalid token -> back to login
    await p.eval(`localStorage.setItem("wd-admin-token", JSON.stringify("bad.token.value"))`); await p.goto(SITE + "/admin");
    await p.until(`document.querySelector("#email")`, 10000, "login after 401"); check("401 returns to the login screen", true, await p.eval(`document.querySelector(".card p").textContent`));
    if (p.logs.length) console.log("admin logs:\n" + [...new Set(p.logs)].join("\n"));
    await p.close();
  }
} catch (err) { check("SCRIPT ERROR", false, err.message); }
finally { await chrome.close(); }
console.log("\n" + results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);

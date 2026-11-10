// Small phone (375 x 667): the tightest sections must stay inside their frames.
import { launch, sleep } from "./cdp.mjs";
import { seed } from "./seed.mjs";
const s = await seed(); const OUT = new URL("./shots/", import.meta.url).pathname;
const chrome = await launch(9337);
try {
  const p = await chrome.page({ width: 375, height: 667 });
  await p.goto(`http://localhost:4173/?g=${s.family.code}`);
  await p.until(`document.querySelector(".intro.ready .hint")?.textContent.includes("Tap the seal") && document.fonts.status === "loaded"`, 20000); await sleep(1500);
  await p.eval(`document.querySelector("#intro").click()`); await sleep(3300);
  for (const id of ["families", "events", "duas"]) {
    await p.eval(`document.getElementById("${id}").scrollIntoView()`); await sleep(id === "families" ? 4200 : 3000);
    await p.shot(`${OUT}small-${id}.png`);
    if (id === "duas" && await p.eval(`!!document.querySelector("#rsvpchange")`)) { await p.eval(`document.querySelector("#rsvpchange").click()`); await sleep(700); await p.shot(`${OUT}small-duas-form.png`); }
    console.log(id, await p.eval(`(()=>{const b=document.getElementById("${id}").getBoundingClientRect();const k=[...document.querySelectorAll("#${id} .safe > *")].map(e=>e.getBoundingClientRect()).filter(r=>r.height);return "content "+Math.round(Math.min(...k.map(r=>r.top))-b.top)+" to "+Math.round(Math.max(...k.map(r=>r.bottom))-b.top)+" of "+Math.round(b.height)})()`));
  }
} finally { await chrome.close(); }

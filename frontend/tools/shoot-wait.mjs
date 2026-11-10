// API unreachable for the whole wake-up budget: waiting line, then the friendly retry message, then recovery.
import { launch, sleep } from "./cdp.mjs";
import { seed } from "./seed.mjs";
const s = await seed(); const OUT = new URL("./shots/", import.meta.url).pathname;
const chrome = await launch(9336);
try {
  const p = await chrome.page();
  await p.block(["http://localhost:8004/*"]);
  const t0 = Date.now();
  await p.goto(`http://localhost:4173/?g=${s.single.code}`);
  await p.until(`document.querySelector(".intro.ready") && document.fonts.status === "loaded"`, 10000); await sleep(2300);
  await p.shot(`${OUT}envelope-loading.png`);
  console.log("waiting line:", await p.eval(`document.querySelector(".intro .hint").textContent`));
  await p.until(`document.querySelector(".waitmsg")`, 110000, "retry message");
  console.log("retry message after", Math.round((Date.now() - t0) / 1000), "s:", await p.eval(`document.querySelector(".waitmsg").textContent`));
  await sleep(500); await p.shot(`${OUT}envelope-retry-message.png`);
  await p.block([]); await p.eval(`document.querySelector(".cover .btn").click()`);
  await p.until(`document.querySelector(".intro .hint")?.textContent.includes("Tap the seal")`, 15000, "recovery");
  console.log("Try again -> invitation loaded");
} finally { await chrome.close(); }

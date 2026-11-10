// Screenshots of the invitation for one guest. Usage: node tools/shoot-invite.mjs <family|single|ref> [prefix]
import { launch, sleep } from "./cdp.mjs";
import { seed } from "./seed.mjs";

const who = process.argv[2] || "family";
const OUT = new URL("./shots/", import.meta.url).pathname;
const isRef = who === "ref";
const s = isRef ? null : await seed();
const url = isRef ? "http://localhost:4174/?preview" : `http://localhost:4173/?g=${s[who].code}`;
const pre = process.argv[3] || who;

const chrome = await launch();
try {
  const p = await chrome.page();
  await p.goto(url);
  await p.until(`document.querySelector(".intro.ready") && document.querySelectorAll(".blk").length > 0 && document.fonts.status === "loaded"`, 20000, "invite ready");
  await sleep(2200);
  await p.shot(`${OUT}${pre}-00-envelope.png`);
  await p.eval(`document.querySelector("#intro").click()`);
  await sleep(3400);
  const ids = await p.eval(`[...document.querySelectorAll(".blk")].map(b=>b.id)`);
  for (const [i, id] of ids.entries()) {
    await p.eval(`document.getElementById(${JSON.stringify(id)}).scrollIntoView()`);
    await sleep(id === "closing" || id === "families" ? 4200 : 3200);
    await p.shot(`${OUT}${pre}-${String(i + 1).padStart(2, "0")}-${id}.png`);
  }
  console.log("sections:", ids.join(" "));
  console.log("text:", await p.eval(`document.querySelector("#deck").innerText.replace(/\\s+/g," ").slice(0,3000)`));
  if (p.logs.length) console.log("LOGS:\n" + p.logs.join("\n"));
} finally { await chrome.close(); }

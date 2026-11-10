// Envelope + PDF pages for one guest code: node tools/shoot-one.mjs <code> <prefix>
import { writeFileSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";
const [code, pre] = process.argv.slice(2); const OUT = new URL("./shots/", import.meta.url).pathname;
const chrome = await launch();
try {
  const p = await chrome.page();
  await p.goto(`http://localhost:4173/?g=${code}`);
  await p.until(`document.querySelector(".intro.ready .hint")?.textContent.includes("Tap the seal") && document.fonts.status === "loaded"`, 20000); await sleep(2600);
  await p.shot(`${OUT}${pre}-00-envelope.png`);
  await p.eval(`document.querySelector("#intro").click()`); await sleep(3300);
  await p.eval(`window.__blobs=[];(()=>{const o=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{window.__blobs.push(b);return o(b)};HTMLAnchorElement.prototype.click=function(){}})()`);
  await p.eval(`document.getElementById("closing").scrollIntoView()`); await sleep(3500);
  await p.eval(`document.querySelector("#card").click()`); await p.until(`window.__blobs.length > 0`, 30000);
  const pdf = Buffer.from(await p.eval(`new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(",")[1]);f.readAsDataURL(window.__blobs[0])})`), "base64");
  const txt = pdf.toString("latin1"); const re = /\/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g; let m, n = 0;
  while ((m = re.exec(txt))) { const st = m.index + m[0].length; writeFileSync(`${OUT}${pre}-card-p${++n}.jpg`, pdf.subarray(st, st + +m[1])); re.lastIndex = st + +m[1]; }
  writeFileSync(`${OUT}${pre}-card.pdf`, pdf); console.log(pre, "pages:", n, p.logs.join(" | "));
} finally { await chrome.close(); }

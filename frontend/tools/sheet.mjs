// Contact sheet: node tools/sheet.mjs out.png a.png b.png c.png d.png  (images side by side, 400px wide each)
import { launch, sleep } from "./cdp.mjs";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
const [out, ...imgs] = process.argv.slice(2);
const html = `<body style="margin:0;display:flex;background:#333">${imgs.map((f) => `<figure style="margin:0;width:400px;position:relative"><img src="file://${resolve(f)}" style="width:400px;display:block"><figcaption style="position:absolute;left:0;top:0;background:#000c;color:#fff;font:11px sans-serif;padding:2px 5px">${f.split("/").pop()}</figcaption></figure>`).join("")}</body>`;
const tmp = resolve(out + ".html"); writeFileSync(tmp, html);
const chrome = await launch(9334);
try { const p = await chrome.page({ width: 400 * imgs.length, height: 800 }); await p.size(400 * imgs.length, 800); await p.send("Emulation.setDeviceMetricsOverride", { width: 400 * imgs.length, height: 800, deviceScaleFactor: 1, mobile: false }); await p.goto("file://" + tmp); await sleep(600); await p.shot(resolve(out)); }
finally { await chrome.close(); (await import("node:fs")).unlinkSync(tmp); }

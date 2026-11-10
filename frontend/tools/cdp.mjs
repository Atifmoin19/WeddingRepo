// Minimal Chrome DevTools Protocol driver for screenshots and real-run checks. No dependencies (Node 22+).
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch(port = 9333) {
  const profile = mkdtempSync(join(tmpdir(), "wd-chrome-"));
  const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--window-size=400,800", "about:blank"], { stdio: "ignore" });
  let info;
  for (let i = 0; i < 100 && !info; i++) { await sleep(150); try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { /* not up yet */ } }
  if (!info) throw new Error("Chrome did not start");
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let id = 0; const waiting = new Map(), listeners = new Set();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { const { ok, fail } = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? fail(new Error(msg.error.message)) : ok(msg.result); }
    else listeners.forEach((l) => l(msg));
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => { const n = ++id; waiting.set(n, { ok, fail }); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });

  // A page in its own browser context (separate localStorage), sized like a phone.
  async function page({ width = 400, height = 800 } = {}) {
    const { browserContextId } = await send("Target.createBrowserContext");
    const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const s = (method, params) => send(method, params, sessionId);
    const logs = [];
    listeners.add((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
      if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) logs.push(msg.params.type + " " + msg.params.args.map((a) => a.value ?? a.description).join(" "));
      if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") logs.push("log " + msg.params.entry.text + " " + (msg.params.entry.url || ""));
    });
    await s("Page.enable"); await s("Runtime.enable"); await s("Log.enable"); await s("Network.enable");
    await s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: true });
    await s("Emulation.setTouchEmulationEnabled", { enabled: false });
    const p = {
      logs, send: s,
      goto: async (url) => { await s("Page.navigate", { url }); await sleep(400); },
      eval: async (expression) => {
        const r = await s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      },
      // Polls in real time until the expression is truthy.
      until: async (expression, timeout = 15000, what = expression) => {
        const end = Date.now() + timeout;
        for (;;) { const v = await p.eval(`!!(${expression})`).catch(() => null); if (v) return v; if (Date.now() > end) throw new Error("Timed out waiting for: " + what); await sleep(120); }
      },
      shot: async (file, { full = false } = {}) => {
        const { data } = await s("Page.captureScreenshot", { format: "png", captureBeyondViewport: full });
        writeFileSync(file, Buffer.from(data, "base64"));
      },
      size: (w, h) => s("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: true }),
      block: (urls) => s("Network.setBlockedURLs", { urls }),
      mouse: (type, x, y, extra = {}) => s("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, ...extra }),
      type: (text) => s("Input.insertText", { text }),
      close: () => send("Target.disposeBrowserContext", { browserContextId }),
    };
    return p;
  }
  return { page, close: async () => { try { await send("Browser.close"); } catch { /* already gone */ } proc.kill(); } };
}

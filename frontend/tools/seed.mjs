// Creates the two test guests through the API (once) and prints their codes as JSON.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const API = process.env.API || "http://localhost:8004";
const j = async (path, opts = {}) => { const r = await fetch(API + path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } }); if (!r.ok) throw new Error(path + " " + r.status + " " + (await r.text())); return r.status === 204 ? null : r.json(); };
export async function seed() {
  // reuse the token between runs: the API allows only 10 logins per 15 minutes
  const cache = join(tmpdir(), "wd-admin-token.txt");
  let token = existsSync(cache) ? readFileSync(cache, "utf8").trim() : "";
  if (!token || !(await fetch(API + "/admin/settings", { headers: { Authorization: `Bearer ${token}` } })).ok) {
    ({ token } = await j("/admin/login", { method: "POST", body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || "localpass" }) }));
    writeFileSync(cache, token);
  }
  const auth = { Authorization: `Bearer ${token}` };
  let guests = await j("/admin/guests", { headers: auth });
  const want = [
    { name: "Khan Sahab & Family", phone: "9876543210", party: "family", invited: ["barat", "walima"] },
    { name: "Dr. Ayesha Rahman", phone: "9123456780", party: "single", invited: ["walima"] },
  ];
  for (const w of want) if (!guests.some((g) => g.name === w.name)) await j("/admin/guests", { method: "POST", headers: auth, body: JSON.stringify(w) });
  guests = await j("/admin/guests", { headers: auth });
  const by = (n) => guests.find((g) => g.name === n);
  return { token, auth, family: by(want[0].name), single: by(want[1].name), j };
}
if (import.meta.url === `file://${process.argv[1]}`) { const s = await seed(); console.log(JSON.stringify({ family: s.family, single: s.single }, null, 1)); }

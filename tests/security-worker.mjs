// Run the real built Worker and D1/R2 in memory, bypassing Wrangler's HTTP
// preview proxy (which may reset connections on rejected, unread POST bodies).
import { Miniflare } from "miniflare";
import fs from "node:fs";
import path from "node:path";
const origin = "http://127.0.0.1:8787";
const mf = new Miniflare({
  modulesRoot: path.resolve("dist/server"),
  modules: ["index.js", ...fs.readdirSync("dist/server", { recursive: true }).filter(x => /\.(m?js)$/.test(x) && x !== "index.js")].map(file => ({ type: "ESModule", path: path.resolve("dist/server", file) })),
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  r2Buckets: ["BUCKET"],
});
const originalFetch = globalThis.fetch;
try {
  const db = await mf.getD1Database("DB");
  for (const file of fs.readdirSync("drizzle").filter(x => x.endsWith(".sql")).sort())
    for (const statement of fs.readFileSync("drizzle/" + file, "utf8").split(";").map(x=>x.trim()).filter(Boolean))
      await db.prepare(statement).run();
  process.env.DEVOTECA_TEST_URL = origin;
  globalThis.fetch = async (url, options) => {
    if (new URL(url).origin !== origin) throw new Error("Only the disposable local Worker can be called.");
    return mf.dispatchFetch(url, options);
  };
  await import("./security.mjs");
  // Seed counters in this disposable DB to test quotas without large uploads.
  for (const [member, purpose, seconds, used] of [["quota_count", "uploads", 3600, 100], ["quota_bytes", "upload_bytes", 86400, 250 * 1024 * 1024]]) {
    await db.prepare("INSERT INTO security_limits(member,purpose,window,used) VALUES(?,?,?,?)").bind(member,purpose,Math.floor(Date.now()/(seconds*1000)),used).run();
    const response = await fetch(origin + "/api/community/media", { method: "PUT", headers: { Origin: origin, "oai-authenticated-user-id": member, "oai-authenticated-user-email": "quota@example.test", "X-Devoteca-Image-Kind": "post" }, body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
    if (response.status !== 429) throw new Error("Upload quota failed: " + purpose);
    const count = await db.prepare("SELECT COUNT(*) AS count FROM community_media WHERE owner=?").bind(member).first();
    if (count.count !== 0) throw new Error("A blocked upload was stored.");
  }
  console.log("PASS: hourly uploads and daily byte quotas block before storage; disposable database removed.");
} finally {
  globalThis.fetch = originalFetch;
  await mf.dispose();
}

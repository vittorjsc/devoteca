import assert from "node:assert/strict";
const origin = process.env.DEVOTECA_TEST_URL || "http://127.0.0.1:8787";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname))
  throw new Error("Security tests may only mutate a local Worker.");
const stamp = crypto.randomUUID();
const user = {
  "oai-authenticated-user-id": "security_" + stamp,
  "oai-authenticated-user-email": "security@example.test",
};
async function request(path, options = {}, status = 200) {
  const response = await fetch(origin + path, { ...options, headers: { Origin: origin, ...user, ...options.headers } });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(path + " returned " + response.status + " instead of JSON: " + raw.slice(0,160)); }
  assert.equal(response.status, status, path + " " + JSON.stringify(data));
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.match(response.headers.get("content-security-policy"), /object-src 'none'/);
  return { data, response };
}
const json = (value) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
let uploaded;
try {
  for (const path of ["/api/library", "/api/projects", "/api/comments?id=missing", "/api/files?id=missing", "/api/community/feed", "/api/community/profile", "/api/community/media?id=missing"])
    assert.equal((await fetch(origin + path)).status, 401, path);
  const library = (await request("/api/library")).data;
  assert.equal(library.members.find(p => p.id === user["oai-authenticated-user-id"]).name, "Membro da Devoteca");
  assert.ok(library.members.every(p => !("email" in p)));
  assert.ok(library.resources.every(r => r.file_key === null || r.file_key === "attached"));
  for (const path of ["/api/categories", "/api/github", "/api/projects", "/api/comments", "/api/community/posts", "/api/community/profile"])
    for (const headers of [{ Origin: "https://foreign.test" }, { Origin: "null" }, { Origin: "https://foreign.test", Referer: origin }, { "Sec-Fetch-Site": "cross-site" }, { "Sec-Fetch-Site": "same-site" }])
      await request(path, { ...json({}), headers: { "Content-Type": "application/json", ...headers } }, 403);
  // Absence of Origin AND Referer fails closed. Same-origin Referer fallback works.
  assert.equal((await fetch(origin + "/api/community/posts", { ...json({}), headers: { ...user, "Content-Type": "application/json" } })).status, 403);
  assert.equal((await fetch(origin + "/api/community/posts", { ...json({}), headers: { ...user, "Content-Type": "application/json", Referer: origin + "/" } })).status, 400);
  await request("/api/community/posts", { method: "POST", body: JSON.stringify({ body: "simple request" }), headers: { "Content-Type": "text/plain" } }, 415);
  for (const path of ["/api/categories", "/api/github", "/api/projects", "/api/comments", "/api/community/posts", "/api/community/profile"])
    for (const body of ["null", "[]", "{bad"])
      await request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body }, 400);
  await request("/api/community/posts", json({ body: "x".repeat(70 * 1024) }), 413);
  // A streamed payload has no Content-Length; the byte bound must still apply.
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"body":"')); c.enqueue(new Uint8Array(70 * 1024).fill(120)); c.close(); } });
  await request("/api/community/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half" }, 413);
  await request("/api/github", json({ url: "http://127.0.0.1/private" }), 400);
  await request("/api/github", json({ url: "https://user:password@github.com/microsoft/qlib" }), 400);
  await request("/api/community/profile", { ...json({ name: "service writes" }), headers: { "Content-Type": "application/json", "oai-authenticated-user-email": "sites-screenshot-service-noreply@chatgpt.com" } }, 403);
  const metadata = (fileName) => ({ "Content-Type": "application/octet-stream", "X-Devoteca-Metadata": encodeURIComponent(JSON.stringify({ title: "Security attachment", type: "document", fileName })) });
  await request("/api/files", { method: "PUT", headers: metadata("renamed.pdf"), body: "MZ executable bytes" }, 400);
  await request("/api/files", { method: "PUT", headers: metadata("fake.docx"), body: "not a zip" }, 400);
  await request("/api/files", { method: "PUT", headers: metadata("unsafe\u202efile.txt"), body: "text" }, 400);
  uploaded = (await request("/api/files", { method: "PUT", headers: metadata("safe.txt"), body: "Local security fixture." }, 201)).data.id;
  const download = await fetch(origin + "/api/files?id=" + uploaded, { headers: user });
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /^attachment;/);
  assert.equal(download.headers.get("content-type"), "application/octet-stream");
  assert.equal(download.headers.get("content-security-policy"), "default-src 'none'; sandbox");
  assert.equal(await download.text(), "Local security fixture.");
  await request("/api/library?id=" + uploaded, { method: "DELETE" });
  uploaded = null;
  // Atomic shared rate limit: rejected requests do not modify product content.
  const remaining = 60 - Math.floor(Date.now() / 1000) % 60;
  if (remaining < 10) await new Promise(resolve => setTimeout(resolve, remaining * 1000 + 100));
  const burstUser = { ...user, "oai-authenticated-user-id": "burst_" + stamp };
  const results = await Promise.all(Array.from({ length: 125 }, async () => {
    const response = await fetch(origin + "/api/library", { method: "PATCH", headers: { ...burstUser, Origin: origin, "Content-Type": "application/json" }, body: '{"id":"missing-security-fixture","action":"favorite","value":true}' });
    if (response.status === 429) assert.ok(Number(response.headers.get("retry-after")) > 0);
    await response.arrayBuffer();
    return response.status;
  }));
  assert.equal(results.filter(x => x === 404).length, 120);
  assert.equal(results.filter(x => x === 429).length, 5);
  console.log("PASS: private APIs, CSRF including missing Origin, bounded JSON streams, malformed bodies, minimized personal/storage data, safe download, renamed binary rejection, restricted service identity and atomic abuse limit.");
} finally {
  if (uploaded) await request("/api/library?id=" + uploaded, { method: "DELETE" });
}

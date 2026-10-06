import assert from "node:assert/strict";
const origin = process.env.DEVOTECA_TEST_URL || "http://127.0.0.1:8787";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error("Tests may only mutate a local preview.");
const people = {
  alice: {
    "oai-authenticated-user-id": "test_alice",
    "oai-authenticated-user-email": "alice@example.test",
  },
  bob: {
    "oai-authenticated-user-id": "test_bob",
    "oai-authenticated-user-email": "bob@example.test",
  },
};
async function call(path, options = {}, person = "alice", expected = 200) {
  const response = await fetch(origin + path, {
    ...options,
    headers: { Origin: origin, ...people[person], ...options.headers },
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}
const body = (value) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});
const draft = {
  title: "Ideia de teste " + Date.now(),
  description: "Criar um organizador de estudos.",
  inspiration: "Uma referência do grupo.",
  next_steps: "Construir um protótipo.",
  status: "idea",
  tags: "React, React, Python",
  links: ["https://example.com/reference?mode=ideas#start"],
  source_resource: "",
};
let projectId, resourceId;
try {
  assert.equal((await fetch(origin + "/api/projects")).status, 401);
  await call("/api/library");
  await call("/api/library", {}, "bob");
  const form = new FormData();
  form.set("title", "Inspiração de teste");
  form.set("type", "site");
  form.set("url", "https://example.com/source-" + Date.now());
  resourceId = (
    await call("/api/library", { method: "POST", body: form }, "alice", 201)
  ).id;
  projectId = (
    await call(
      "/api/projects",
      body({ ...draft, source_resource: resourceId }),
      "alice",
      201,
    )
  ).id;
  let shared = (await call("/api/projects", {}, "bob")).find(
    (p) => p.id === projectId,
  );
  assert.equal(shared.source_title, "Inspiração de teste");
  assert.deepEqual(JSON.parse(shared.tags), ["react", "python"]);
  assert.equal(shared.description, draft.description);
  assert.equal(shared.inspiration, draft.inspiration);
  await call(
    "/api/projects",
    body({
      ...draft,
      id: projectId,
      source_resource: resourceId,
      status: "building",
      title: "Editada pelo grupo",
    }),
    "bob",
  );
  shared = (await call("/api/projects")).find((p) => p.id === projectId);
  assert.equal(shared.title, "Editada pelo grupo");
  assert.equal(shared.status, "building");
  assert.equal(shared.author, "test_alice");
  await call(
    "/api/projects",
    body({ ...draft, status: "invalid" }),
    "alice",
    400,
  );
  await call("/api/projects", body({ ...draft, title: "" }), "alice", 400);
  await call(
    "/api/projects",
    body({ ...draft, description: "x".repeat(6001) }),
    "alice",
    400,
  );
  await call(
    "/api/projects",
    body({ ...draft, links: ["javascript:alert(1)"] }),
    "alice",
    400,
  );
  await call(
    "/api/projects",
    body({ ...draft, links: Array(11).fill("https://example.com") }),
    "alice",
    400,
  );
  await call(
    "/api/projects",
    body({ ...draft, source_resource: "missing-resource" }),
    "alice",
    404,
  );
  await call(
    "/api/projects",
    body({ ...draft, id: "missing-project" }),
    "alice",
    404,
  );
  await call("/api/projects", body(null), "alice", 400);
  await call(
    "/api/projects",
    {
      method: "POST",
      headers: {
        Origin: "https://foreign.test",
      },
    },
    "alice",
    403,
  );
  await call("/api/projects?id=" + projectId, { method: "DELETE" }, "bob", 403);
  await call("/api/library?id=" + resourceId, { method: "DELETE" });
  resourceId = undefined;
  assert.equal(
    (await call("/api/projects")).find((p) => p.id === projectId)
      .source_resource,
    null,
  );
  await call("/api/projects?id=" + projectId, { method: "DELETE" });
  projectId = undefined;
  console.log(
    "PASS: private access, shared persistent project ideas, invited collaborator editing, inspiration links, validation, author-only deletion and reference cleanup.",
  );
} finally {
  if (projectId)
    await call("/api/projects?id=" + projectId, { method: "DELETE" });
  if (resourceId)
    await call("/api/library?id=" + resourceId, { method: "DELETE" });
}

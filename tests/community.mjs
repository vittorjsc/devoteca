import assert from "node:assert/strict";
const origin = process.env.DEVOTECA_TEST_URL || "http://127.0.0.1:8787";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error("Tests may only mutate a local preview.");
const users = {
  alice: {
    "oai-authenticated-user-id": "community_test_alice",
    "oai-authenticated-user-email": "community-alice@example.test",
    "oai-authenticated-user-full-name": "Alice%20de%20teste",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  },
  bob: {
    "oai-authenticated-user-id": "community_test_bob",
    "oai-authenticated-user-email": "community-bob@example.test",
    "oai-authenticated-user-full-name": "Bob%20de%20teste",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  },
};
async function call(path, options = {}, who = "alice", status = 200) {
  const response = await fetch(origin + path, {
    ...options,
    headers: { ...users[who], ...options.headers },
  });
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(path + " " + response.status + ": " + raw);
  }
  assert.equal(response.status, status, path + " " + raw);
  return data;
}
const body = (value) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const put = (kind, bytes = png) => ({
  method: "PUT",
  headers: {
    "Content-Type": "application/octet-stream",
    "X-Devoteca-Image-Kind": kind,
  },
  body: bytes,
});
const postIds = [],
  mediaIds = [];
let resourceId, projectId, oldProfile;
try {
  for (const path of [
    "/api/community/feed",
    "/api/community/profile",
    "/api/community/media?id=missing",
  ])
    assert.equal((await fetch(origin + path)).status, 401);
  await call("/api/library");
  await call("/api/library", {}, "bob");
  oldProfile = await call("/api/community/profile");
  const photo = (await call("/api/community/media", put("post"), "alice", 201))
    .id;
  mediaIds.push(photo);
  assert.equal(
    (
      await fetch(origin + "/api/community/media?id=" + photo, {
        headers: users.bob,
      })
    ).status,
    404,
  );
  await call(
    "/api/community/posts",
    body({ body: "Foto que não é minha", image_id: photo }),
    "bob",
    403,
  );
  await call(
    "/api/community/media?id=" + photo,
    { method: "DELETE" },
    "bob",
    403,
  );
  const imagePost = (
    await call(
      "/api/community/posts",
      body({ body: "", image_id: photo, image_alt: "Imagem de teste local." }),
      "alice",
      201,
    )
  ).id;
  postIds.push(imagePost);
  const downloaded = await fetch(origin + "/api/community/media?id=" + photo, {
    headers: users.bob,
  });
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-type"), "image/png");
  assert.equal(downloaded.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png);
  await call(
    "/api/community/media?id=" + photo,
    { method: "DELETE" },
    "alice",
    409,
  );
  await call(
    "/api/community/posts",
    body({ body: "Outra publicação com a mesma foto", image_id: photo }),
    "alice",
    409,
  );
  await call("/api/community/posts", body({ body: "" }), "alice", 400);
  await call(
    "/api/community/posts",
    body({ body: "x".repeat(3001) }),
    "alice",
    400,
  );
  await call(
    "/api/community/media",
    put("post", Buffer.from('<svg onload="alert(1)"></svg>')),
    "alice",
    400,
  );
  await call(
    "/api/community/media",
    put("post", new Uint8Array(5 * 1024 * 1024 + 1)),
    "alice",
    413,
  );
  await call(
    "/api/community/posts",
    body({ id: imagePost, body: "Tentativa de edição" }),
    "bob",
    403,
  );
  await call(
    "/api/community/posts?id=" + imagePost,
    { method: "DELETE" },
    "bob",
    403,
  );
  await call(
    "/api/community/posts",
    body({
      id: imagePost,
      body: "Texto atualizado pelo autor.",
      image_id: photo,
      image_alt: "Imagem de teste local.",
    }),
  );
  const avatar = (
    await call("/api/community/media", put("avatar"), "alice", 201)
  ).id;
  mediaIds.push(avatar);
  await call(
    "/api/community/profile",
    body({
      name: "Alice da comunidade",
      bio: "Estudando computação e construindo projetos.",
      avatar_id: avatar,
    }),
  );
  await call(
    "/api/community/profile",
    body({
      id: users.alice["oai-authenticated-user-id"],
      name: "Outra pessoa",
      bio: "",
    }),
    "bob",
    403,
  );
  await call(
    "/api/community/profile",
    body({ name: "", bio: "" }),
    "alice",
    400,
  );
  await call(
    "/api/community/profile",
    body({ name: "Alice", bio: "x".repeat(501) }),
    "alice",
    400,
  );
  const profile = await call(
    "/api/community/profile?id=" + users.alice["oai-authenticated-user-id"],
    {},
    "bob",
  );
  assert.equal(profile.name, "Alice da comunidade");
  assert.equal(profile.bio, "Estudando computação e construindo projetos.");
  assert.equal(profile.avatar_id, avatar);
  assert.equal("email" in profile, false);
  const library = await call("/api/library");
  assert.equal(library.user.name, "Alice da comunidade");
  assert.equal(library.user.avatar_id, avatar);
  const form = new FormData();
  form.set("title", "Material de teste da comunidade");
  form.set("type", "site");
  form.set("url", "https://example.com/community-" + Date.now());
  resourceId = (
    await call("/api/library", { method: "POST", body: form }, "alice", 201)
  ).id;
  projectId = (
    await call(
      "/api/projects",
      body({
        title: "Ideia de teste da comunidade",
        description: "Conferir o feed combinado.",
        inspiration: "Teste local",
        links: [],
        tags: "test",
        status: "idea",
      }),
      "alice",
      201,
    )
  ).id;
  for (let i = 0; i < 32; i++)
    postIds.push(
      (
        await call(
          "/api/community/posts",
          body({ body: "Publicação de paginação " + i }),
          "alice",
          201,
        )
      ).id,
    );
  const first = await call(
    "/api/community/feed?member=" + users.alice["oai-authenticated-user-id"],
  );
  assert.equal(first.items.length, 30);
  assert.ok(first.next_cursor);
  const second = await call(
    "/api/community/feed?member=" +
      users.alice["oai-authenticated-user-id"] +
      "&cursor=" +
      encodeURIComponent(first.next_cursor),
  );
  const combined = [...first.items, ...second.items];
  assert.equal(
    new Set(combined.map((p) => p.kind + p.id)).size,
    combined.length,
  );
  assert.ok(combined.some((p) => p.kind === "resource" && p.id === resourceId));
  assert.ok(combined.some((p) => p.kind === "project" && p.id === projectId));
  assert.ok(
    combined.every(
      (p) =>
        p.author === users.alice["oai-authenticated-user-id"] &&
        p.author_name === "Alice da comunidade" &&
        p.avatar_id === avatar,
    ),
  );
  assert.ok(
    combined.every((p, i) => !i || combined[i - 1].created >= p.created),
  );
  const onlyPosts = await call(
    "/api/community/feed?kind=post&member=" +
      users.alice["oai-authenticated-user-id"],
  );
  assert.ok(onlyPosts.items.every((p) => p.kind === "post"));
  await call("/api/community/feed?kind=invalid", {}, "alice", 400);
  await call("/api/community/feed?cursor=invalid", {}, "alice", 400);
  await call(
    "/api/community/profile",
    body({ name: "Alice da comunidade", bio: profile.bio, avatar_id: null }),
  );
  assert.equal(
    (
      await fetch(origin + "/api/community/media?id=" + avatar, {
        headers: users.alice,
      })
    ).status,
    404,
  );
  await call("/api/community/posts?id=" + imagePost, { method: "DELETE" });
  postIds.splice(postIds.indexOf(imagePost), 1);
  assert.equal(
    (
      await fetch(origin + "/api/community/media?id=" + photo, {
        headers: users.alice,
      })
    ).status,
    404,
  );
  await call(
    "/api/community/posts",
    { method: "POST", headers: { Origin: "https://foreign.test" } },
    "alice",
    403,
  );
  console.log(
    "PASS: invited feed, mixed chronological activity and pagination, profiles persist across registration, private image bytes, own-profile/post permissions, image cleanup, size/type validation and origin protection.",
  );
} finally {
  for (const id of postIds)
    await call("/api/community/posts?id=" + id, { method: "DELETE" }).catch(
      (e) => console.error("cleanup post", e.message),
    );
  if (projectId)
    await call("/api/projects?id=" + projectId, { method: "DELETE" });
  if (resourceId)
    await call("/api/library?id=" + resourceId, { method: "DELETE" });
  if (oldProfile)
    await call(
      "/api/community/profile",
      body({
        name: oldProfile.name,
        bio: oldProfile.bio,
        avatar_id: oldProfile.avatar_id,
      }),
    );
  for (const id of mediaIds)
    await call("/api/community/media?id=" + id, { method: "DELETE" }).catch(
      (e) => console.error("cleanup image", e.message),
    );
}

import {
  ApiError,
  database,
  identity,
  register,
  json,
  fail,
  textValue,
} from "@/lib/library";
export async function GET(req: Request) {
  try {
    await identity(req);
    const id = textValue(new URL(req.url).searchParams.get("id"), 100, true);
    return json(
      (
        await database()
          .prepare(
            "SELECT c.*,m.name FROM comments c JOIN members m ON m.id=c.member WHERE resource=? ORDER BY created",
          )
          .bind(id)
          .all()
      ).results,
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    const u = await identity(req);
    await register(u);
    const b = (await req.json()) as Record<string, any>,
      id = textValue(b.id, 100, true),
      body = textValue(b.body, 1500, true);
    const db = database();
    if (
      !(await db
        .prepare("SELECT id FROM resources WHERE id=?")
        .bind(id)
        .first())
    )
      throw new ApiError("Material não encontrado.", 404);
    await db
      .prepare(
        "INSERT INTO comments (id,resource,member,body,created) VALUES (?,?,?,?,?)",
      )
      .bind(crypto.randomUUID(), id, u.userId, body, new Date().toISOString())
      .run();
    return json({ ok: true }, 201);
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const u = await identity(req);
    const id = textValue(new URL(req.url).searchParams.get("id"), 100, true);
    const db = database();
    const c = await db
      .prepare("SELECT member FROM comments WHERE id=?")
      .bind(id)
      .first<{ member: string }>();
    if (!c) throw new ApiError("Comentário não encontrado.", 404);
    if (c.member !== u.userId && !u.admin)
      throw new ApiError("Você não pode excluir esse comentário.", 403);
    await db.prepare("DELETE FROM comments WHERE id=?").bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

import {
  ApiError,
  database,
  identity,
  json,
  fail,
  textValue,
} from "@/lib/library";
export async function POST(req: Request) {
  try {
    await identity(req);
    const b = (await req.json()) as Record<string, any>,
      name = textValue(b.name, 50, true);
    const db = database();
    if (
      await db
        .prepare("SELECT id FROM categories WHERE lower(name)=lower(?)")
        .bind(name)
        .first()
    )
      throw new ApiError("Essa categoria já existe.", 409);
    const id = crypto.randomUUID();
    const color = [
      "blue",
      "green",
      "orange",
      "purple",
      "pink",
      "cyan",
    ].includes(b.color)
      ? b.color
      : "blue";
    await db
      .prepare("INSERT INTO categories (id,name,color) VALUES (?,?,?)")
      .bind(id, name, color)
      .run();
    return json({ id }, 201);
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const u = await identity(req);
    if (!u.admin)
      throw new ApiError(
        "Somente o administrador pode excluir categorias.",
        403,
      );
    const id = textValue(new URL(req.url).searchParams.get("id"), 100, true);
    const db = database();
    if (
      await db
        .prepare("SELECT id FROM resources WHERE category=? LIMIT 1")
        .bind(id)
        .first()
    )
      throw new ApiError(
        "Mova os materiais para outra categoria antes de excluir.",
      );
    await db.prepare("DELETE FROM categories WHERE id=?").bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

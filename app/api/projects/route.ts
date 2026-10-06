import {
  ApiError,
  database,
  identity,
  register,
  json,
  fail,
  textValue,
  validateUrl,
} from "@/lib/library";

export const dynamic = "force-dynamic";
const statuses = ["idea", "planning", "building", "done"];

export async function GET(req: Request) {
  try {
    await identity(req);
    const result = await database()
      .prepare(
        `SELECT p.*,COALESCE(pr.display_name,m.name) AS author_name,r.title AS source_title,COALESCE(r.url,CASE WHEN r.file_key IS NOT NULL THEN '/api/files?id='||r.id END) AS source_url
      FROM project_ideas p JOIN members m ON m.id=p.author LEFT JOIN profiles pr ON pr.member=m.id LEFT JOIN resources r ON r.id=p.source_resource
      ORDER BY p.updated DESC,p.id`,
      )
      .all();
    return json(result.results);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await identity(req);
    await register(user);
    const db = database();
    const parsed: unknown = await req.json().catch(() => {
      throw new ApiError(
        "Não foi possível ler os campos. Tente salvar novamente.",
      );
    });
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new ApiError("Revise os campos da ideia.");
    const b = parsed as Record<string, unknown>;
    const suppliedId = textValue(b.id, 100);
    const existing = suppliedId
      ? await db
          .prepare("SELECT author FROM project_ideas WHERE id=?")
          .bind(suppliedId)
          .first<{ author: string }>()
      : null;
    if (suppliedId && !existing)
      throw new ApiError("Essa ideia não existe mais. Atualize a lista.", 404);
    const title = textValue(b.title, 180, true),
      description = textValue(b.description, 6000, true);
    const inspiration = textValue(b.inspiration, 4000),
      nextSteps = textValue(b.next_steps, 4000);
    const status = textValue(b.status, 30, true);
    if (!statuses.includes(status))
      throw new ApiError("Selecione um status válido.");
    if (!Array.isArray(b.links) || b.links.length > 10)
      throw new ApiError("Adicione até 10 links de inspiração.");
    const links = [
      ...new Set(
        b.links.map((value) => {
          const url = validateUrl(value);
          if (!url) throw new ApiError("Revise os links de inspiração.");
          return url;
        }),
      ),
    ];
    const tags = [
      ...new Set(
        textValue(b.tags, 400)
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (tags.length > 10 || tags.some((t) => t.length > 35))
      throw new ApiError(
        "Use até 10 tecnologias ou tags, com até 35 caracteres cada.",
      );
    const source = textValue(b.source_resource, 100) || null;
    if (
      source &&
      !(await db
        .prepare("SELECT id FROM resources WHERE id=?")
        .bind(source)
        .first())
    )
      throw new ApiError(
        "O material de inspiração não existe mais. Escolha outro material.",
        404,
      );
    const now = new Date().toISOString(),
      id = suppliedId || crypto.randomUUID();
    if (existing)
      await db
        .prepare(
          "UPDATE project_ideas SET title=?,description=?,inspiration=?,links=?,tags=?,next_steps=?,status=?,source_resource=?,updated=? WHERE id=?",
        )
        .bind(
          title,
          description,
          inspiration,
          JSON.stringify(links),
          JSON.stringify(tags),
          nextSteps,
          status,
          source,
          now,
          id,
        )
        .run();
    else
      await db
        .prepare(
          "INSERT INTO project_ideas (id,title,description,inspiration,links,tags,next_steps,status,source_resource,author,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          title,
          description,
          inspiration,
          JSON.stringify(links),
          JSON.stringify(tags),
          nextSteps,
          status,
          source,
          user.userId,
          now,
          now,
        )
        .run();
    return json({ id }, existing ? 200 : 201);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await identity(req),
      db = database();
    const id = textValue(new URL(req.url).searchParams.get("id"), 100, true);
    const existing = await db
      .prepare("SELECT author FROM project_ideas WHERE id=?")
      .bind(id)
      .first<{ author: string }>();
    if (!existing) throw new ApiError("Ideia não encontrada.", 404);
    if (existing.author !== user.userId && !user.admin)
      throw new ApiError(
        "Somente o autor ou o administrador pode excluir esta ideia.",
        403,
      );
    await db.prepare("DELETE FROM project_ideas WHERE id=?").bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

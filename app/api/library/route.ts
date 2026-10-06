import {
  ApiError,
  database,
  identity,
  register,
  json,
  fail,
  resourceQuery,
  textValue,
  validateUrl,
  bucket,
  SCREENSHOT_SERVICE_EMAIL,
  objectBody,
  resourceForm,
  memberName,
  uploadBudget,
} from "@/lib/library";
import { validateDocument } from "@/lib/uploads";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = await identity(req);
    await register(u);
    const db = database();
    const [resources, categories, members] = await Promise.all([
      db.prepare(resourceQuery).bind(u.userId, u.userId).all(),
      db.prepare("SELECT * FROM categories ORDER BY name").all(),
      db
        .prepare(
          `SELECT m.id,COALESCE(p.display_name,${memberName}) AS name,m.joined,p.avatar AS avatar_id,COALESCE(p.bio,'') AS bio FROM members m LEFT JOIN profiles p ON p.member=m.id WHERE lower(m.email)<>? ORDER BY m.joined`,
        )
        .bind(SCREENSHOT_SERVICE_EMAIL)
        .all(),
    ]);
    const own = members.results.find((m) => m.id === u.userId);
    return json({
      resources: resources.results,
      categories: categories.results,
      members: members.results,
      user: {
        id: u.userId,
        name: own?.name || u.displayName,
        avatar_id: own?.avatar_id || null,
        admin: u.admin,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  return saveResource(req);
}
export async function saveResource(req: Request, providedForm?: FormData) {
  let uploadedKey: string | null = null;
  try {
    const u = await identity(req);
    await register(u);
    const db = database();
    const form = providedForm ?? (await resourceForm(req));
    const id = textValue(form.get("id"), 100) || crypto.randomUUID();
    const existing = await db
      .prepare("SELECT * FROM resources WHERE id=?")
      .bind(id)
      .first<{ author: string; file_key: string | null }>();
    if (existing && existing.author !== u.userId && !u.admin)
      throw new ApiError(
        "Somente o autor ou o administrador pode editar este material.",
        403,
      );
    const title = textValue(form.get("title"), 180, true),
      description = textValue(form.get("description"), 2000),
      type = textValue(form.get("type"), 30, true),
      url = validateUrl(form.get("url")),
      category = textValue(form.get("category"), 100) || null;
    if (
      !["github", "article", "course", "site", "document", "video"].includes(
        type,
      )
    )
      throw new ApiError("Selecione um tipo válido.");
    if (
      category &&
      !(await db
        .prepare("SELECT id FROM categories WHERE id=?")
        .bind(category)
        .first())
    )
      throw new ApiError("Categoria não encontrada.");
    const tags = [
      ...new Set(
        textValue(form.get("tags"), 400)
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (tags.length > 10 || tags.some((t) => t.length > 35))
      throw new ApiError("Use até 10 tags, com até 35 caracteres cada.");
    if (
      url &&
      (await db
        .prepare("SELECT id FROM resources WHERE url=? AND id<>?")
        .bind(url, id)
        .first())
    )
      throw new ApiError("Este link já está na biblioteca.", 409);
    const file = form.get("file");
    let fileKey = null,
      fileName = null,
      fileSize = null,
      fileType = null;
    if (file instanceof File && file.size) {
      if (existing)
        throw new ApiError(
          "Para substituir um arquivo, adicione um novo material.",
        );
      if (file.size > 20 * 1024 * 1024)
        throw new ApiError("O limite por arquivo é 20 MB.", 413);
      const allowed = [
        "pdf",
        "txt",
        "md",
        "doc",
        "docx",
        "ppt",
        "pptx",
        "xls",
        "xlsx",
        "csv",
        "zip",
        "png",
        "jpg",
        "jpeg",
        "webp",
      ];
      if (!allowed.includes(file.name.split(".").pop()?.toLowerCase() ?? ""))
        throw new ApiError(
          "Formato não permitido. Use PDF, documento, planilha, imagem ou ZIP.",
        );
      const bytes = new Uint8Array(await file.arrayBuffer());
      validateDocument(file.name, bytes);
      await uploadBudget(u.userId, bytes.length);
      fileKey = "documents/" + crypto.randomUUID();
      fileName = file.name.slice(0, 180);
      fileSize = file.size;
      fileType = file.type || "application/octet-stream";
      await bucket().put(fileKey, bytes, {
        httpMetadata: { contentType: "application/octet-stream" },
      });
      uploadedKey = fileKey;
    }
    if (!url && !fileKey && !existing?.file_key)
      throw new ApiError("Informe um link ou selecione um arquivo.");
    const now = new Date().toISOString();
    if (existing)
      await db
        .prepare(
          "UPDATE resources SET title=?,description=?,url=?,type=?,category=?,tags=?,updated=? WHERE id=?",
        )
        .bind(
          title,
          description,
          url,
          type,
          category,
          JSON.stringify(tags),
          now,
          id,
        )
        .run();
    else
      await db
        .prepare(
          "INSERT INTO resources (id,title,description,url,type,category,tags,author,created,updated,file_key,file_name,file_size,file_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          title,
          description,
          url,
          type,
          category,
          JSON.stringify(tags),
          u.userId,
          now,
          now,
          fileKey,
          fileName,
          fileSize,
          fileType,
        )
        .run();
    return json({ id }, existing ? 200 : 201);
  } catch (e) {
    if (uploadedKey) {
      try {
        await bucket().delete(uploadedKey);
      } catch {
        console.error("Could not clean up upload");
      }
    }
    return fail(e);
  }
}
export async function PATCH(req: Request) {
  try {
    const u = await identity(req);
    const db = database();
    const b = await objectBody(req);
    const id = textValue(b.id, 100, true);
    if (
      !(await db
        .prepare("SELECT id FROM resources WHERE id=?")
        .bind(id)
        .first())
    )
      throw new ApiError("Material não encontrado.", 404);
    if (b.action === "favorite" && typeof b.value === "boolean") {
      await db
        .prepare(
          b.value
            ? "INSERT OR IGNORE INTO favorites (member,resource) VALUES (?,?)"
            : "DELETE FROM favorites WHERE member=? AND resource=?",
        )
        .bind(u.userId, id)
        .run();
    } else if (
      b.action === "reading" &&
      typeof b.value === "string" &&
      ["unread", "reading", "done"].includes(b.value)
    ) {
      await db
        .prepare(
          "INSERT INTO readings (member,resource,status) VALUES (?,?,?) ON CONFLICT(member,resource) DO UPDATE SET status=excluded.status",
        )
        .bind(u.userId, id, b.value)
        .run();
    } else throw new ApiError("Ação inválida.");
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const u = await identity(req),
      id = textValue(new URL(req.url).searchParams.get("id"), 100, true);
    const db = database();
    const r = await db
      .prepare("SELECT author,file_key FROM resources WHERE id=?")
      .bind(id)
      .first<{ author: string; file_key: string | null }>();
    if (!r) throw new ApiError("Material não encontrado.", 404);
    if (r.author !== u.userId && !u.admin)
      throw new ApiError(
        "Somente o autor ou o administrador pode excluir.",
        403,
      );
    if (r.file_key) await bucket().delete(r.file_key);
    await db.prepare("DELETE FROM resources WHERE id=?").bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

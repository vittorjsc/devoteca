import {
  ApiError,
  database,
  identity,
  register,
  json,
  fail,
  textValue,
} from "@/lib/library";
import { objectBody, ownedImage, cleanupImage } from "@/lib/community";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const user = await identity(req);
    await register(user);
    const b = await objectBody(req),
      db = database();
    const supplied = textValue(b.id, 100),
      existing = supplied
        ? await db
            .prepare("SELECT author,image FROM posts WHERE id=?")
            .bind(supplied)
            .first<{ author: string; image: string | null }>()
        : null;
    if (supplied && !existing)
      throw new ApiError(
        "Essa publicação não existe mais. Atualize o feed.",
        404,
      );
    if (existing && existing.author !== user.userId && !user.admin)
      throw new ApiError(
        "Somente o autor ou administrador pode editar a publicação.",
        403,
      );
    const text = textValue(b.body, 3000),
      image = await ownedImage(
        b.image_id,
        user.userId,
        "post",
        existing?.image,
      ),
      alt = textValue(b.image_alt, 300);
    if (!text && !image)
      throw new ApiError("Escreva uma mensagem ou adicione uma foto.");
    const now = new Date().toISOString(),
      id = supplied || crypto.randomUUID();
    if (existing)
      await db
        .prepare(
          "UPDATE posts SET body=?,image=?,image_alt=?,updated=? WHERE id=?",
        )
        .bind(text, image, image ? alt : "", now, id)
        .run();
    else
      await db
        .prepare(
          "INSERT INTO posts (id,author,body,image,image_alt,created,updated) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(id, user.userId, text, image, image ? alt : "", now, now)
        .run();
    if (existing?.image && existing.image !== image)
      await cleanupImage(existing.image);
    return json({ id }, existing ? 200 : 201);
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const user = await identity(req),
      db = database(),
      id = textValue(new URL(req.url).searchParams.get("id"), 100, true);
    const post = await db
      .prepare("SELECT author,image FROM posts WHERE id=?")
      .bind(id)
      .first<{ author: string; image: string | null }>();
    if (!post) throw new ApiError("Publicação não encontrada.", 404);
    if (post.author !== user.userId && !user.admin)
      throw new ApiError(
        "Somente o autor ou administrador pode excluir a publicação.",
        403,
      );
    await db.prepare("DELETE FROM posts WHERE id=?").bind(id).run();
    await cleanupImage(post.image);
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

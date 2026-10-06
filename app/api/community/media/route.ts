import {
  ApiError,
  bucket,
  database,
  identity,
  register,
  json,
  fail,
  textValue,
} from "@/lib/library";
import { imageBytes, cleanupImage } from "@/lib/community";
export const dynamic = "force-dynamic";
export async function PUT(req: Request) {
  let objectKey: string | null = null;
  try {
    const user = await identity(req);
    await register(user);
    const kind = req.headers.get("X-Devoteca-Image-Kind");
    if (!["post", "avatar"].includes(kind || ""))
      throw new ApiError("Selecione a finalidade da foto.");
    const { bytes, type } = await imageBytes(req),
      id = crypto.randomUUID();
    objectKey = "community/" + id;
    await bucket().put(objectKey, bytes, {
      httpMetadata: { contentType: type },
    });
    await database()
      .prepare(
        "INSERT INTO community_media (id,owner,kind,object_key,content_type,size,created) VALUES (?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        user.userId,
        kind,
        objectKey,
        type,
        bytes.length,
        new Date().toISOString(),
      )
      .run();
    return json({ id }, 201);
  } catch (e) {
    if (objectKey) {
      try {
        await bucket().delete(objectKey);
      } catch {
        console.error("Could not clean up failed community upload");
      }
    }
    return fail(e);
  }
}
export async function GET(req: Request) {
  try {
    const user = await identity(req),
      id = textValue(new URL(req.url).searchParams.get("id"), 100, true);
    const file = await database()
      .prepare(
        `SELECT object_key,content_type FROM community_media WHERE id=? AND (owner=? OR EXISTS(SELECT 1 FROM posts WHERE image=community_media.id) OR EXISTS(SELECT 1 FROM profiles WHERE avatar=community_media.id))`,
      )
      .bind(id, user.userId)
      .first<{ object_key: string; content_type: string }>();
    if (!file) throw new ApiError("Foto não encontrada.", 404);
    const object = await bucket().get(file.object_key);
    if (!object) throw new ApiError("Foto indisponível.", 404);
    return new Response(object.body, {
      headers: {
        "Content-Type": file.content_type,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const user = await identity(req),
      id = textValue(new URL(req.url).searchParams.get("id"), 100, true);
    const file = await database()
      .prepare("SELECT owner FROM community_media WHERE id=?")
      .bind(id)
      .first<{ owner: string }>();
    if (!file) return json({ ok: true });
    if (file.owner !== user.userId)
      throw new ApiError("Você só pode remover suas próprias fotos.", 403);
    if (
      await database()
        .prepare(
          "SELECT id FROM posts WHERE image=? UNION ALL SELECT member FROM profiles WHERE avatar=? LIMIT 1",
        )
        .bind(id, id)
        .first()
    )
      throw new ApiError(
        "Remova a foto da publicação ou do perfil primeiro.",
        409,
      );
    await cleanupImage(id);
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

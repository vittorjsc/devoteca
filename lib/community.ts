import { ApiError, bucket, database, textValue } from "@/lib/library";

export const IMAGE_LIMIT = 5 * 1024 * 1024;
export async function objectBody(req: Request) {
  const value: unknown = await req.json().catch(() => {
    throw new ApiError("Não foi possível ler os campos. Tente novamente.");
  });
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("Revise os campos.");
  return value as Record<string, unknown>;
}
export async function imageBytes(req: Request) {
  if (!req.body) throw new ApiError("Selecione uma foto.");
  const reader = req.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > IMAGE_LIMIT) {
      await reader.cancel();
      throw new ApiError("A foto deve ter até 5 MB.", 413);
    }
    chunks.push(value);
  }
  if (!size) throw new ApiError("A foto está vazia.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let type: string | null = null;
  if (
    size >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  )
    type = "image/png";
  else if (
    size >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    type = "image/jpeg";
  else if (
    size >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    type = "image/webp";
  if (!type) throw new ApiError("Use uma foto JPG, PNG ou WebP.");
  return { bytes, type };
}
export async function ownedImage(
  idValue: unknown,
  owner: string,
  kind: string,
  existingId?: string | null,
) {
  const id = textValue(idValue, 100) || null;
  if (!id || id === existingId) return id;
  const row = await database()
    .prepare("SELECT owner,kind FROM community_media WHERE id=?")
    .bind(id)
    .first<{ owner: string; kind: string }>();
  if (!row || row.owner !== owner || row.kind !== kind)
    throw new ApiError(
      "Essa foto não está disponível para esta publicação ou perfil.",
      403,
    );
  if (
    kind === "post" &&
    (await database()
      .prepare("SELECT id FROM posts WHERE image=?")
      .bind(id)
      .first())
  )
    throw new ApiError(
      "Essa foto já está em outra publicação. Selecione o arquivo novamente.",
      409,
    );
  return id;
}
export async function cleanupImage(id: string | null) {
  if (!id) return;
  const removed = await database()
    .prepare(
      `DELETE FROM community_media WHERE id=? AND NOT EXISTS(SELECT 1 FROM posts WHERE image=?) AND NOT EXISTS(SELECT 1 FROM profiles WHERE avatar=?) RETURNING object_key`,
    )
    .bind(id, id, id)
    .first<{ object_key: string }>();
  if (removed) {
    try {
      await bucket().delete(removed.object_key);
    } catch (e) {
      console.error("Could not clean up unreferenced community image", e);
    }
  }
}
export async function profile(member: string) {
  const result = await database()
    .prepare(
      `SELECT m.id,COALESCE(p.display_name,m.name) AS name,COALESCE(p.bio,'') AS bio,p.avatar AS avatar_id,m.joined FROM members m LEFT JOIN profiles p ON p.member=m.id WHERE m.id=?`,
    )
    .bind(member)
    .first();
  if (!result) throw new ApiError("Perfil não encontrado.", 404);
  return result;
}

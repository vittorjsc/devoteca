import {
  ApiError,
  database,
  identity,
  register,
  json,
  fail,
  textValue,
} from "@/lib/library";
import { objectBody, ownedImage, cleanupImage, profile } from "@/lib/community";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const user = await identity(req);
    await register(user);
    return json(
      await profile(
        textValue(new URL(req.url).searchParams.get("id"), 100) || user.userId,
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    const user = await identity(req);
    await register(user);
    const b = await objectBody(req);
    if (b.id && b.id !== user.userId)
      throw new ApiError("Você só pode editar seu próprio perfil.", 403);
    const name = textValue(b.name, 60, true),
      bio = textValue(b.bio, 500),
      db = database();
    const old = await db
      .prepare("SELECT avatar FROM profiles WHERE member=?")
      .bind(user.userId)
      .first<{ avatar: string | null }>();
    const avatar = await ownedImage(
      b.avatar_id,
      user.userId,
      "avatar",
      old?.avatar,
    );
    await db
      .prepare(
        "INSERT INTO profiles (member,display_name,bio,avatar,updated) VALUES (?,?,?,?,?) ON CONFLICT(member) DO UPDATE SET display_name=excluded.display_name,bio=excluded.bio,avatar=excluded.avatar,updated=excluded.updated",
      )
      .bind(user.userId, name, bio, avatar, new Date().toISOString())
      .run();
    if (old?.avatar && old.avatar !== avatar) await cleanupImage(old.avatar);
    return json(await profile(user.userId));
  } catch (e) {
    return fail(e);
  }
}

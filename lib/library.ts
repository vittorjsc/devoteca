import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export const OWNER_EMAIL = (
  env.DEVOTECA_ADMIN_EMAIL || "seedy@sites.test"
).toLowerCase();
export const SCREENSHOT_SERVICE_EMAIL =
  "sites-screenshot-service-noreply@chatgpt.com";
export function database() {
  if (!env.DB) throw new Error("Armazenamento indisponível.");
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET) throw new Error("Arquivos indisponíveis.");
  return env.BUCKET;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function identity(request?: Request) {
  const user = await getChatGPTUser();
  if (!user) throw new ApiError("Entre com sua conta para continuar.", 401);
  if (request && !["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new ApiError("Origem não permitida.", 403);
  }
  return { ...user, admin: user.email.toLowerCase() === OWNER_EMAIL };
}
export async function register(user: Awaited<ReturnType<typeof identity>>) {
  if (user.email.toLowerCase() === SCREENSHOT_SERVICE_EMAIL) return;
  await database()
    .prepare(
      "INSERT INTO members (id,name,email,joined) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email",
    )
    .bind(user.userId, user.displayName, user.email, new Date().toISOString())
    .run();
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function fail(error: unknown) {
  if (error instanceof ApiError)
    return json({ error: error.message }, error.status);
  console.error("Devoteca storage operation failed", error);
  return json(
    {
      error:
        "Não foi possível acessar a biblioteca agora. Tente novamente; seus campos foram preservados.",
    },
    503,
  );
}
export const resourceQuery = `SELECT r.*,m.name AS author_name,EXISTS(SELECT 1 FROM favorites f WHERE f.resource=r.id AND f.member=?) AS favorite,COALESCE((SELECT status FROM readings s WHERE s.resource=r.id AND s.member=?),'unread') AS reading,(SELECT COUNT(*) FROM comments c WHERE c.resource=r.id) AS comment_count FROM resources r JOIN members m ON m.id=r.author ORDER BY r.created DESC`;
export function textValue(v: unknown, max: number, required = false) {
  if (typeof v !== "string") {
    if (required) throw new ApiError("Preencha os campos obrigatórios.");
    return "";
  }
  const s = v.trim();
  if (s.length > max || (required && !s))
    throw new ApiError(
      "Revise o tamanho dos campos e preencha os obrigatórios.",
    );
  return s;
}
export function validateUrl(value: unknown) {
  const s = textValue(value, 2048);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
      throw 0;
    return u.href;
  } catch {
    throw new ApiError("Use um link válido começando com https:// ou http://.");
  }
}

import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { sameOriginWrite } from "@/lib/security-headers";
export const OWNER_EMAIL = (env.DEVOTECA_ADMIN_EMAIL || "seedy@sites.test").toLowerCase();
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
    public retryAfter?: number,
  ) {
    super(message);
  }
}
const identities = new WeakMap<Request, Awaited<ReturnType<typeof getChatGPTUser>> & { admin: boolean }>();
export async function identity(request?: Request) {
  if (request && identities.has(request)) return identities.get(request)!;
  const user = await getChatGPTUser();
  if (!user) throw new ApiError("Entre com sua conta para continuar.", 401);
  if (request && !["GET", "HEAD"].includes(request.method)) {
    if (!sameOriginWrite(request))
      throw new ApiError("Origem não permitida.", 403);
    if (user.email.toLowerCase() === SCREENSHOT_SERVICE_EMAIL)
      throw new ApiError("Essa conta não pode alterar a biblioteca.", 403);
    await consumeLimit(user.userId, "write", 60, 120, 1);
  }
  const result = { ...user, admin: user.email.toLowerCase() === OWNER_EMAIL };
  if (request) identities.set(request, result);
  return result;
}
// Each user has one row per purpose. Conditional UPSERT is atomic across Workers.
export async function consumeLimit(member: string, purpose: string, seconds: number, limit: number, amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > limit) throw new ApiError("O envio excede o limite permitido.", 413);
  const window = Math.floor(Date.now() / (seconds * 1000));
  const accepted = await database().prepare(`INSERT INTO security_limits (member,purpose,window,used) VALUES (?,?,?,?)
    ON CONFLICT(member,purpose) DO UPDATE SET window=excluded.window,
    used=CASE WHEN security_limits.window=excluded.window THEN security_limits.used+excluded.used ELSE excluded.used END
    WHERE CASE WHEN security_limits.window=excluded.window THEN security_limits.used+excluded.used ELSE excluded.used END<=?
    RETURNING used`).bind(member, purpose, window, amount, limit).first();
  if (!accepted) throw new ApiError("O limite temporário de envios foi atingido. Aguarde e tente novamente; seus campos foram preservados.", 429, seconds - Math.floor(Date.now() / 1000) % seconds);
}
export async function uploadBudget(member: string, bytes: number) {
  await consumeLimit(member, "uploads", 3600, 100, 1);
  await consumeLimit(member, "upload_bytes", 86400, 250 * 1024 * 1024, bytes);
}
export async function bodyBytes(req: Request, limit: number) {
  const declared = req.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit))
    throw new ApiError("O envio excede o limite permitido.", 413);
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ApiError("O envio excede o limite permitido.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function objectBody(req: Request) {
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new ApiError("Envie os campos no formato JSON.", 415);
  const bytes = await bodyBytes(req, 64 * 1024);
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new ApiError("Não foi possível ler os campos. Tente novamente."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("Revise os campos.");
  return value as Record<string, unknown>;
}
export async function resourceForm(req: Request) {
  const type = req.headers.get("content-type") || "";
  if (!/^multipart\/form-data;\s*boundary=/i.test(type)) throw new ApiError("Envie os campos pelo formulário de material.", 415);
  const bytes = await bodyBytes(req, 20 * 1024 * 1024 + 64 * 1024);
  try { return await new Response(bytes, { headers: { "Content-Type": type } }).formData(); }
  catch { throw new ApiError("Não foi possível ler o material. Tente novamente."); }
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
export function json(data: unknown, status = 200, retryAfter?: number) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) },
  });
}
export function fail(error: unknown) {
  if (error instanceof ApiError)
    return json({ error: error.message }, error.status, error.retryAfter);
  // Do not log SQL parameters, private content, request headers or tokens.
  console.error("Devoteca operation failed", { type: error instanceof Error ? error.name : "UnknownError" });
  return json(
    {
      error:
        "Não foi possível acessar a biblioteca agora. Tente novamente; seus campos foram preservados.",
    },
    503,
  );
}
export const memberName = "CASE WHEN lower(m.name)=lower(m.email) THEN 'Membro da Devoteca' ELSE m.name END";
export const resourceQuery = `SELECT r.id,r.title,r.description,r.url,r.type,r.category,r.tags,r.author,r.created,r.updated,CASE WHEN r.file_key IS NOT NULL THEN 'attached' ELSE NULL END AS file_key,r.file_name,r.file_size,r.file_type,COALESCE(p.display_name,${memberName}) AS author_name,EXISTS(SELECT 1 FROM favorites f WHERE f.resource=r.id AND f.member=?) AS favorite,COALESCE((SELECT status FROM readings s WHERE s.resource=r.id AND s.member=?),'unread') AS reading,(SELECT COUNT(*) FROM comments c WHERE c.resource=r.id) AS comment_count FROM resources r JOIN members m ON m.id=r.author LEFT JOIN profiles p ON p.member=m.id ORDER BY r.created DESC`;
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

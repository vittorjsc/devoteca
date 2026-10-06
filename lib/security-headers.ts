export function sameOriginWrite(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const target = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === target;
  try { return new URL(request.headers.get("referer") || "").origin === target; }
  catch { return false; }
}

export function secureResponse(response: Response, privateContent = false) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  if (!headers.has("Content-Security-Policy"))
    headers.set("Content-Security-Policy", "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com https://*.openai.com");
  if (privateContent || headers.get("Content-Type")?.includes("text/html"))
    headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

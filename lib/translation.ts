const provider = "https://translate.google.com/";

export function translatedPageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const source = new URL(value);
    if (
      !["http:", "https:"].includes(source.protocol) ||
      source.username ||
      source.password
    )
      return null;
    const hostname = source.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      /^127\./.test(hostname) ||
      hostname === "[::1]"
    )
      return null;
    const url = new URL("translate", provider);
    url.searchParams.set("sl", "auto");
    url.searchParams.set("tl", "pt");
    url.searchParams.set("u", source.href);
    return url.href;
  } catch {
    return null;
  }
}

export function translatedTextUrl(value: string): string | null {
  const text = value.trim();
  if (!text || text.length > 5000) return null;
  const url = new URL(provider);
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", "pt");
  url.searchParams.set("text", text);
  url.searchParams.set("op", "translate");
  return url.href;
}

export const translatedDocumentUrl = provider + "?sl=auto&tl=pt&op=docs";

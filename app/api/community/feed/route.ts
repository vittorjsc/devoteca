import {
  ApiError,
  database,
  identity,
  json,
  fail,
  textValue,
  memberName,
} from "@/lib/library";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    await identity(req);
    const q = new URL(req.url).searchParams,
      kind = textValue(q.get("kind"), 20) || "all",
      member = textValue(q.get("member"), 100);
    if (!["all", "post", "resource", "project"].includes(kind))
      throw new ApiError("Filtro inválido.");
    let cursor = { created: "", kind: "", id: "" };
    const encoded = textValue(q.get("cursor"), 600);
    if (encoded) {
      try {
        cursor = JSON.parse(atob(encoded));
        if (
          typeof cursor.created !== "string" ||
          !Number.isFinite(Date.parse(cursor.created)) ||
          typeof cursor.id !== "string" ||
          cursor.id.length > 100 ||
          !["post", "resource", "project"].includes(cursor.kind)
        )
          throw 0;
      } catch {
        throw new ApiError(
          "Não foi possível continuar o feed. Atualize para tentar novamente.",
        );
      }
    }
    const result = await database()
      .prepare(
        `SELECT f.*,COALESCE(p.display_name,${memberName}) AS author_name,p.avatar AS avatar_id FROM (
      SELECT 'post' AS kind,id,author,created,updated,'' AS title,body,NULL AS url,NULL AS resource_type,NULL AS status,image AS image_id,image_alt FROM posts
      UNION ALL SELECT 'resource',id,author,created,updated,title,description,url,type,NULL,NULL,'' FROM resources
      UNION ALL SELECT 'project',id,author,created,updated,title,description,NULL,NULL,status,NULL,'' FROM project_ideas
    ) f JOIN members m ON m.id=f.author LEFT JOIN profiles p ON p.member=m.id
    WHERE (?='all' OR f.kind=?) AND (?='' OR f.author=?) AND (?='' OR f.created<? OR (f.created=? AND (f.kind<? OR (f.kind=? AND f.id<?))))
    ORDER BY f.created DESC,f.kind DESC,f.id DESC LIMIT 31`,
      )
      .bind(
        kind,
        kind,
        member,
        member,
        cursor.created,
        cursor.created,
        cursor.created,
        cursor.kind,
        cursor.kind,
        cursor.id,
      )
      .all<{ created: string; kind: string; id: string }>();
    const items = result.results.slice(0, 30),
      last = items[items.length - 1];
    return json({
      items,
      next_cursor:
        result.results.length > 30 && last
          ? btoa(
              JSON.stringify({
                created: last.created,
                kind: last.kind,
                id: last.id,
              }),
            )
          : null,
    });
  } catch (e) {
    return fail(e);
  }
}

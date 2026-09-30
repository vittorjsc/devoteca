declare namespace Cloudflare {
  interface Env {
    DEVOTECA_ADMIN_EMAIL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}

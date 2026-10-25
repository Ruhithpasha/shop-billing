// Bindings declared in wrangler.toml, available via `import { env } from "cloudflare:workers"`.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
  }
}

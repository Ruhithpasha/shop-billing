#!/usr/bin/env node
// One-command Cloudflare setup + deploy. Safe to re-run: existing resources are reused.
//
//   npm run setup:cloud              create/reuse D1, R2, Vectorize; migrate; deploy
//   npm run setup:cloud -- --seed    ...and add the 10 sample products if the database is empty
//
// Afterwards app/src/config.ts points at the deployed API.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(API_DIR, "..");
const WRANGLER_TOML = join(API_DIR, "wrangler.toml");
const APP_CONFIG = join(ROOT, "app", "src", "config.ts");
const SHARED = join(ROOT, "shared", "src", "index.ts");

const DB_NAME = "billing-db";
const BUCKET = "shop-billing-images";
const INDEX = "product-images";
const SEED = process.argv.includes("--seed");
// Overridable only so this script can be tested without a Cloudflare account.
const WRANGLER = process.env.WRANGLER_BIN ? [process.env.WRANGLER_BIN] : ["npx", "wrangler"];

// The Vectorize index must match the embedding model's output size.
const DIMENSIONS = Number(readFileSync(SHARED, "utf8").match(/EMBEDDING_DIMENSIONS = (\d+)/)?.[1]);
if (!DIMENSIONS) fail(`Couldn't read EMBEDDING_DIMENSIONS from ${SHARED}`);

/** Runs wrangler. `show` streams output to the terminal (and still captures it). */
function wrangler(args, { show = false, interactive = false } = {}) {
  const [cmd, ...pre] = WRANGLER;
  const r = spawnSync(cmd, [...pre, ...args], {
    cwd: API_DIR,
    encoding: "utf8",
    stdio: interactive ? "inherit" : ["inherit", "pipe", "pipe"],
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (show && !interactive) process.stdout.write(out);
  return { ok: r.status === 0, out };
}

function fail(message) {
  console.error(`\n✘ ${message}`);
  process.exit(1);
}

const step = (n, text) => console.log(`\n[${n}/7] ${text}`);
const json = (text) => JSON.parse(text.slice(text.search(/[[{]/)));

// 1. Login
step(1, "Cloudflare login");
if (!wrangler(["whoami", "--json"]).ok) {
  if (!wrangler(["login"], { interactive: true }).ok) fail("Login failed. Run `npx wrangler login` and try again.");
}
console.log("Logged in.");

// 2. D1 database, and its id in wrangler.toml
step(2, `D1 database "${DB_NAME}"`);
const findDb = () => {
  const r = wrangler(["d1", "list", "--json"]);
  if (!r.ok) fail(`Couldn't list D1 databases:\n${r.out}`);
  return json(r.out).find((d) => d.name === DB_NAME);
};
let db = findDb();
if (db) console.log(`Using existing database ${db.uuid}.`);
else {
  const r = wrangler(["d1", "create", DB_NAME], { show: true });
  if (!r.ok) fail("Couldn't create the D1 database.");
  db = findDb();
  if (!db) fail("Created the database but can't find it in `wrangler d1 list`.");
}
const toml = readFileSync(WRANGLER_TOML, "utf8");
// Only the first (top-level) database_id; the offline env keeps its local placeholder.
const patched = toml.replace(/^database_id = ".*"$/m, `database_id = "${db.uuid}"`);
if (patched !== toml) {
  writeFileSync(WRANGLER_TOML, patched);
  console.log("Wrote the database id into api/wrangler.toml.");
}

// 3. Tables (+ optional sample products)
step(3, "Database tables");
if (!wrangler(["d1", "migrations", "apply", DB_NAME, "--remote", "--env="], { interactive: true }).ok) {
  fail("Migrations failed (see above).");
}
if (SEED) {
  const r = wrangler(["d1", "execute", DB_NAME, "--remote", "--env=", "--json", "--command", "SELECT COUNT(*) AS n FROM products"]);
  const count = r.ok ? json(r.out)[0]?.results?.[0]?.n : undefined;
  if (count === 0) {
    if (!wrangler(["d1", "execute", DB_NAME, "--remote", "--env=", "--file=./scripts/seed.sql"], { show: true }).ok) {
      fail("Seeding failed.");
    }
    console.log("Added the sample products.");
  } else console.log(`Skipped sample products (database already has ${count ?? "some"} products).`);
}

// 4. R2 bucket for product photos
step(4, `R2 bucket "${BUCKET}"`);
const created = wrangler(["r2", "bucket", "create", BUCKET]);
if (created.ok) console.log("Created.");
else if (wrangler(["r2", "bucket", "list"]).out.includes(BUCKET)) console.log("Using existing bucket.");
else {
  fail(
    `Couldn't create the R2 bucket:\n${created.out}\nIf it mentions billing or R2 not enabled, open the Cloudflare dashboard → R2 once to enable it (the free plan is fine), then re-run.`,
  );
}

// 5. Vectorize index for photo embeddings
step(5, `Vectorize index "${INDEX}" (${DIMENSIONS} dimensions, cosine)`);
const existing = wrangler(["vectorize", "get", INDEX, "--json"]);
if (existing.ok) {
  const dims = json(existing.out)?.config?.dimensions;
  if (dims !== DIMENSIONS) {
    fail(
      `Index "${INDEX}" exists with ${dims} dimensions but the app makes ${DIMENSIONS}.\n` +
        `Delete it (npx wrangler vectorize delete ${INDEX}) and re-run; photos then need re-taking.`,
    );
  }
  console.log("Using existing index.");
} else if (
  !wrangler(["vectorize", "create", INDEX, `--dimensions=${DIMENSIONS}`, "--metric=cosine"], { show: true }).ok
) {
  fail("Couldn't create the Vectorize index.");
}

// 6. Deploy
step(6, "Deploy the API");
const deploy = wrangler(["deploy", "--env="], { show: true });
if (!deploy.ok) fail("Deploy failed (see above).");
const url = deploy.out.match(/https:\/\/[\w.-]+\.workers\.dev/)?.[0];
if (!url) fail("Deployed, but couldn't find the workers.dev URL in the output. Set API_BASE_URL in app/src/config.ts yourself.");

// 7. Point the app at it
step(7, "Point the app at the deployed API");
const config = readFileSync(APP_CONFIG, "utf8");
const updated = config.replace(/^export const API_BASE_URL = ".*";$/m, `export const API_BASE_URL = "${url}";`);
if (updated === config && !config.includes(url)) fail(`Couldn't find API_BASE_URL in ${APP_CONFIG}.`);
writeFileSync(APP_CONFIG, updated);
console.log(`app/src/config.ts → ${url}`);

try {
  const res = await fetch(url);
  console.log(res.ok ? `Health check OK: ${await res.text()}` : `Health check returned ${res.status}.`);
} catch {
  console.log("Health check couldn't connect yet; new workers.dev URLs can take a minute to work.");
}

console.log(`
✔ Done. API: ${url}

Next, build the Android app (from the app folder):
  npx eas-cli@latest build --profile preview --platform android
`);

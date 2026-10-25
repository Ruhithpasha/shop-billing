# Shop Billing (prototype)

Scan a product, pick the match, add it to a bill. Bills can be edited, held, resumed, merged and paid.
No authentication (prototype). Everything runs on Cloudflare free tiers.

```
/api     Express API running on Cloudflare Workers (D1 database)
/shared  zod schemas + TypeScript types shared by api and app
/app     Expo app (Expo SDK 58, expo-router, TanStack Query)
```

Money is stored as integers in the smallest currency unit (pence). `kg` products are priced per kg.

---

## Phase 1 — API

### Run locally

Needs Node 20+ and `jq` for the smoke test (`brew install jq` on macOS).
Run each command on its own line; the code blocks below have no comments, so they paste cleanly into zsh.

From the repo root, install all workspaces, then create the local tables and seed 10 sample products
(seeding is safe to re-run). The local D1 database is a SQLite file in `api/.wrangler/state/`.

```bash
npm install
cd api
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Wait for `Ready on http://localhost:8787`. Then, in a second terminal in `api/`, run the end-to-end
check of every endpoint. It should end with `All 36 checks passed`.

```bash
./scripts/smoke.sh
```

### Deploy to Cloudflare (cloud)

`wrangler login` opens a browser (a free Cloudflare account is fine). `wrangler d1 create` prints a
`database_id`: paste it into `api/wrangler.toml` before running the remote migrate. `npm run deploy`
prints your URL, `https://shop-billing-api.<subdomain>.workers.dev`.

```bash
cd api
npx wrangler login
npx wrangler d1 create billing-db
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy
```

Then run the smoke test against the deployed URL:

```bash
./scripts/smoke.sh https://shop-billing-api.<subdomain>.workers.dev
```

### Endpoints and curl examples

Set the base URL first (or use your workers.dev URL). Errors are always `{ "error": "..." }`.

```bash
API=http://localhost:8787
```

**Products**

| Request | What it does |
|---|---|
| `GET /products` | list all |
| `GET /products?search=milk` | search by name (or exact barcode) |
| `GET /products/barcode/:code` | exact barcode lookup, 404 if none |
| `GET /products/:id` | one product |
| `POST /products` | create `{ name, price, barcode?, unit }` |
| `PATCH /products/:id` | update any of those fields |
| `DELETE /products/:id` | delete; 409 if the product is on any bill |

```bash
curl "$API/products"
curl "$API/products?search=milk"
curl "$API/products/barcode/5449000000996"
curl "$API/products/1"
curl -X POST "$API/products" -H 'Content-Type: application/json' -d '{"name":"Apples (loose)","price":300,"unit":"kg"}'
curl -X POST "$API/products" -H 'Content-Type: application/json' -d '{"name":"Orange Juice 1L","price":189,"barcode":"5012345678900","unit":"piece"}'
curl -X PATCH "$API/products/1" -H 'Content-Type: application/json' -d '{"price":120}'
curl -X DELETE "$API/products/11"
```

**Bills**

| Request | What it does |
|---|---|
| `POST /bills` | new open bill |
| `GET /bills`, `GET /bills?status=held` | list (newest first); status is open, held, paid or merged |
| `GET /bills/:id` | bill with items and product names |
| `POST /bills/:id/items` | add `{ product_id, qty }`; same product again increases qty |
| `PATCH /bills/:id/items/:itemId` | set `{ qty }`; 0 removes the item |
| `DELETE /bills/:id/items/:itemId` | remove an item |
| `POST /bills/:id/hold`, `/resume`, `/pay` | change status |
| `POST /bills/:targetId/merge/:sourceId` | merge source into target |

```bash
curl -X POST "$API/bills"
curl "$API/bills"
curl "$API/bills?status=held"
curl "$API/bills/1"
curl -X POST "$API/bills/1/items" -H 'Content-Type: application/json' -d '{"product_id":1,"qty":2}'
curl -X POST "$API/bills/1/items" -H 'Content-Type: application/json' -d '{"product_id":8,"qty":0.75}'
curl -X PATCH "$API/bills/1/items/1" -H 'Content-Type: application/json' -d '{"qty":3}'
curl -X DELETE "$API/bills/1/items/1"
curl -X POST "$API/bills/1/hold"
curl -X POST "$API/bills/1/resume"
curl -X POST "$API/bills/1/pay"
curl -X POST "$API/bills/1/merge/2"
```

### Rules the API enforces

- Only `open` / `held` bills can be edited or merged; `paid` and `merged` bills return 409.
- A bill can't be merged into itself (400). Merge is one D1 batch (one transaction): items move,
  matching products combine qty, source becomes `merged` with `merged_into`, target total recalculated.
  When both bills have the same product, the target's `price_at_sale` is kept.
- Totals are always recalculated on the server: `sum(round(qty × price_at_sale))`.
- `price_at_sale` is captured when a product first lands on a bill, so later price changes never alter old bills.
- `piece` products need whole-number qty; `kg` qty is kept to 3 decimals (1 g).
- Paying an empty bill is rejected (409).

### Free-tier limits to know (Workers Free + D1 Free)

- **Workers:** 100,000 requests/day, 10 ms CPU per request. This API is plain SQL so it sits far below that.
- **D1:** 5 GB total storage, 5 million rows read/day, 100,000 rows written/day. A bill operation writes
  a handful of rows, so a single shop won't get near it. Listing large tables counts every row scanned as
  a read, which is why list endpoints are capped (500 products, 200 bills).
- Over a limit, requests fail with errors until the daily reset (00:00 UTC); nothing is billed on the free plan.

---

## Phase 2 — App (products + billing, manual search)

Screens: **Bill** (current bill: edit qty, swipe left to delete, Hold / Merge in / Pay), **Add item**
(search, pick, quantity, add), **Held** (resume or merge into current), **Products** (search, add, edit,
delete) and **History** (paid bills, read-only).

The API address lives in one file: `app/src/config.ts`. Change `API_BASE_URL` there.

### Quickest check: in a browser on your Mac

Start the API (`npm run dev` in `api/`), then in a second terminal:

```bash
cd app
npm run web
```

Press `w` if the browser doesn't open by itself. `API_BASE_URL` is `http://localhost:8787` by default, which works here.

### On an Android phone (development build)

The app runs as an Expo development build, not Expo Go. Build it once in the cloud with EAS (free Expo
account). You only rebuild when native libraries change: phase 3 (camera) will need one rebuild.

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --profile development --platform android
```

When the build finishes, open the link it prints on the phone and install the APK. Then start the dev server:

```bash
npm start
```

Open the installed **Shop Billing** app and scan the QR code shown in the terminal (phone and Mac on the
same Wi-Fi).

The phone can't reach `localhost` on your Mac. Pick one:

- **Use the cloud API (recommended):** deploy it (Phase 1, "Deploy to Cloudflare") and set
  `API_BASE_URL` to your `https://shop-billing-api.<subdomain>.workers.dev` URL.
- **Use your Mac over Wi-Fi:** find the Mac's IP with `ipconfig getifaddr en0`, set
  `API_BASE_URL = "http://<that IP>:8787"`, and start the API with `npm run dev:lan` instead of `npm run dev`.

### iPhone

`npx expo run:ios` runs the app in the iOS Simulator (needs Xcode). Installing a development build on a
real iPhone needs a paid Apple Developer account, so for a free setup use Android.

### Free-tier notes

- **EAS Build (Expo free plan):** a limited number of cloud builds per month, in a lower-priority queue,
  so a build can wait in line for a while. Check current numbers at https://expo.dev/pricing.
  Code changes don't need a rebuild: `npm start` reloads them instantly.
- Every screen talks to the same API, so the Workers and D1 limits from Phase 1 still apply.

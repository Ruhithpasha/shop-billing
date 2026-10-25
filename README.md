# Shop Billing (prototype)

Scan a product, pick the match, add it to a bill. Bills can be edited, held, resumed, merged and paid.
No authentication (prototype). Everything runs on Cloudflare free tiers.

```
/api     Express API running on Cloudflare Workers (D1 database)
/shared  zod schemas + TypeScript types shared by api and app
/app     Expo app (phase 2+)
```

Money is stored as integers in the smallest currency unit (pence). `kg` products are priced per kg.

---

## Phase 1 — API

### Run locally

Needs Node 20+ and `jq` (for the smoke test).

```bash
npm install                                   # from repo root (installs all workspaces)
cd api
npm run db:migrate:local                      # creates tables in a local SQLite D1
npm run db:seed:local                         # 10 sample products (safe to re-run)
npm run dev                                   # http://localhost:8787
```

In a second terminal:

```bash
cd api
./scripts/smoke.sh                            # runs ~36 checks against every endpoint
```

### Deploy to Cloudflare (cloud)

```bash
cd api
npx wrangler login                            # opens browser, free Cloudflare account is fine
npx wrangler d1 create billing-db             # copy the printed database_id into wrangler.toml
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy                                # prints https://shop-billing-api.<subdomain>.workers.dev
./scripts/smoke.sh https://shop-billing-api.<subdomain>.workers.dev
```

### Endpoints and curl examples

Set `API=http://localhost:8787` (or your workers.dev URL). Errors are always `{ "error": "..." }`.

**Products**

```bash
curl "$API/products"                                   # list
curl "$API/products?search=milk"                       # search by name (or exact barcode)
curl "$API/products/barcode/5449000000996"             # exact barcode lookup (404 if none)
curl "$API/products/1"                                 # one product
curl -X POST "$API/products" -H 'Content-Type: application/json' \
  -d '{"name":"Apples (loose)","price":300,"unit":"kg"}'
curl -X POST "$API/products" -H 'Content-Type: application/json' \
  -d '{"name":"Orange Juice 1L","price":189,"barcode":"5012345678900","unit":"piece"}'
curl -X PATCH "$API/products/1" -H 'Content-Type: application/json' -d '{"price":120}'
curl -X DELETE "$API/products/11"                      # 409 if the product is on any bill
```

**Bills**

```bash
curl -X POST "$API/bills"                              # new open bill -> {"id":1,...}
curl "$API/bills"                                      # all bills (newest first)
curl "$API/bills?status=held"                          # open | held | paid | merged
curl "$API/bills/1"                                    # bill + items + product names

# add item (adding the same product again increases qty)
curl -X POST "$API/bills/1/items" -H 'Content-Type: application/json' -d '{"product_id":1,"qty":2}'
curl -X POST "$API/bills/1/items" -H 'Content-Type: application/json' -d '{"product_id":8,"qty":0.75}'

# change qty (0 removes the item) / delete item
curl -X PATCH  "$API/bills/1/items/1" -H 'Content-Type: application/json' -d '{"qty":3}'
curl -X DELETE "$API/bills/1/items/1"

curl -X POST "$API/bills/1/hold"
curl -X POST "$API/bills/1/resume"
curl -X POST "$API/bills/1/pay"

# merge bill 2 into bill 1
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

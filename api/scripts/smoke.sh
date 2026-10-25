#!/usr/bin/env bash
# End-to-end check of every endpoint. Usage:
#   ./scripts/smoke.sh                                   # local (wrangler dev)
#   ./scripts/smoke.sh https://shop-billing-api.<you>.workers.dev
# Needs: curl, jq. Creates a few test bills/products; safe to run repeatedly.
set -euo pipefail
API="${1:-http://localhost:8787}"
PASS=0

call() { # method path [json]  -> prints body, stores status in $CODE
  local out
  out=$(curl -s -w '\n%{http_code}' -X "$1" "$API$2" -H 'Content-Type: application/json' ${3:+-d "$3"})
  CODE=$(tail -n1 <<<"$out"); BODY=$(sed '$d' <<<"$out")
}
expect() { # expected_status description [jq_expr expected_value]
  if [[ "$CODE" != "$1" ]]; then echo "FAIL ($CODE != $1): $2"; echo "$BODY"; exit 1; fi
  if [[ $# -ge 4 ]]; then
    local got; got=$(jq -r "$3" <<<"$BODY")
    if [[ "$got" != "$4" ]]; then echo "FAIL ($3 = $got, want $4): $2"; echo "$BODY"; exit 1; fi
  fi
  PASS=$((PASS+1)); echo "ok  $2"
}

# ---- Products ----
call GET "/products";                    expect 200 "list products"
call GET "/products?search=milk";        expect 200 "search by name" '.[0].name' 'Whole Milk 1L'
call GET "/products/barcode/5449000000996"; expect 200 "barcode lookup" '.name' 'Cola 330ml Can'
call GET "/products/barcode/0000";       expect 404 "unknown barcode -> 404" '.error|type' 'string'

BC="TEST$RANDOM$RANDOM"
call POST "/products" "{\"name\":\"Test Apples\",\"price\":300,\"barcode\":\"$BC\",\"unit\":\"kg\"}"
expect 201 "create product" '.unit' 'kg'; PID=$(jq .id <<<"$BODY")
call POST "/products" "{\"name\":\"Dup\",\"price\":1,\"barcode\":\"$BC\"}"; expect 409 "duplicate barcode -> 409"
call POST "/products" '{"name":"","price":1.5}';  expect 400 "invalid product -> 400"
call PATCH "/products/$PID" '{"price":320}';      expect 200 "update product" '.price' '320'

MILK=$(curl -s "$API/products/barcode/5000128104517" | jq .id)   # 115/piece
COLA=$(curl -s "$API/products/barcode/5449000000996" | jq .id)   # 85/piece

# ---- Bills ----
call POST "/bills"; expect 201 "create bill A" '.status' 'open'; A=$(jq .id <<<"$BODY")
call POST "/bills/$A/items" "{\"product_id\":$MILK,\"qty\":2}"; expect 201 "add milk x2" '.total' '230'
call POST "/bills/$A/items" "{\"product_id\":$MILK,\"qty\":1}"; expect 201 "add milk again -> qty 3, one row" '.items|length' '1'
[[ $(jq '.items[0].qty' <<<"$BODY") == 3 ]] || { echo "FAIL qty"; exit 1; }
call POST "/bills/$A/items" "{\"product_id\":$PID,\"qty\":0.75}"; expect 201 "add 0.75 kg apples" '.total' '585'
call POST "/bills/$A/items" "{\"product_id\":$MILK,\"qty\":1.5}"; expect 400 "fractional qty on piece item -> 400"

# Price change must not affect price already on the bill
call PATCH "/products/$PID" '{"price":999}'; expect 200 "raise apple price"
call GET "/bills/$A"; expect 200 "bill keeps price_at_sale" '.total' '585'

ITEM=$(jq '.items[] | select(.product_id=='$MILK') | .id' <<<"$BODY")
call PATCH "/bills/$A/items/$ITEM" '{"qty":1}'; expect 200 "set milk qty 1" '.total' '355'

call POST "/bills"; expect 201 "create bill B"; B=$(jq .id <<<"$BODY")
call POST "/bills/$B/items" "{\"product_id\":$MILK,\"qty\":2}"; expect 201 "B: milk x2"
call POST "/bills/$B/items" "{\"product_id\":$COLA,\"qty\":4}"; expect 201 "B: cola x4" '.total' '570'
call POST "/bills/$B/hold";   expect 200 "hold B" '.status' 'held'
call GET "/bills?status=held"; expect 200 "list held bills"
call POST "/bills/$B/hold";   expect 409 "hold a held bill -> 409"

call POST "/bills/$A/merge/$A"; expect 400 "merge into itself -> 400"
call POST "/bills/$A/merge/$B"; expect 200 "merge B into A" '.items|length' '3'
# A: milk 1+2=3 (345) + apples 0.75kg@320 (240) + cola 4 (340) = 925
[[ $(jq '.total' <<<"$BODY") == 925 ]] || { echo "FAIL merged total $(jq .total <<<"$BODY")"; exit 1; }
call GET "/bills/$B"; expect 200 "B is merged into A" '.merged_into' "$A"
[[ $(jq -r '.status' <<<"$BODY") == merged && $(jq '.items|length' <<<"$BODY") == 0 ]] || { echo "FAIL B state"; exit 1; }
call POST "/bills/$B/items" "{\"product_id\":$MILK,\"qty\":1}"; expect 409 "merged bill is read-only"

call POST "/bills/$A/hold";   expect 200 "hold A"
call POST "/bills/$A/resume"; expect 200 "resume A" '.status' 'open'
call DELETE "/bills/$A/items/$ITEM"; expect 200 "delete milk line" '.total' '580'
call POST "/bills/$A/pay";    expect 200 "pay A" '.status' 'paid'
call POST "/bills/$A/items" "{\"product_id\":$MILK,\"qty\":1}"; expect 409 "paid bill is read-only"
call GET "/bills?status=paid"; expect 200 "bill history"

call POST "/bills"; C=$(jq .id <<<"$BODY")
call POST "/bills/$C/pay"; expect 409 "pay empty bill -> 409"

call DELETE "/products/$PID"; expect 409 "can't delete product used on a bill"
call POST "/products" '{"name":"Throwaway","price":1}'; T=$(jq .id <<<"$BODY")
call DELETE "/products/$T"; expect 200 "delete unused product"
call GET "/nope"; expect 404 "unknown route -> JSON 404" '.error' 'Not found'

# ---- Online barcode lookup (Open Food Facts, then UPCitemdb) ----
call GET "/lookup/barcode/NOT-A-GTIN"; expect 404 "non-retail code isn't looked up online"
call GET "/lookup/barcode/5449000000996"
if [[ "$CODE" == 200 ]]; then expect 200 "online lookup found Coca-Cola" '.source' 'openfoodfacts'
else echo "skip online lookup returned $CODE (no internet from the API?)"; fi

echo "All $PASS checks passed against $API"

import type { BarcodeLookup } from "@shop/shared";

// Free public barcode databases. None needs an API key.
// The Open Food Facts family (same API, run in parallel):
//   Open Food Facts      groceries and drinks (millions of products)
//   Open Products Facts  general goods (stationery, household, electronics...)
//   Open Beauty Facts    cosmetics and toiletries
// Web search (optional, India): if a Brave Search API key is set, the barcode
//   number is searched with country=IN and the product name is taken from an
//   Indian shop's listing (BigBasket, JioMart, Amazon.in, ...). Best coverage
//   for Indian products, which the free databases mostly lack.
// UPCitemdb trial: general retail goods, mostly US; ~100 lookups/day per IP. Tried last.

const USER_AGENT = "ShopBilling/0.1 (prototype billing app)";
const TIMEOUT_MS = 4000;

/** Lookups only make sense for retail GTINs (EAN-8, UPC-A, EAN-13, GTIN-14). */
export const isRetailBarcode = (code: string) => /^\d{8,14}$/.test(code);

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Appends `quantity` (e.g. "330 ml") to the name unless it's already there. */
function withQuantity(name: string, quantity: string | null) {
  if (!quantity || name.toLowerCase().includes(quantity.toLowerCase())) return name;
  return `${name} ${quantity}`;
}

type OpenFactsSource = "openfoodfacts" | "openproductsfacts" | "openbeautyfacts";

const OPEN_FACTS: { source: OpenFactsSource; host: string; label: string }[] = [
  { source: "openfoodfacts", host: "world.openfoodfacts.org", label: "Open Food Facts" },
  { source: "openproductsfacts", host: "world.openproductsfacts.org", label: "Open Products Facts" },
  { source: "openbeautyfacts", host: "world.openbeautyfacts.org", label: "Open Beauty Facts" },
];

/** Parses a response from any Open Food Facts-family database (they share one format). */
export function fromOpenFoodFacts(
  code: string,
  json: unknown,
  source: OpenFactsSource = "openfoodfacts",
): BarcodeLookup | null {
  const data = json as { status?: number; product?: Record<string, unknown> } | null;
  if (!data || data.status !== 1 || !data.product) return null;
  const p = data.product;
  const baseName = str(p.product_name) ?? str(p.generic_name);
  const brand = str(p.brands)?.split(",")[0].trim() ?? null;
  if (!baseName && !brand) return null;
  let name = baseName ?? brand!;
  if (brand && baseName && !baseName.toLowerCase().includes(brand.toLowerCase())) name = `${brand} ${baseName}`;
  return {
    barcode: code,
    name: withQuantity(name, str(p.quantity)),
    brand,
    image_url: str(p.image_front_small_url) ?? str(p.image_front_url) ?? str(p.image_url),
    source,
    source_label: OPEN_FACTS.find((s) => s.source === source)!.label,
  };
}

export function fromUpcItemDb(code: string, json: unknown): BarcodeLookup | null {
  const data = json as { code?: string; items?: Array<Record<string, unknown>> } | null;
  const item = data?.code === "OK" ? data.items?.[0] : undefined;
  const title = item && str(item.title);
  if (!item || !title) return null;
  const images = Array.isArray(item.images) ? item.images : [];
  return {
    barcode: code,
    name: title,
    brand: str(item.brand),
    image_url: str(images.find((u) => typeof u === "string" && u.startsWith("https://"))),
    source: "upcitemdb",
    source_label: "UPCitemdb",
  };
}

async function getJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Open Food Facts answers 404 with a JSON body for unknown products.
    return await res.json();
  } catch {
    return null;
  }
}

// Indian shopping sites, preferred when picking a search result.
const INDIAN_SHOPS = [
  "bigbasket.com",
  "jiomart.com",
  "amazon.in",
  "flipkart.com",
  "blinkit.com",
  "zeptonow.com",
  "swiggy.com",
  "dmart.in",
  "smartbazaar",
  "nykaa.com",
  "1mg.com",
  "pharmeasy.in",
  "netmeds.com",
  "meesho.com",
];

/** Turns a shop listing's page title into a product name, or null if it doesn't look like one. */
export function productNameFromTitle(title: string, code: string): string | null {
  let t = title.replace(/\s+/g, " ").trim();
  t = t.replace(/^buy\s+/i, "");
  // Product name comes first; the site name and category follow a separator.
  t = t.split(/\s+[|:–—-]\s+|\s*:\s+/)[0];
  t = t
    .replace(/\s+(online\s+)?(at|@)\s+(the\s+)?(best|lowest)\s+price.*$/i, "")
    .replace(/\s+online(\s+in\s+india)?$/i, "")
    .replace(/\s+price\s+in\s+india.*$/i, "")
    .replace(/[\s,.-]+$/, "")
    .trim();
  if (t.length < 3 || t.length > 120) return null;
  if (t.includes(code) || /\b(barcode|ean|upc|gtin|lookup)\b/i.test(t)) return null;
  if (!/[a-z]{3}/i.test(t)) return null;
  return t;
}

interface SearchResult {
  title?: string;
  url?: string;
  thumbnail?: { src?: string };
}

/** Picks a product name from Brave Search results, preferring Indian shopping sites. */
export function fromWebSearch(code: string, json: unknown): BarcodeLookup | null {
  const results = ((json as { web?: { results?: SearchResult[] } } | null)?.web?.results ?? []).filter(
    (r) => typeof r.title === "string" && typeof r.url === "string",
  );
  const isShop = (r: SearchResult) => INDIAN_SHOPS.some((d) => r.url!.includes(d));
  const ordered = [...results.filter(isShop), ...results.filter((r) => !isShop(r))];
  for (const r of ordered) {
    const name = productNameFromTitle(r.title!, code);
    if (!name) continue;
    let site = "web";
    try {
      site = new URL(r.url!).hostname.replace(/^www\./, "");
    } catch {}
    return {
      barcode: code,
      name,
      brand: null,
      image_url: str(r.thumbnail?.src),
      source: "websearch",
      source_label: `Web search (${site})`,
    };
  }
  return null;
}

async function searchWeb(code: string, apiKey: string): Promise<unknown> {
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${code}&country=IN&search_lang=en&count=10`,
      {
        headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Returns the first match from the public databases, or null. */
export async function lookupBarcodeOnline(
  code: string,
  options: { braveSearchKey?: string } = {},
): Promise<BarcodeLookup | null> {
  if (!isRetailBarcode(code)) return null;
  const fields = "product_name,generic_name,brands,quantity,image_front_small_url,image_front_url,image_url";
  // Ask the whole family at once; prefer them in the order listed.
  const results = await Promise.all(
    OPEN_FACTS.map(async (s) =>
      fromOpenFoodFacts(code, await getJson(`https://${s.host}/api/v2/product/${code}.json?fields=${fields}`), s.source),
    ),
  );
  const found = results.find((r) => r != null);
  if (found) return found;
  if (options.braveSearchKey) {
    const web = fromWebSearch(code, await searchWeb(code, options.braveSearchKey));
    if (web) return web;
  }
  return fromUpcItemDb(code, await getJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`));
}

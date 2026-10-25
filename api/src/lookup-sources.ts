import type { BarcodeLookup } from "@shop/shared";

// Free public barcode databases. None needs an API key.
// The Open Food Facts family (same API, run in parallel):
//   Open Food Facts      groceries and drinks (millions of products)
//   Open Products Facts  general goods (stationery, household, electronics...)
//   Open Beauty Facts    cosmetics and toiletries
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

/** Returns the first match from the public databases, or null. */
export async function lookupBarcodeOnline(code: string): Promise<BarcodeLookup | null> {
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
  return fromUpcItemDb(code, await getJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`));
}

import { z } from "zod";

// ---------- Enums ----------

export const UnitSchema = z.enum(["piece", "kg"]);
export type Unit = z.infer<typeof UnitSchema>;

export const BillStatusSchema = z.enum(["open", "held", "paid", "merged"]);
export type BillStatus = z.infer<typeof BillStatusSchema>;

/** Bills in these states can be edited or merged. */
export const EDITABLE_STATUSES: readonly BillStatus[] = ["open", "held"];

// ---------- Common ----------

/** Positive integer id, accepts "12" from URL params. */
export const IdSchema = z.coerce.number().int().positive();

export const IdParamSchema = z.object({ id: IdSchema });

// Empty string / whitespace-only barcode means "no barcode".
const BarcodeSchema = z
  .string()
  .trim()
  .max(64)
  .nullish()
  .transform((v) => (v ? v : null));

// ---------- Products ----------

export const ProductCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  /** Smallest currency unit (e.g. pence). For kg items this is the price per kg. */
  price: z.number().int().nonnegative(),
  barcode: BarcodeSchema,
  unit: UnitSchema.default("piece"),
});
export type ProductCreate = z.input<typeof ProductCreateSchema>;

export const ProductUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    price: z.number().int().nonnegative(),
    barcode: BarcodeSchema,
    unit: UnitSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });
export type ProductUpdate = z.input<typeof ProductUpdateSchema>;

export const ProductSearchQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
});

export const BarcodeParamSchema = z.object({ code: z.string().trim().min(1).max(64) });

export interface Product {
  id: number;
  name: string;
  price: number;
  barcode: string | null;
  unit: Unit;
  created_at: string;
  /** Number of photos for the image matcher (only in GET /products). */
  image_count?: number;
}

// ---------- Bills ----------

/** Quantities are kept to 3 decimal places (grams for kg items). */
const QtySchema = z.number().finite().max(100000);

export const AddItemSchema = z.object({
  product_id: z.number().int().positive(),
  qty: QtySchema.positive().default(1),
});
export type AddItem = z.input<typeof AddItemSchema>;

export const UpdateItemSchema = z.object({
  /** 0 removes the item. */
  qty: QtySchema.nonnegative(),
});
export type UpdateItem = z.input<typeof UpdateItemSchema>;

export const BillListQuerySchema = z.object({
  status: BillStatusSchema.optional(),
});

export const BillItemParamSchema = z.object({ id: IdSchema, itemId: IdSchema });

export const MergeParamSchema = z.object({ targetId: IdSchema, sourceId: IdSchema });

export interface Bill {
  id: number;
  status: BillStatus;
  total: number;
  merged_into: number | null;
  created_at: string;
  updated_at: string;
}

export interface BillItem {
  id: number;
  bill_id: number;
  product_id: number;
  product_name: string;
  unit: Unit;
  qty: number;
  price_at_sale: number;
  /** round(qty * price_at_sale), smallest currency unit. */
  line_total: number;
}

export interface BillWithItems extends Bill {
  items: BillItem[];
}

/** Bill list rows include a cheap item count for list screens. */
export interface BillSummary extends Bill {
  item_count: number;
}

// ---------- Errors ----------

export interface ApiError {
  error: string;
}

// ---------- Online barcode lookup ----------

/** A product found in a public barcode database (not yet in our products table). */
export interface BarcodeLookup {
  barcode: string;
  /** Suggested product name, e.g. "Coca-Cola Original 330 ml". */
  name: string;
  brand: string | null;
  image_url: string | null;
  source: "openfoodfacts" | "openproductsfacts" | "openbeautyfacts" | "websearch" | "upcitemdb";
  /** Human-readable database name, e.g. "Open Food Facts". */
  source_label: string;
}

// ---------- Product photos + embeddings ----------

/**
 * The image-embedding model. Workers AI has no image-embedding model (checked
 * Oct 2026: text embeddings only), so the app computes the vector on the phone
 * with MobileNetV3-Large (TFLite) and sends it with the photo. The Vectorize
 * index dimensions must equal EMBEDDING_DIMENSIONS.
 */
export const EMBEDDING_MODEL = "mobilenet_v3_large_224";
export const EMBEDDING_DIMENSIONS = 960;

/** Photos per product used by the image matcher (the app suggests 3–5). */
export const MAX_IMAGES_PER_PRODUCT = 8;

export const EmbeddingSchema = z
  .array(z.number().finite())
  .length(EMBEDDING_DIMENSIONS, `embedding must have ${EMBEDDING_DIMENSIONS} numbers`);

export const AddImageSchema = z.object({
  /** JPEG/PNG/WebP bytes, base64-encoded. */
  image_base64: z.string().min(100).max(8_000_000),
  embedding: EmbeddingSchema,
});
export type AddImage = z.input<typeof AddImageSchema>;

export const ImageParamSchema = z.object({ id: IdSchema, imageId: IdSchema });

export interface ProductImage {
  id: number;
  product_id: number;
  /** Path on the API, e.g. "/images/12". Prefix with the API base URL. */
  url: string;
  created_at: string;
}

// ---------- Image matching ----------

export const MatchSchema = z.object({
  /** Embedding of the photo to identify (computed on the phone, like product photos). */
  embedding: EmbeddingSchema,
  /** How many different products to return. */
  top_k: z.number().int().min(1).max(10).default(3),
});
export type MatchRequest = z.input<typeof MatchSchema>;

export interface MatchResult {
  product: Product;
  /** Cosine similarity of the closest photo of this product, -1..1 (higher is closer). */
  score: number;
  /** That closest photo, e.g. "/images/12". */
  image_url: string;
}

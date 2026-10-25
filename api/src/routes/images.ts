import { env } from "cloudflare:workers";
import { Buffer } from "node:buffer";
import { Router } from "express";
import {
  AddImageSchema,
  IdParamSchema,
  ImageParamSchema,
  MAX_IMAGES_PER_PRODUCT,
  type ProductImage,
} from "@shop/shared";
import { db } from "../db";
import { HttpError, parse } from "../http";
import { vectorStore } from "../vectors";

export const imagesRouter = Router();

const MAX_BYTES = 5 * 1024 * 1024;

interface ImageRow {
  id: number;
  product_id: number;
  r2_key: string;
  created_at: string;
}

const toApi = (row: ImageRow): ProductImage => ({
  id: row.id,
  product_id: row.product_id,
  url: `/images/${row.id}`,
  created_at: row.created_at,
});

/** Detects the image type from its first bytes; null if it isn't one we accept. */
function sniffImage(bytes: Uint8Array): { type: string; ext: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { type: "image/png", ext: "png" };
  if (Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP")
    return { type: "image/webp", ext: "webp" };
  return null;
}

async function ensureProduct(id: number) {
  const found = await db().prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
  if (!found) throw new HttpError(404, `Product ${id} not found`);
}

/** Removes photos from R2, Vectorize and D1. Used by image and product deletes. */
export async function deleteImages(rows: Pick<ImageRow, "id" | "r2_key">[]) {
  if (rows.length === 0) return;
  await env.IMAGES.delete(rows.map((r) => r.r2_key));
  await vectorStore().deleteByIds(rows.map((r) => String(r.id)));
  await db()
    .prepare(`DELETE FROM product_images WHERE id IN (${rows.map(() => "?").join(",")})`)
    .bind(...rows.map((r) => r.id))
    .run();
}

// GET /products/:id/images
imagesRouter.get("/products/:id/images", async (req, res) => {
  const { id } = parse(IdParamSchema, req.params);
  await ensureProduct(id);
  const { results } = await db()
    .prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY id")
    .bind(id)
    .all<ImageRow>();
  res.json(results.map(toApi));
});

// POST /products/:id/images  { image_base64, embedding }
// Stores the photo in R2 and its embedding in Vectorize (same id as the D1 row).
imagesRouter.post("/products/:id/images", async (req, res) => {
  const { id } = parse(IdParamSchema, req.params);
  const body = parse(AddImageSchema, req.body);
  await ensureProduct(id);

  const count = await db()
    .prepare("SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?")
    .bind(id)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_IMAGES_PER_PRODUCT) {
    throw new HttpError(409, `A product can have at most ${MAX_IMAGES_PER_PRODUCT} photos`);
  }

  const bytes = new Uint8Array(Buffer.from(body.image_base64, "base64"));
  if (bytes.byteLength > MAX_BYTES) throw new HttpError(413, "Photo is larger than 5 MB");
  const kind = sniffImage(bytes);
  if (!kind) throw new HttpError(400, "Photo must be a JPEG, PNG or WebP image");

  const key = `products/${id}/${crypto.randomUUID()}.${kind.ext}`;
  const row = await db()
    .prepare("INSERT INTO product_images (product_id, r2_key) VALUES (?, ?) RETURNING *")
    .bind(id, key)
    .first<ImageRow>();
  if (!row) throw new HttpError(500, "Could not save photo");

  try {
    await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: kind.type } });
    await vectorStore().upsert([{ id: String(row.id), values: body.embedding, metadata: { product_id: id } }]);
  } catch (e) {
    // Don't leave a half-saved photo behind.
    await deleteImages([row]).catch(() => {});
    throw e;
  }
  res.status(201).json(toApi(row));
});

// DELETE /products/:id/images/:imageId
imagesRouter.delete("/products/:id/images/:imageId", async (req, res) => {
  const { id, imageId } = parse(ImageParamSchema, req.params);
  const row = await db()
    .prepare("SELECT * FROM product_images WHERE id = ? AND product_id = ?")
    .bind(imageId, id)
    .first<ImageRow>();
  if (!row) throw new HttpError(404, `Photo ${imageId} not found on product ${id}`);
  await deleteImages([row]);
  res.json({ ok: true });
});

// GET /images/:id  (the photo itself, for thumbnails)
imagesRouter.get("/images/:id", async (req, res) => {
  const { id } = parse(IdParamSchema, req.params);
  const row = await db().prepare("SELECT r2_key FROM product_images WHERE id = ?").bind(id).first<ImageRow>();
  const object = row && (await env.IMAGES.get(row.r2_key));
  if (!object) throw new HttpError(404, `Photo ${id} not found`);
  res.setHeader("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
  // Keys are never reused, so the bytes behind this URL never change.
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.end(Buffer.from(await object.arrayBuffer()));
});

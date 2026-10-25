import { Router } from "express";
import { MatchSchema, type MatchResult, type Product } from "@shop/shared";
import { db } from "../db";
import { HttpError, parse } from "../http";
import { vectorStore } from "../vectors";

export const matchRouter = Router();

// Several photos usually belong to one product, so fetch more vectors than
// products wanted and keep the best photo per product.
const VECTORS_PER_PRODUCT = 5;
const MAX_TOP_K_WITH_METADATA = 20; // Vectorize's limit when returning metadata

// POST /match  { embedding, top_k? }
// Returns the top_k closest products (best first) with similarity scores.
matchRouter.post("/match", async (req, res) => {
  if (req.body && typeof req.body === "object" && "image_base64" in req.body && !("embedding" in req.body)) {
    throw new HttpError(
      400,
      "Send the photo's embedding, not the image: embeddings are computed on the phone (Workers AI has no image-embedding model)",
    );
  }
  const { embedding, top_k } = parse(MatchSchema, req.body);

  const { matches } = await vectorStore().query(embedding, {
    topK: Math.min(top_k * VECTORS_PER_PRODUCT, MAX_TOP_K_WITH_METADATA),
    returnMetadata: "all",
  });

  // Best-scoring photo per product, in score order.
  const best = new Map<number, { score: number; imageId: string }>();
  for (const m of matches) {
    const productId = Number(m.metadata?.product_id);
    if (!Number.isInteger(productId)) continue;
    const prev = best.get(productId);
    if (!prev || m.score > prev.score) best.set(productId, { score: m.score, imageId: m.id });
  }
  const ranked = [...best.entries()].sort((a, b) => b[1].score - a[1].score);
  if (ranked.length === 0) {
    res.json([]);
    return;
  }

  // Vectors can briefly outlive a deleted product, so only keep products that still exist.
  const ids = ranked.map(([id]) => id);
  const { results } = await db()
    .prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(...ids)
    .all<Product>();
  const products = new Map(results.map((p) => [p.id, p]));

  const out: MatchResult[] = ranked
    .filter(([id]) => products.has(id))
    .slice(0, top_k)
    .map(([id, m]) => ({
      product: products.get(id)!,
      score: Math.round(m.score * 1000) / 1000,
      image_url: `/images/${m.imageId}`,
    }));
  res.json(out);
});

import { Router } from "express";
import {
  BarcodeParamSchema,
  IdParamSchema,
  ProductCreateSchema,
  ProductSearchQuerySchema,
  ProductUpdateSchema,
  type Product,
} from "@shop/shared";
import { db } from "../db";
import { HttpError, parse } from "../http";

export const productsRouter = Router();

async function getProduct(id: number): Promise<Product> {
  const product = await db().prepare("SELECT * FROM products WHERE id = ?").bind(id).first<Product>();
  if (!product) throw new HttpError(404, `Product ${id} not found`);
  return product;
}

// GET /products?search=milk
productsRouter.get("/products", async (req, res) => {
  const { search } = parse(ProductSearchQuerySchema, req.query);
  const stmt = search
    ? db()
        .prepare(
          `SELECT * FROM products
            WHERE name LIKE ?1 ESCAPE '\\' OR barcode = ?2
            ORDER BY name COLLATE NOCASE LIMIT 100`,
        )
        .bind(`%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, search)
    : db().prepare("SELECT * FROM products ORDER BY name COLLATE NOCASE LIMIT 500");
  const { results } = await stmt.all<Product>();
  res.json(results);
});

// GET /products/barcode/:code
productsRouter.get("/products/barcode/:code", async (req, res) => {
  const { code } = parse(BarcodeParamSchema, req.params);
  const product = await db().prepare("SELECT * FROM products WHERE barcode = ?").bind(code).first<Product>();
  if (!product) throw new HttpError(404, `No product with barcode ${code}`);
  res.json(product);
});

// GET /products/:id
productsRouter.get("/products/:id", async (req, res) => {
  const { id } = parse(IdParamSchema, req.params);
  res.json(await getProduct(id));
});

// POST /products
productsRouter.post("/products", async (req, res) => {
  const body = parse(ProductCreateSchema, req.body);
  const product = await db()
    .prepare("INSERT INTO products (name, price, barcode, unit) VALUES (?, ?, ?, ?) RETURNING *")
    .bind(body.name, body.price, body.barcode, body.unit)
    .first<Product>();
  res.status(201).json(product);
});

// PATCH /products/:id
productsRouter.patch("/products/:id", async (req, res) => {
  const { id } = parse(IdParamSchema, req.params);
  const body = parse(ProductUpdateSchema, req.body);
  await getProduct(id);

  // Column names come from the zod schema keys, never from raw client input.
  const entries = Object.entries(body).filter(([, v]) => v !== undefined);
  const sets = entries.map(([k]) => `${k} = ?`).join(", ");
  const product = await db()
    .prepare(`UPDATE products SET ${sets} WHERE id = ? RETURNING *`)
    .bind(...entries.map(([, v]) => v), id)
    .first<Product>();
  res.json(product);
});

// DELETE /products/:id
productsRouter.delete("/products/:id", async (req, res) => {
  const { id } = parse(IdParamSchema, req.params);
  await getProduct(id);
  const used = await db().prepare("SELECT 1 FROM bill_items WHERE product_id = ? LIMIT 1").bind(id).first();
  if (used) {
    throw new HttpError(409, "Product appears on bills and cannot be deleted");
  }
  // product_images rows cascade. (R2 objects / vectors are cleaned up once images exist, phase 4.)
  await db().prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  res.json({ ok: true });
});

import { Router } from "express";
import {
  AddItemSchema,
  BillItemParamSchema,
  BillListQuerySchema,
  IdParamSchema,
  MergeParamSchema,
  UpdateItemSchema,
  type Bill,
  type BillStatus,
  type BillSummary,
  type Product,
} from "@shop/shared";
import {
  db,
  getBillRow,
  getBillWithItems,
  getEditableBill,
  nowIso,
  recalcTotalStmt,
  roundQty,
} from "../db";
import { HttpError, parse } from "../http";

export const billsRouter = Router();

/** 'piece' products must be sold in whole numbers. */
function checkQtyForUnit(product: Pick<Product, "unit" | "name">, qty: number) {
  if (product.unit === "piece" && !Number.isInteger(qty)) {
    throw new HttpError(400, `${product.name} is sold per piece; qty must be a whole number`);
  }
}

async function getItem(billId: number, itemId: number) {
  const item = await db()
    .prepare(
      `SELECT bi.id, p.unit, p.name FROM bill_items bi
         JOIN products p ON p.id = bi.product_id
        WHERE bi.id = ? AND bi.bill_id = ?`,
    )
    .bind(itemId, billId)
    .first<{ id: number; unit: Product["unit"]; name: string }>();
  if (!item) throw new HttpError(404, `Item ${itemId} not found on bill ${billId}`);
  return item;
}

/**
 * Moves a bill from one of `from` to `to`. The status check is part of the
 * UPDATE itself, so two concurrent requests can't both succeed.
 */
async function transition(id: number, from: BillStatus[], to: BillStatus) {
  const bill = await getBillRow(id);
  if (!from.includes(bill.status)) {
    throw new HttpError(409, `Bill ${id} is ${bill.status}; cannot change it to ${to}`);
  }
  const placeholders = from.map(() => "?").join(", ");
  const result = await db()
    .prepare(`UPDATE bills SET status = ?, updated_at = ? WHERE id = ? AND status IN (${placeholders})`)
    .bind(to, nowIso(), id, ...from)
    .run();
  if (result.meta.changes === 0) throw new HttpError(409, `Bill ${id} changed; try again`);
}

// POST /bills
billsRouter.post("/bills", async (_req, res) => {
  const bill = await db().prepare("INSERT INTO bills DEFAULT VALUES RETURNING *").first<Bill>();
  res.status(201).json({ ...bill, items: [] });
});

// GET /bills?status=held
billsRouter.get("/bills", async (req, res) => {
  const { status } = parse(BillListQuerySchema, req.query);
  const where = status ? "WHERE b.status = ?" : "";
  const stmt = db().prepare(
    `SELECT b.*, (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id) AS item_count
       FROM bills b ${where}
      ORDER BY b.updated_at DESC
      LIMIT 200`,
  );
  const { results } = await (status ? stmt.bind(status) : stmt).all<BillSummary>();
  res.json(results);
});

// GET /bills/:id
billsRouter.get("/bills/:id", async (req, res) => {
  const { id } = parse(IdParamSchema, req.params);
  res.json(await getBillWithItems(id));
});

// POST /bills/:id/items  { product_id, qty }
// Adding a product already on the bill increases its qty instead of adding a row.
billsRouter.post("/bills/:id/items", async (req, res) => {
  const { id } = parse(IdParamSchema, req.params);
  const body = parse(AddItemSchema, req.body);
  await getEditableBill(id);

  const product = await db()
    .prepare("SELECT * FROM products WHERE id = ?")
    .bind(body.product_id)
    .first<Product>();
  if (!product) throw new HttpError(404, `Product ${body.product_id} not found`);
  const qty = roundQty(body.qty);
  if (qty <= 0) throw new HttpError(400, "qty must be greater than 0");
  checkQtyForUnit(product, qty);

  // price_at_sale is captured when the product first lands on the bill and is
  // not touched when qty is increased later.
  await db().batch([
    db()
      .prepare(
        `INSERT INTO bill_items (bill_id, product_id, qty, price_at_sale)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (bill_id, product_id) DO UPDATE SET qty = ROUND(bill_items.qty + excluded.qty, 3)`,
      )
      .bind(id, product.id, qty, product.price),
    recalcTotalStmt(id),
  ]);
  res.status(201).json(await getBillWithItems(id));
});

// PATCH /bills/:id/items/:itemId  { qty }   (qty 0 removes the item)
billsRouter.patch("/bills/:id/items/:itemId", async (req, res) => {
  const { id, itemId } = parse(BillItemParamSchema, req.params);
  const body = parse(UpdateItemSchema, req.body);
  await getEditableBill(id);
  const item = await getItem(id, itemId);
  const qty = roundQty(body.qty);

  if (qty > 0) checkQtyForUnit(item, qty);
  const change =
    qty === 0
      ? db().prepare("DELETE FROM bill_items WHERE id = ?").bind(itemId)
      : db().prepare("UPDATE bill_items SET qty = ? WHERE id = ?").bind(qty, itemId);

  await db().batch([change, recalcTotalStmt(id)]);
  res.json(await getBillWithItems(id));
});

// DELETE /bills/:id/items/:itemId
billsRouter.delete("/bills/:id/items/:itemId", async (req, res) => {
  const { id, itemId } = parse(BillItemParamSchema, req.params);
  await getEditableBill(id);
  await getItem(id, itemId);
  await db().batch([db().prepare("DELETE FROM bill_items WHERE id = ?").bind(itemId), recalcTotalStmt(id)]);
  res.json(await getBillWithItems(id));
});

// POST /bills/:id/hold
billsRouter.post("/bills/:id/hold", async (req, res) => {
  const { id } = parse(IdParamSchema, req.params);
  await transition(id, ["open"], "held");
  res.json(await getBillWithItems(id));
});

// POST /bills/:id/resume
billsRouter.post("/bills/:id/resume", async (req, res) => {
  const { id } = parse(IdParamSchema, req.params);
  await transition(id, ["held"], "open");
  res.json(await getBillWithItems(id));
});

// POST /bills/:id/pay
billsRouter.post("/bills/:id/pay", async (req, res) => {
  const { id } = parse(IdParamSchema, req.params);
  const bill = await getEditableBill(id);
  const hasItems = await db().prepare("SELECT 1 FROM bill_items WHERE bill_id = ? LIMIT 1").bind(id).first();
  if (!hasItems) throw new HttpError(409, "Cannot pay an empty bill");
  // Recalculate first so the paid total is guaranteed to match the items.
  await recalcTotalStmt(id).run();
  await transition(id, [bill.status], "paid");
  res.json(await getBillWithItems(id));
});

// POST /bills/:targetId/merge/:sourceId
// Moves every item from source into target (combining qty for products on
// both), marks source as merged, and recalculates target's total. All writes
// run in one D1 batch, which D1 executes as a single transaction.
billsRouter.post("/bills/:targetId/merge/:sourceId", async (req, res) => {
  const { targetId, sourceId } = parse(MergeParamSchema, req.params);
  if (targetId === sourceId) throw new HttpError(400, "A bill can't be merged into itself");
  await getEditableBill(targetId);
  await getEditableBill(sourceId);

  const now = nowIso();
  await db().batch([
    // 1. Copy source items onto target; matching products add qty. A product
    //    already on the target keeps the target's price_at_sale.
    db()
      .prepare(
        `INSERT INTO bill_items (bill_id, product_id, qty, price_at_sale)
         SELECT ?1, product_id, qty, price_at_sale FROM bill_items WHERE bill_id = ?2
         ON CONFLICT (bill_id, product_id) DO UPDATE SET qty = ROUND(bill_items.qty + excluded.qty, 3)`,
      )
      .bind(targetId, sourceId),
    // 2. Remove them from source.
    db().prepare("DELETE FROM bill_items WHERE bill_id = ?").bind(sourceId),
    // 3. Close source.
    db()
      .prepare("UPDATE bills SET status = 'merged', merged_into = ?, total = 0, updated_at = ? WHERE id = ?")
      .bind(targetId, now, sourceId),
    // 4. Server-side total for target.
    recalcTotalStmt(targetId),
  ]);

  res.json(await getBillWithItems(targetId));
});

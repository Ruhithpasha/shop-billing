import { env } from "cloudflare:workers";
import { EDITABLE_STATUSES, type Bill, type BillItem, type BillWithItems } from "@shop/shared";
import { HttpError } from "./http";

export const db = () => env.DB;

export const nowIso = () => new Date().toISOString();

/** Quantities are stored to 3 decimal places (1 g resolution for kg items). */
export const roundQty = (qty: number) => Math.round(qty * 1000) / 1000;

/**
 * Statement that recomputes a bill's total from its items. The total is always
 * derived on the server; any total sent by a client is ignored.
 */
export const recalcTotalStmt = (billId: number) =>
  db()
    .prepare(
      `UPDATE bills
         SET total = (SELECT COALESCE(SUM(CAST(ROUND(qty * price_at_sale) AS INTEGER)), 0)
                        FROM bill_items WHERE bill_id = ?1),
             updated_at = ?2
       WHERE id = ?1`,
    )
    .bind(billId, nowIso());

export async function getBillRow(id: number): Promise<Bill> {
  const bill = await db().prepare("SELECT * FROM bills WHERE id = ?").bind(id).first<Bill>();
  if (!bill) throw new HttpError(404, `Bill ${id} not found`);
  return bill;
}

/** Loads a bill and throws 409 unless it is open or held. */
export async function getEditableBill(id: number): Promise<Bill> {
  const bill = await getBillRow(id);
  if (!EDITABLE_STATUSES.includes(bill.status)) {
    throw new HttpError(409, `Bill ${id} is ${bill.status} and can no longer be changed`);
  }
  return bill;
}

export async function getBillWithItems(id: number): Promise<BillWithItems> {
  const bill = await getBillRow(id);
  const { results } = await db()
    .prepare(
      `SELECT bi.id, bi.bill_id, bi.product_id, p.name AS product_name, p.unit,
              bi.qty, bi.price_at_sale,
              CAST(ROUND(bi.qty * bi.price_at_sale) AS INTEGER) AS line_total
         FROM bill_items bi
         JOIN products p ON p.id = bi.product_id
        WHERE bi.bill_id = ?
        ORDER BY bi.id`,
    )
    .bind(id)
    .all<BillItem>();
  return { ...bill, items: results };
}

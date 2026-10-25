import type { Unit } from "@shop/shared";
import { CURRENCY_SYMBOL } from "@/config";

/** 1234 -> "£12.34" */
export function formatMoney(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  return `${sign}${CURRENCY_SYMBOL}${(Math.abs(minor) / 100).toFixed(2)}`;
}

/** "12.3" -> 1230. Returns null when the text isn't a valid amount. */
export function parseMoney(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

/** 1230 -> "12.30", for editing a price in a text field. */
export const moneyToInput = (minor: number) => (minor / 100).toFixed(2);

export function formatQty(qty: number, unit: Unit): string {
  return unit === "kg" ? `${Number(qty.toFixed(3))} kg` : `${qty}`;
}

export const unitLabel = (unit: Unit) => (unit === "kg" ? "/kg" : "");

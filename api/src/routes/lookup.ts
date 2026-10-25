import { env } from "cloudflare:workers";
import { Router } from "express";
import { BarcodeParamSchema } from "@shop/shared";
import { HttpError, parse } from "../http";
import { lookupBarcodeOnline } from "../lookup-sources";

export const lookupRouter = Router();

// GET /lookup/barcode/:code
// For barcodes that aren't in our products yet: suggests a name and image from
// public barcode databases. The shop still sets its own price.
lookupRouter.get("/lookup/barcode/:code", async (req, res) => {
  const { code } = parse(BarcodeParamSchema, req.params);
  const found = await lookupBarcodeOnline(code, { braveSearchKey: env.BRAVE_SEARCH_KEY });
  if (!found) throw new HttpError(404, `Barcode ${code} not found online`);
  res.json(found);
});

import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";

/** Throw from any route to send `{ error }` with the given status. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Validate input with a zod schema; throws a 400 HttpError with a readable message. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join("; ");
    throw new HttpError(400, message);
  }
  return result.data;
}

/** Prototype: allow every origin. */
export const cors: RequestHandler = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
};

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Malformed JSON body from express.json()
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  const message = String(err?.message ?? err);
  if (message.includes("UNIQUE constraint failed: products.barcode")) {
    res.status(409).json({ error: "A product with this barcode already exists" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};

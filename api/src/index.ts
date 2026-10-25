import { httpServerHandler } from "cloudflare:node";
import express from "express";
import { cors, errorHandler, notFound } from "./http";
import { productsRouter } from "./routes/products";
import { billsRouter } from "./routes/bills";
import { imagesRouter } from "./routes/images";
import { lookupRouter } from "./routes/lookup";

const app = express();

app.use(cors);
// Photo uploads (POST /products/:id/images) send the image as base64 JSON.
app.use(express.json({ limit: "8mb" }));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "shop-billing-api" });
});

app.use(productsRouter);
app.use(billsRouter);
app.use(lookupRouter);
app.use(imagesRouter);

app.use(notFound);
app.use(errorHandler);

// On Workers, listen() registers the server with the runtime and
// httpServerHandler routes incoming requests to it. No real port is opened.
const PORT = 3000;
app.listen(PORT);
export default httpServerHandler({ port: PORT });

import { httpServerHandler } from "cloudflare:node";
import express from "express";
import { cors, errorHandler, notFound } from "./http";
import { productsRouter } from "./routes/products";
import { billsRouter } from "./routes/bills";

const app = express();

app.use(cors);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "shop-billing-api" });
});

app.use(productsRouter);
app.use(billsRouter);

app.use(notFound);
app.use(errorHandler);

// On Workers, listen() registers the server with the runtime and
// httpServerHandler routes incoming requests to it. No real port is opened.
const PORT = 3000;
app.listen(PORT);
export default httpServerHandler({ port: PORT });

-- Prices and totals are integers in the smallest currency unit (e.g. pence).
-- Timestamps are ISO-8601 UTC strings.

CREATE TABLE products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  price       INTEGER NOT NULL CHECK (price >= 0),
  barcode     TEXT    UNIQUE,
  unit        TEXT    NOT NULL DEFAULT 'piece' CHECK (unit IN ('piece', 'kg')),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_products_name ON products (name COLLATE NOCASE);

-- The embedding vector lives in Vectorize under the same id, with metadata { product_id }.
CREATE TABLE product_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  r2_key      TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_product_images_product ON product_images (product_id);

CREATE TABLE bills (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  status       TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'held', 'paid', 'merged')),
  total        INTEGER NOT NULL DEFAULT 0,
  merged_into  INTEGER REFERENCES bills (id),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_bills_status ON bills (status, updated_at);

CREATE TABLE bill_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id        INTEGER NOT NULL REFERENCES bills (id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products (id),
  qty            REAL    NOT NULL CHECK (qty > 0),
  price_at_sale  INTEGER NOT NULL CHECK (price_at_sale >= 0),
  UNIQUE (bill_id, product_id)
);

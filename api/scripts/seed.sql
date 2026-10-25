-- ~10 sample products. Prices are in the smallest currency unit (pence).
-- kg items are priced per kg. Safe to re-run: products whose name already exists are skipped.
INSERT INTO products (name, price, barcode, unit)
SELECT v.column1, v.column2, v.column3, v.column4
FROM (VALUES
  ('Whole Milk 1L',            115, '5000128104517', 'piece'),
  ('White Bread 800g',         140, '5010044000701', 'piece'),
  ('Free Range Eggs (6)',      229, '5000169135518', 'piece'),
  ('Basmati Rice 1kg',         275, '5011157630064', 'piece'),
  ('Cola 330ml Can',            85, '5449000000996', 'piece'),
  ('Salted Crisps 25g',         60, '5000328000237', 'piece'),
  ('Cheddar Cheese 400g',      350, '5000295142893', 'piece'),
  ('Bananas (loose)',           98, NULL,            'kg'),
  ('Tomatoes (loose)',         220, NULL,            'kg'),
  ('Onions (loose)',           110, NULL,            'kg')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name = v.column1)
  AND (v.column3 IS NULL OR NOT EXISTS (SELECT 1 FROM products p WHERE p.barcode = v.column3));

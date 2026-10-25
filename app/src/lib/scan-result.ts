/**
 * Hands a scanned barcode from the scan-barcode screen back to whichever
 * screen opened it (e.g. the product form).
 */
type Listener = (code: string) => void;
let listener: Listener | null = null;

export function onNextScan(fn: Listener) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function deliverScan(code: string) {
  listener?.(code);
  listener = null;
}

import { Image } from "expo-image";
import { router, Tabs, useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { BarcodeLookup, MatchResult, Product, Unit } from "@shop/shared";
import type { BarcodeScannerHandle } from "@/components/barcode-scanner";
import { QtyPicker } from "@/components/qty-picker";
import { SafeBarcodeScanner } from "@/components/safe-native";
import { Button, colors, inputStyle, text } from "@/components/ui";
import { UnitToggle } from "@/components/unit-toggle";
import { CURRENCY_SYMBOL } from "@/config";
import { api, ApiError, apiUrl } from "@/lib/api";
import { useCurrentBill } from "@/lib/current-bill";
import { errorMessage } from "@/lib/dialogs";
import { crashedLastTime, guarded } from "@/lib/crash-guard";
import { scanFeedback } from "@/lib/scan-feedback";
import { formatMoney, parseMoney, unitLabel } from "@/lib/money";
import { useBill, useInvalidateProducts, useStoreBill } from "@/lib/queries";

type Mode =
  | { kind: "idle" }
  | { kind: "loading"; code: string }
  | { kind: "identifying" }
  | { kind: "matches"; matches: MatchResult[] }
  | { kind: "found"; product: Product }
  | { kind: "new"; code: string; suggestion: BarcodeLookup | null }
  | { kind: "error"; code: string; message: string };

/** Products without a readable barcode are identified by photo after this long. */
const AUTO_IDENTIFY_MS = 1500;
/** Below this similarity the top match is shown as a guess. */
const CONFIDENT_SCORE = 0.6;
const CAN_IDENTIFY = Platform.OS === "android";
/** Identify gives up after this long, so it can never leave the screen stuck. */
const IDENTIFY_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

/**
 * Scan a barcode -> our product (pick qty, add) or, if we don't stock it yet,
 * a new-product form pre-filled from the online lookup. No barcode within
 * ~1.5 s (or "Identify") -> match a camera snapshot against product photos.
 */
export default function ScanScreen() {
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [flash, setFlash] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const { billId, ensureBill } = useCurrentBill();
  const storeBill = useStoreBill();
  const scanner = useRef<BarcodeScannerHandle>(null);
  const isFocused = useIsFocused();
  // Auto-identify fires once, then waits until the next item is added, so a
  // dismissed result doesn't keep popping back up.
  const [autoArmed, setAutoArmed] = useState(true);

  // If the photo model crashed the app last time, don't run it automatically.
  const [identifyCrashed, setIdentifyCrashed] = useState(false);
  useEffect(() => {
    if (!CAN_IDENTIFY) return;
    crashedLastTime("identify").then((crashed) => {
      if (!crashed) return;
      setIdentifyCrashed(true);
      setAutoArmed(false);
    });
  }, []);

  // Each identify gets a number; a barcode read meanwhile bumps it, and the
  // stale identify result is then ignored (a barcode always wins).
  const identifyRun = useRef(0);

  const identify = useCallback(async (auto = false) => {
    const run = ++identifyRun.current;
    const current = () => run === identifyRun.current;
    setTyping(false);
    setFlash(null);
    setAutoArmed(false);
    setMode({ kind: "identifying" });
    try {
      const matches = await withTimeout(
        (async () => {
          if (!scanner.current) throw new Error("The camera isn't running");
          const image = await scanner.current.snapshot();
          let embedding: number[];
          try {
            // Loaded on first use (not at app start) and crash-guarded: it's native TFLite code.
            embedding = await guarded("identify", async () => {
              const { embedImage } = await import("@/lib/embedding");
              return embedImage(image);
            });
            setIdentifyCrashed(false);
          } finally {
            image.dispose();
          }
          return api.match({ embedding });
        })(),
        IDENTIFY_TIMEOUT_MS,
        "Identifying took too long. Try again, or scan the barcode.",
      );
      if (!current()) return;
      if (matches.length > 0) return setMode({ kind: "matches", matches });
      if (auto) return setMode({ kind: "idle" }); // nothing has photos yet: stay quiet
      setMode({ kind: "error", code: "", message: "No product photos yet. Add photos in Products to identify items." });
    } catch (e) {
      if (!current()) return;
      if (auto) return setMode({ kind: "idle" });
      setMode({ kind: "error", code: "", message: errorMessage(e) });
    }
  }, []);

  const idle = mode.kind === "idle" && !typing;
  useEffect(() => {
    if (!CAN_IDENTIFY || !idle || !autoArmed || !isFocused) return;
    const t = setTimeout(() => identify(true), AUTO_IDENTIFY_MS);
    return () => clearTimeout(t);
  }, [idle, autoArmed, isFocused, identify]);

  const handleCode = useCallback(async (code: string) => {
    identifyRun.current++; // cancel any identify in progress
    scanFeedback();
    setTyping(false);
    setFlash(null);
    setMode({ kind: "loading", code });
    try {
      const product = await api.findByBarcode(code);
      if (product) return setMode({ kind: "found", product });
      const suggestion = await api.lookupBarcodeOnline(code);
      setMode({ kind: "new", code, suggestion });
    } catch (e) {
      setMode({ kind: "error", code, message: errorMessage(e) });
    }
  }, []);

  const addToBill = async (product: Product, qty: number) => {
    const bill = await api.addItem(await ensureBill(), { product_id: product.id, qty });
    storeBill(bill);
    setFlash(`✓ Added ${product.name} × ${qty}${product.unit === "kg" ? " kg" : ""}`);
    setMode({ kind: "idle" });
    setAutoArmed(true); // ready for the next item
  };

  const reset = () => setMode({ kind: "idle" });

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <Tabs.Screen options={{ headerRight: () => <BillChip billId={billId} /> }} />

      <View style={styles.camera}>
        <SafeBarcodeScanner
          ref={scanner}
          onCode={handleCode}
          // Keep reading barcodes while identifying by photo: a barcode beats a photo guess.
          paused={(mode.kind !== "idle" && mode.kind !== "identifying") || typing}
        />
      </View>

      <View style={styles.panel}>
        {mode.kind === "idle" &&
          (typing ? (
            <TypeBarcode onSubmit={handleCode} onCancel={() => setTyping(false)} />
          ) : (
            <>
              {flash ? (
                <Text style={styles.flash}>{flash}</Text>
              ) : (
                <Text style={styles.hint}>
                  {CAN_IDENTIFY ? "Point at the barcode, or show the product to identify it" : "Point the camera at a barcode"}
                </Text>
              )}
              {CAN_IDENTIFY && identifyCrashed && (
                <Text style={styles.warn}>
                  Identify by photo closed the app last time, so it no longer runs automatically.
                </Text>
              )}
              {CAN_IDENTIFY && <Button title="Identify by photo" onPress={() => identify()} />}
              <View style={styles.row}>
                <Button title="Type barcode" variant="secondary" onPress={() => setTyping(true)} style={styles.flex} />
                <Button title="Search by name" variant="secondary" onPress={() => router.push("/add-item")} style={styles.flex} />
              </View>
            </>
          ))}

        {mode.kind === "loading" && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={text.muted}>Looking up {mode.code}…</Text>
          </View>
        )}

        {mode.kind === "identifying" && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={text.muted}>Identifying…</Text>
          </View>
        )}

        {mode.kind === "matches" && (
          <Matches
            matches={mode.matches}
            onPick={(product) => setMode({ kind: "found", product })}
            onRetry={() => identify()}
            onCancel={reset}
          />
        )}

        {mode.kind === "found" && (
          <FoundProduct key={mode.product.id} product={mode.product} onAdd={addToBill} onCancel={reset} />
        )}

        {mode.kind === "new" && (
          <NewProduct key={mode.code} code={mode.code} suggestion={mode.suggestion} onAdd={addToBill} onCancel={reset} />
        )}

        {mode.kind === "error" && (
          <View style={{ gap: 12 }}>
            <Text style={styles.error}>{mode.message}</Text>
            <View style={styles.row}>
              <Button title="Cancel" variant="secondary" onPress={reset} style={styles.flex} />
              <Button
                title="Try again"
                onPress={() => (mode.code ? handleCode(mode.code) : identify())}
                style={styles.flex}
              />
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

/** Header shortcut to the current bill, showing its running total. */
function BillChip({ billId }: { billId: number | null }) {
  const bill = useBill(billId);
  const count = bill.data?.items.length ?? 0;
  return (
    <Pressable onPress={() => router.navigate("/bill")} style={styles.chip} accessibilityRole="button">
      <Text style={styles.chipText}>
        {count > 0 ? `${count} item${count === 1 ? "" : "s"} · ${formatMoney(bill.data!.total)}` : "Bill"} ›
      </Text>
    </Pressable>
  );
}

/** Top matches by photo, best first. Tap the right one to pick a quantity. */
function Matches({
  matches,
  onPick,
  onRetry,
  onCancel,
}: {
  matches: MatchResult[];
  onPick: (p: Product) => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const sure = matches[0].score >= CONFIDENT_SCORE;
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.matchTitle}>{sure ? "Is it one of these?" : "Not sure. Pick the right one:"}</Text>
      {matches.map((m, i) => (
        <Pressable
          key={m.product.id}
          accessibilityRole="button"
          onPress={() => onPick(m.product)}
          style={({ pressed }) => [styles.matchCard, i === 0 && sure && styles.matchBest, pressed && { opacity: 0.7 }]}
        >
          <Image source={apiUrl(m.image_url)} style={styles.matchThumb} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.matchName} numberOfLines={2}>
              {m.product.name}
            </Text>
            <Text style={text.muted}>
              {formatMoney(m.product.price)}
              {unitLabel(m.product.unit)} · {Math.max(0, Math.round(m.score * 100))}% match
            </Text>
          </View>
        </Pressable>
      ))}
      <View style={styles.row}>
        <Button title="None of these" variant="secondary" onPress={onCancel} style={styles.flex} />
        <Button title="Try again" variant="secondary" onPress={onRetry} style={styles.flex} />
      </View>
    </View>
  );
}

function TypeBarcode({ onSubmit, onCancel }: { onSubmit: (code: string) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const submit = () => code.trim() && onSubmit(code.trim());
  return (
    <View style={{ gap: 12 }}>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Barcode number"
        keyboardType="number-pad"
        autoFocus
        onSubmitEditing={submit}
        style={inputStyle}
      />
      <View style={styles.row}>
        <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.flex} />
        <Button title="Look up" onPress={submit} disabled={!code.trim()} style={styles.flex} />
      </View>
    </View>
  );
}

function useAdd(onAdd: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAdd();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function FoundProduct({
  product,
  onAdd,
  onCancel,
}: {
  product: Product;
  onAdd: (p: Product, qty: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [qty, setQty] = useState(1);
  const add = useAdd(() => onAdd(product, qty));
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.titleRow}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.unitPrice}>
          {formatMoney(product.price)}
          {unitLabel(product.unit)}
        </Text>
      </View>
      <View style={styles.qtyRow}>
        <QtyPicker unit={product.unit} value={qty} onChange={setQty} />
        <Text style={styles.lineTotal}>{formatMoney(Math.round(qty * product.price))}</Text>
      </View>
      {add.error && <Text style={styles.error}>{add.error}</Text>}
      <View style={styles.row}>
        <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.flex} />
        <Button title="Add to bill" onPress={add.run} loading={add.busy} style={styles.flex2} />
      </View>
    </View>
  );
}

/** A barcode we don't stock yet: confirm the name, set our price, save and add. */
function NewProduct({
  code,
  suggestion,
  onAdd,
  onCancel,
}: {
  code: string;
  suggestion: BarcodeLookup | null;
  onAdd: (p: Product, qty: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(suggestion?.name ?? "");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState<Unit>("piece");
  const [qty, setQty] = useState(1);
  const invalidateProducts = useInvalidateProducts();
  const priceMinor = parseMoney(price);
  const valid = name.trim().length > 0 && priceMinor != null && priceMinor > 0;

  const add = useAdd(async () => {
    let product: Product;
    try {
      product = await api.createProduct({ name: name.trim(), price: priceMinor!, barcode: code, unit });
    } catch (e) {
      // Someone saved this barcode a moment ago: use theirs.
      const existing = e instanceof ApiError && e.status === 409 ? await api.findByBarcode(code) : null;
      if (!existing) throw e;
      product = existing;
    }
    invalidateProducts();
    await onAdd(product, unit === "piece" ? Math.max(1, Math.round(qty)) : qty);
  });

  return (
    <ScrollView style={styles.newScroll} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={styles.titleRow}>
        {suggestion?.image_url && (
          <Image source={suggestion.image_url} style={styles.thumb} contentFit="contain" accessibilityIgnoresInvertColors />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.newTitle}>New product</Text>
          <Text style={text.muted}>
            {suggestion
              ? `Found online (${suggestion.source_label ?? suggestion.source}) · ${code}`
              : `Not found online · ${code}`}
          </Text>
        </View>
      </View>
      <TextInput value={name} onChangeText={setName} placeholder="Product name" style={inputStyle} />
      <UnitToggle value={unit} onChange={setUnit} />
      <TextInput
        value={price}
        onChangeText={setPrice}
        placeholder={`Your price (${CURRENCY_SYMBOL}${unit === "kg" ? " per kg" : ""})`}
        keyboardType="decimal-pad"
        autoFocus={!!suggestion}
        style={[inputStyle, price !== "" && priceMinor == null && { borderColor: colors.danger }]}
      />
      <View style={styles.qtyRow}>
        <QtyPicker unit={unit} value={qty} onChange={setQty} />
        <Text style={styles.lineTotal}>{priceMinor != null ? formatMoney(Math.round(qty * priceMinor)) : ""}</Text>
      </View>
      {add.error && <Text style={styles.error}>{add.error}</Text>}
      <View style={styles.row}>
        <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.flex} />
        <Button title="Save & add" onPress={add.run} disabled={!valid} loading={add.busy} style={styles.flex2} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  camera: { flex: 1, minHeight: 180 },
  panel: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    marginTop: -18,
    padding: 16,
    gap: 12,
  },
  hint: { fontSize: 17, color: colors.muted, textAlign: "center" },
  warn: { fontSize: 15, color: colors.warning, textAlign: "center" },
  flash: { fontSize: 17, color: colors.success, fontWeight: "700", textAlign: "center" },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  loading: { alignItems: "center", gap: 10, paddingVertical: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { flex: 1, fontSize: 21, fontWeight: "700", color: colors.text },
  unitPrice: { fontSize: 18, fontWeight: "700", color: colors.muted },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lineTotal: { fontSize: 24, fontWeight: "800", color: colors.text },
  error: { fontSize: 16, color: colors.danger },
  newScroll: { maxHeight: 460 },
  newTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.bg },
  matchTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  matchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  matchBest: { borderColor: colors.primary, borderWidth: 2, backgroundColor: "#EEF2FF" },
  matchThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.bg },
  matchName: { fontSize: 18, fontWeight: "700", color: colors.text },
  chip: { marginRight: 12, paddingHorizontal: 14, minHeight: 40, borderRadius: 20, backgroundColor: "#E0E7FF", justifyContent: "center" },
  chipText: { fontSize: 15, fontWeight: "700", color: colors.primary },
});

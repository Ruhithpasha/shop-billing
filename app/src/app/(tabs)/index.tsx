import { Image } from "expo-image";
import { router, Tabs } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { BarcodeLookup, Product, Unit } from "@shop/shared";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { QtyPicker } from "@/components/qty-picker";
import { Button, colors, inputStyle, text } from "@/components/ui";
import { UnitToggle } from "@/components/unit-toggle";
import { CURRENCY_SYMBOL } from "@/config";
import { api, ApiError } from "@/lib/api";
import { useCurrentBill } from "@/lib/current-bill";
import { errorMessage } from "@/lib/dialogs";
import { formatMoney, parseMoney, unitLabel } from "@/lib/money";
import { useBill, useInvalidateProducts, useStoreBill } from "@/lib/queries";

type Mode =
  | { kind: "idle" }
  | { kind: "loading"; code: string }
  | { kind: "found"; product: Product }
  | { kind: "new"; code: string; suggestion: BarcodeLookup | null }
  | { kind: "error"; code: string; message: string };

/**
 * Scan a barcode -> our product (pick qty, add) or, if we don't stock it yet,
 * a new-product form pre-filled from the online lookup.
 */
export default function ScanScreen() {
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [flash, setFlash] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const { billId, ensureBill } = useCurrentBill();
  const storeBill = useStoreBill();

  const handleCode = useCallback(async (code: string) => {
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
  };

  const reset = () => setMode({ kind: "idle" });

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <Tabs.Screen options={{ headerRight: () => <BillChip billId={billId} /> }} />

      <View style={styles.camera}>
        <BarcodeScanner onCode={handleCode} paused={mode.kind !== "idle" || typing} />
      </View>

      <View style={styles.panel}>
        {mode.kind === "idle" &&
          (typing ? (
            <TypeBarcode onSubmit={handleCode} onCancel={() => setTyping(false)} />
          ) : (
            <>
              {flash ? <Text style={styles.flash}>{flash}</Text> : <Text style={styles.hint}>Point the camera at a barcode</Text>}
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
              <Button title="Try again" onPress={() => handleCode(mode.code)} style={styles.flex} />
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
              ? `Found online (${suggestion.source === "openfoodfacts" ? "Open Food Facts" : "UPCitemdb"}) · ${code}`
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
  chip: { marginRight: 12, paddingHorizontal: 14, minHeight: 40, borderRadius: 20, backgroundColor: "#E0E7FF", justifyContent: "center" },
  chipText: { fontSize: 15, fontWeight: "700", color: colors.primary },
});

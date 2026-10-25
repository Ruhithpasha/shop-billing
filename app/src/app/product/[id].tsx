import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { Unit } from "@shop/shared";
import { Button, colors, ErrorState, Loading, text } from "@/components/ui";
import { api } from "@/lib/api";
import { confirm, errorMessage, notify } from "@/lib/dialogs";
import { moneyToInput, parseMoney } from "@/lib/money";
import { useInvalidateProducts, useProduct } from "@/lib/queries";
import { CURRENCY_SYMBOL } from "@/config";

/** Add (`/product/new`) or edit (`/product/12`) a product. */
export default function ProductFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const productId = isNew ? null : Number(id);
  const product = useProduct(productId);
  const invalidate = useInvalidateProducts();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unit, setUnit] = useState<Unit>("piece");
  const [saving, setSaving] = useState(false);

  // Fill the form once the product loads.
  useEffect(() => {
    if (!product.data) return;
    setName(product.data.name);
    setPrice(moneyToInput(product.data.price));
    setBarcode(product.data.barcode ?? "");
    setUnit(product.data.unit);
  }, [product.data]);

  if (!isNew && product.isPending) return <Loading />;
  if (!isNew && product.isError) return <ErrorState error={product.error} onRetry={() => product.refetch()} />;

  const priceMinor = parseMoney(price);
  const valid = name.trim().length > 0 && priceMinor != null;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const body = { name: name.trim(), price: priceMinor!, barcode: barcode.trim() || null, unit };
      if (isNew) await api.createProduct(body);
      else await api.updateProduct(productId!, body);
      invalidate();
      router.back();
    } catch (e) {
      notify("Couldn't save", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm("Delete product", `Delete "${name}"?`, "Delete"))) return;
    try {
      await api.deleteProduct(productId!);
      invalidate();
      router.back();
    } catch (e) {
      notify("Couldn't delete", errorMessage(e));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: isNew ? "New product" : "Edit product" }} />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={text.label}>Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Whole Milk 1L" style={styles.input} />
        </View>

        <View>
          <Text style={text.label}>Sold by</Text>
          <View style={styles.segment}>
            {(["piece", "kg"] as const).map((u) => (
              <Pressable
                key={u}
                onPress={() => setUnit(u)}
                style={[styles.segmentItem, unit === u && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, unit === u && styles.segmentTextActive]}>
                  {u === "piece" ? "Piece" : "Weight (kg)"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text style={text.label}>
            Price ({CURRENCY_SYMBOL}
            {unit === "kg" ? " per kg" : ""})
          </Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            keyboardType="decimal-pad"
            style={[styles.input, price !== "" && priceMinor == null && styles.invalid]}
          />
        </View>

        <View>
          <Text style={text.label}>Barcode (optional)</Text>
          <TextInput
            value={barcode}
            onChangeText={setBarcode}
            placeholder="e.g. 5000128104517"
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        <Button big title={isNew ? "Add product" : "Save changes"} onPress={save} disabled={!valid} loading={saving} />
        {!isNew && <Button title="Delete product" variant="ghost" onPress={remove} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: 16, gap: 18 },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 18,
    color: colors.text,
  },
  invalid: { borderColor: colors.danger },
  segment: { flexDirection: "row", gap: 10 },
  segmentItem: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontSize: 17, fontWeight: "600", color: colors.text },
  segmentTextActive: { color: "#fff" },
});

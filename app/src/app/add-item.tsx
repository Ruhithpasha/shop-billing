import { router } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { Product } from "@shop/shared";
import { ProductRow } from "@/components/product-row";
import { QtyPicker } from "@/components/qty-picker";
import { SearchBox } from "@/components/search-box";
import { Button, colors, EmptyState, ErrorState, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { useCurrentBill } from "@/lib/current-bill";
import { errorMessage, notify } from "@/lib/dialogs";
import { formatMoney } from "@/lib/money";
import { useBillMutation, useProducts } from "@/lib/queries";
import { useDebounced } from "@/lib/use-debounced";

/** Manual product search -> pick -> quantity -> add to the current bill. */
export default function AddItemScreen() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const products = useProducts(useDebounced(search));
  const { ensureBill } = useCurrentBill();
  const add = useBillMutation(async (v: { product: Product; qty: number }) =>
    api.addItem(await ensureBill(), { product_id: v.product.id, qty: v.qty }),
  );

  const pick = (p: Product) => {
    setSelected(p);
    setQty(1);
  };

  const onAdd = async () => {
    if (!selected) return;
    try {
      await add.mutateAsync({ product: selected, qty });
      setLastAdded(`${selected.name} × ${qty}${selected.unit === "kg" ? " kg" : ""}`);
      setSelected(null);
      setSearch("");
    } catch (e) {
      notify("Couldn't add item", errorMessage(e));
    }
  };

  return (
    <View style={styles.screen}>
      <SearchBox value={search} onChangeText={setSearch} autoFocus />
      {lastAdded && <Text style={styles.added}>✓ Added {lastAdded}</Text>}

      {products.isPending ? (
        <Loading />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : products.data.length === 0 ? (
        <EmptyState title="No products found" hint="Try another name, or add it in the Products tab." />
      ) : (
        <FlatList
          data={products.data}
          keyExtractor={(p) => String(p.id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ProductRow product={item} selected={item.id === selected?.id} onPress={() => pick(item)} />
          )}
        />
      )}

      {selected ? (
        <View style={styles.panel}>
          <Text style={styles.panelName} numberOfLines={1}>
            {selected.name}
          </Text>
          <View style={styles.panelRow}>
            <QtyPicker unit={selected.unit} value={qty} onChange={setQty} />
            <Text style={styles.panelTotal}>{formatMoney(Math.round(qty * selected.price))}</Text>
          </View>
          <View style={styles.panelRow}>
            <Button title="Cancel" variant="secondary" onPress={() => setSelected(null)} style={{ flex: 1 }} />
            <Button title="Add to bill" onPress={onAdd} loading={add.isPending} style={{ flex: 2 }} />
          </View>
        </View>
      ) : (
        <View style={styles.panel}>
          <Button title="Done" variant="secondary" onPress={() => router.back()} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  added: { marginHorizontal: 12, marginBottom: 8, fontSize: 16, color: colors.success, fontWeight: "600" },
  panel: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, padding: 12, gap: 12 },
  panelName: { fontSize: 20, fontWeight: "700", color: colors.text },
  panelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  panelTotal: { fontSize: 22, fontWeight: "800", color: colors.text },
});

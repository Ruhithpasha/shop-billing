import { router } from "expo-router";
import { useEffect } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { BillItemRow } from "@/components/bill-item-row";
import { Button, colors, EmptyState, ErrorState, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { useCurrentBill } from "@/lib/current-bill";
import { confirm, errorMessage, notify } from "@/lib/dialogs";
import { formatMoney } from "@/lib/money";
import { useBill, useBillMutation } from "@/lib/queries";

export default function CurrentBillScreen() {
  const { billId, ready, setBillId } = useCurrentBill();
  const bill = useBill(billId);

  const setQty = useBillMutation((v: { itemId: number; qty: number }) => api.setItemQty(billId!, v.itemId, v.qty));
  const removeItem = useBillMutation((itemId: number) => api.deleteItem(billId!, itemId));
  const hold = useBillMutation(() => api.hold(billId!));
  const pay = useBillMutation(() => api.pay(billId!));

  // If this bill was paid, held or merged somewhere else, stop treating it as current.
  const status = bill.data?.status;
  useEffect(() => {
    if (status && status !== "open") setBillId(null);
  }, [status, setBillId]);

  if (!ready || (billId != null && bill.isPending)) return <Loading />;
  if (bill.isError) return <ErrorState error={bill.error} onRetry={() => bill.refetch()} />;

  const items = bill.data?.items ?? [];
  const total = bill.data?.total ?? 0;
  const busy = hold.isPending || pay.isPending;

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      notify("Something went wrong", errorMessage(e));
    }
  };

  const onHold = () =>
    run(async () => {
      await hold.mutateAsync(undefined);
      setBillId(null);
    });

  const onPay = () =>
    run(async () => {
      if (!(await confirm("Take payment", `Mark this bill as paid: ${formatMoney(total)}?`, "Paid"))) return;
      const paid = await pay.mutateAsync(undefined);
      setBillId(null);
      notify("Paid", `${formatMoney(paid.total)} received.`);
    });

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title="No items yet" hint="Add products to start a bill.">
          <Button big title="+ Add item" onPress={() => router.push("/add-item")} style={styles.wide} />
          <Button
            title="Merge another bill in"
            variant="ghost"
            onPress={() => router.push("/merge")}
            style={[styles.wide, { marginTop: 8 }]}
          />
        </EmptyState>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <BillItemRow
            item={item}
            editable
            onQtyChange={(qty) => run(() => setQty.mutateAsync({ itemId: item.id, qty }))}
            onDelete={() => run(() => removeItem.mutateAsync(item.id))}
          />
        )}
        ListFooterComponent={<Text style={styles.hint}>Swipe an item left to delete it</Text>}
      />
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Total · {items.length} item{items.length === 1 ? "" : "s"}
          </Text>
          <Text style={styles.total}>{formatMoney(total)}</Text>
        </View>
        <Button big title="+ Add item" onPress={() => router.push("/add-item")} />
        <View style={styles.actions}>
          <Button title="Hold" variant="secondary" onPress={onHold} loading={hold.isPending} disabled={busy} style={styles.flex} />
          <Button title="Merge in" variant="secondary" onPress={() => router.push("/merge")} disabled={busy} style={styles.flex} />
          <Button title="Pay" variant="success" onPress={onPay} loading={pay.isPending} disabled={busy} style={styles.flex} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wide: { alignSelf: "stretch" },
  hint: { textAlign: "center", color: colors.muted, fontSize: 14, padding: 16 },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 12,
    gap: 10,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  totalLabel: { fontSize: 16, color: colors.muted },
  total: { fontSize: 32, fontWeight: "800", color: colors.text },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});

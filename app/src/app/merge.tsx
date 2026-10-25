import { router } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { BillSummary } from "@shop/shared";
import { BillSummaryRow } from "@/components/bill-summary-row";
import { colors, EmptyState, ErrorState, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { useCurrentBill } from "@/lib/current-bill";
import { confirm, errorMessage, notify } from "@/lib/dialogs";
import { formatMoney } from "@/lib/money";
import { useBills, useStoreBill } from "@/lib/queries";

/** Pick another open or held bill and merge all its items into the current bill. */
export default function MergeScreen() {
  const bills = useBills();
  const { billId, ensureBill } = useCurrentBill();
  const storeBill = useStoreBill();
  const [busy, setBusy] = useState(false);

  const candidates = (bills.data ?? []).filter(
    (b) => (b.status === "open" || b.status === "held") && b.id !== billId && b.item_count > 0,
  );

  const merge = async (source: BillSummary) => {
    const ok = await confirm(
      "Merge bill",
      `Move all ${source.item_count} item(s) (${formatMoney(source.total)}) from bill #${source.id} into the current bill?`,
      "Merge",
    );
    if (!ok) return;
    setBusy(true);
    try {
      const target = await ensureBill();
      storeBill(await api.merge(target, source.id));
      router.back();
    } catch (e) {
      notify("Couldn't merge", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (bills.isPending) return <Loading />;
  if (bills.isError) return <ErrorState error={bills.error} onRetry={() => bills.refetch()} />;
  if (candidates.length === 0) {
    return <EmptyState title="Nothing to merge" hint="There are no other open or held bills with items." />;
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.hint}>Tap a bill to merge it into the current bill{billId ? ` (#${billId})` : ""}.</Text>
      <FlatList
        data={candidates}
        keyExtractor={(b) => String(b.id)}
        renderItem={({ item }) => <BillSummaryRow bill={item} onPress={busy ? undefined : () => merge(item)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hint: { fontSize: 16, color: colors.muted, paddingHorizontal: 16, paddingTop: 12 },
});

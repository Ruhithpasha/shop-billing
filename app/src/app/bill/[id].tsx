import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { BillItemRow } from "@/components/bill-item-row";
import { colors, ErrorState, Loading } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { useBill } from "@/lib/queries";
import { formatTime } from "@/lib/time";

/** Read-only view of any bill (used for paid bills in history). */
export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bill = useBill(Number(id));

  if (bill.isPending) return <Loading />;
  if (bill.isError) return <ErrorState error={bill.error} onRetry={() => bill.refetch()} />;
  const b = bill.data;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: `Bill #${b.id}` }} />
      <View style={styles.header}>
        <Text style={styles.status}>{b.status.toUpperCase()}</Text>
        <Text style={styles.sub}>
          {b.status === "merged" && b.merged_into ? `Merged into bill #${b.merged_into} · ` : ""}
          {formatTime(b.updated_at)}
        </Text>
      </View>
      <FlatList
        data={b.items}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => <BillItemRow item={item} editable={false} />}
      />
      <View style={styles.footer}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.total}>{formatMoney(b.total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 16, gap: 4 },
  status: { fontSize: 14, fontWeight: "800", color: colors.success, letterSpacing: 1 },
  sub: { fontSize: 15, color: colors.muted },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    padding: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 18, color: colors.muted },
  total: { fontSize: 30, fontWeight: "800", color: colors.text },
});

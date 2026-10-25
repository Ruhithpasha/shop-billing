import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BillSummary } from "@shop/shared";
import { formatMoney } from "@/lib/money";
import { formatTime } from "@/lib/time";
import { colors } from "./ui";

export function BillSummaryRow({
  bill,
  onPress,
  children,
}: {
  bill: BillSummary;
  onPress?: () => void;
  /** Action buttons shown under the summary. */
  children?: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
      <View style={styles.top}>
        <View>
          <Text style={styles.title}>Bill #{bill.id}</Text>
          <Text style={styles.sub}>
            {bill.item_count} item{bill.item_count === 1 ? "" : "s"} · {formatTime(bill.updated_at)}
          </Text>
        </View>
        <Text style={styles.total}>{formatMoney(bill.total)}</Text>
      </View>
      {children && <View style={styles.actions}>{children}</View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 19, fontWeight: "700", color: colors.text },
  sub: { fontSize: 15, color: colors.muted, marginTop: 2 },
  total: { fontSize: 22, fontWeight: "800", color: colors.text },
  actions: { flexDirection: "row", gap: 10 },
});

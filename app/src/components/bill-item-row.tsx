import { Pressable, StyleSheet, Text, View } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { BillItem } from "@shop/shared";
import { formatMoney, formatQty, unitLabel } from "@/lib/money";
import { QtyPicker } from "./qty-picker";
import { colors } from "./ui";

/** One line on a bill. Editable rows get a qty picker and swipe-left-to-delete. */
export function BillItemRow({
  item,
  editable,
  onQtyChange,
  onDelete,
}: {
  item: BillItem;
  editable: boolean;
  onQtyChange?: (qty: number) => void;
  onDelete?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      <View style={styles.top}>
        <Text style={styles.name} numberOfLines={2}>
          {item.product_name}
        </Text>
        <Text style={styles.lineTotal}>{formatMoney(item.line_total)}</Text>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.price}>
          {formatMoney(item.price_at_sale)}
          {unitLabel(item.unit)}
          {!editable && `  ×  ${formatQty(item.qty, item.unit)}`}
        </Text>
        {editable && onQtyChange && <QtyPicker compact unit={item.unit} value={item.qty} onChange={onQtyChange} />}
      </View>
    </View>
  );

  if (!editable || !onDelete) return content;

  return (
    <Swipeable
      friction={2}
      rightThreshold={60}
      renderRightActions={(_p, _t, methods) => (
        <Pressable
          accessibilityLabel={`Remove ${item.product_name}`}
          onPress={() => {
            methods.close();
            onDelete();
          }}
          style={styles.delete}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      )}
    >
      {content}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { flex: 1, fontSize: 18, fontWeight: "600", color: colors.text },
  lineTotal: { fontSize: 18, fontWeight: "700", color: colors.text },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price: { fontSize: 15, color: colors.muted },
  delete: { width: 110, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  deleteText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});

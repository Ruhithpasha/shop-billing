import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Product } from "@shop/shared";
import { formatMoney, unitLabel } from "@/lib/money";
import { colors } from "./ui";

export function ProductRow({ product, onPress, selected }: { product: Product; onPress: () => void; selected?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.selected, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.sub}>
          {[
            product.barcode,
            product.image_count != null &&
              (product.image_count === 0 ? "no photos" : `${product.image_count} photo${product.image_count === 1 ? "" : "s"}`),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Text style={styles.price}>
        {formatMoney(product.price)}
        <Text style={styles.sub}>{unitLabel(product.unit)}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  selected: { backgroundColor: "#E0E7FF" },
  name: { fontSize: 18, fontWeight: "600", color: colors.text },
  sub: { fontSize: 14, color: colors.muted, fontWeight: "400" },
  price: { fontSize: 18, fontWeight: "700", color: colors.text },
});

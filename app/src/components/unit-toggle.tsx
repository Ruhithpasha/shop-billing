import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Unit } from "@shop/shared";
import { colors } from "./ui";

export function UnitToggle({ value, onChange }: { value: Unit; onChange: (u: Unit) => void }) {
  return (
    <View style={styles.segment}>
      {(["piece", "kg"] as const).map((u) => (
        <Pressable
          key={u}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === u }}
          onPress={() => onChange(u)}
          style={[styles.item, value === u && styles.active]}
        >
          <Text style={[styles.text, value === u && styles.activeText]}>{u === "piece" ? "Piece" : "Weight (kg)"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", gap: 10 },
  item: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: 17, fontWeight: "600", color: colors.text },
  activeText: { color: "#fff" },
});

import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Unit } from "@shop/shared";
import { colors, TOUCH } from "./ui";

const STEP: Record<Unit, number> = { piece: 1, kg: 0.1 };
const MIN: Record<Unit, number> = { piece: 1, kg: 0.001 };

const clean = (n: number) => Number(n.toFixed(3));

/** Parses typed quantity text; returns null if invalid for the unit. */
export function parseQty(text: string, unit: Unit): number | null {
  const t = text.trim().replace(",", ".");
  if (!t || !/^\d*\.?\d*$/.test(t)) return null;
  const n = clean(parseFloat(t));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === "piece" && !Number.isInteger(n)) return null;
  return n;
}

/**
 * +/- buttons with a typed field in the middle. Pieces step by 1; kg steps by
 * 0.1 and accepts any decimal (to the gram).
 */
export function QtyPicker({
  unit,
  value,
  onChange,
  compact,
}: {
  unit: Unit;
  value: number;
  onChange: (qty: number) => void;
  compact?: boolean;
}) {
  // Text being typed; null when not editing, so the field always shows `value`.
  const [draft, setDraft] = useState<string | null>(null);

  const step = (dir: 1 | -1) => {
    const next = clean(Math.max(MIN[unit], value + dir * STEP[unit]));
    onChange(next);
  };

  const commit = () => {
    if (draft == null) return;
    const q = parseQty(draft, unit);
    setDraft(null);
    if (q != null && q !== value) onChange(q);
  };

  const size = compact ? 48 : TOUCH + 8;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="Decrease quantity"
        onPress={() => step(-1)}
        style={[styles.btn, { width: size, height: size }]}
      >
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <View style={styles.inputWrap}>
        <TextInput
          value={draft ?? String(value)}
          onChangeText={setDraft}
          onEndEditing={commit}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={unit === "kg" ? "decimal-pad" : "number-pad"}
          selectTextOnFocus
          style={[styles.input, { height: size, width: compact ? 72 : 100 }]}
        />
        {unit === "kg" && <Text style={styles.unit}>kg</Text>}
      </View>
      <Pressable
        accessibilityLabel="Increase quantity"
        onPress={() => step(1)}
        style={[styles.btn, { width: size, height: size }]}
      >
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: {
    borderRadius: 12,
    backgroundColor: "#E0E7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 28, fontWeight: "700", color: colors.primary, lineHeight: 32 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: 8,
  },
  unit: { fontSize: 16, color: colors.muted },
});

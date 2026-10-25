import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export const colors = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  primary: "#1D4ED8",
  primaryText: "#FFFFFF",
  success: "#15803D",
  danger: "#B91C1C",
  warning: "#B45309",
};

/** Minimum touch target height for counter use. */
export const TOUCH = 56;

type Variant = "primary" | "secondary" | "success" | "danger" | "ghost";

const variantStyles: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.primaryText },
  success: { bg: colors.success, fg: "#fff" },
  danger: { bg: colors.danger, fg: "#fff" },
  secondary: { bg: colors.card, fg: colors.text, border: colors.border },
  ghost: { bg: "transparent", fg: colors.primary },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
  big,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
}) {
  const v = variantStyles[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        big && styles.buttonBig,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg, opacity: off ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.buttonText, big && styles.buttonTextBig, { color: v.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Center({ children }: { children: ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

export function Loading() {
  return (
    <Center>
      <ActivityIndicator size="large" color={colors.primary} />
    </Center>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Center>
      <Text style={styles.errorText}>{error instanceof Error ? error.message : String(error)}</Text>
      {onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} style={{ marginTop: 16 }} />}
    </Center>
  );
}

export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <Center>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint && <Text style={styles.emptyHint}>{hint}</Text>}
      {children}
    </Center>
  );
}

/** Shared look for text fields. */
export const inputStyle = {
  height: 54,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  backgroundColor: colors.card,
  paddingHorizontal: 14,
  fontSize: 18,
  color: colors.text,
} as const;

export const text = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  body: { fontSize: 17, color: colors.text },
  muted: { fontSize: 15, color: colors.muted },
  label: { fontSize: 15, fontWeight: "600", color: colors.muted, marginBottom: 6 },
});

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonBig: { minHeight: 64 },
  buttonText: { fontSize: 17, fontWeight: "700" },
  buttonTextBig: { fontSize: 19 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { fontSize: 17, color: colors.danger, textAlign: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center" },
  emptyHint: { fontSize: 16, color: colors.muted, textAlign: "center", marginTop: 8, marginBottom: 20 },
});

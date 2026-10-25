import { StyleSheet, TextInput } from "react-native";
import { colors } from "./ui";

export function SearchBox({
  value,
  onChangeText,
  placeholder = "Search products",
  autoFocus,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      autoFocus={autoFocus}
      autoCorrect={false}
      autoCapitalize="none"
      clearButtonMode="while-editing"
      returnKeyType="search"
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    margin: 12,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 18,
    color: colors.text,
  },
});

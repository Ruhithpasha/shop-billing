import { StyleSheet, Text, View } from "react-native";
import type { BarcodeScannerProps } from "./barcode-scanner";

/**
 * The app targets Android; the web build exists only for quick checks on a
 * computer. There is no camera scanner here, so use "Type barcode" instead.
 */
export function BarcodeScanner(_props: BarcodeScannerProps) {
  return (
    <View style={styles.fill}>
      <Text style={styles.text}>Camera scanning works in the Android app.{"\n"}Use “Type barcode” below.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center", padding: 24 },
  text: { color: "#fff", fontSize: 16, textAlign: "center" },
});

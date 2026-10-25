import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeBarcodeScanner } from "@/components/safe-native";
import { colors } from "@/components/ui";
import { deliverScan } from "@/lib/scan-result";

/** Full-screen scanner that returns the first barcode it reads. */
export default function ScanBarcodeScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <SafeBarcodeScanner
        onCode={(code) => {
          deliverScan(code);
          router.back();
        }}
      />
      <Text style={[styles.hint, { paddingBottom: 20 + insets.bottom }]}>Point the camera at the product’s barcode</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  hint: { color: colors.card, fontSize: 17, textAlign: "center", padding: 20 },
});

import { StyleSheet, Text, View } from "react-native";
import type { PhotoCaptureProps } from "./photo-capture";

export type { CapturedPhoto, PhotoCaptureProps } from "./photo-capture";

/** The web build is only a test harness; product photos need the Android app. */
export function PhotoCapture(_props: PhotoCaptureProps) {
  return (
    <View style={styles.fill}>
      <Text style={styles.text}>Taking product photos works in the Android app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center", padding: 24 },
  text: { color: "#fff", fontSize: 16, textAlign: "center" },
});

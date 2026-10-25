import { useEffect, useRef, type ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useCameraPermission } from "react-native-vision-camera";
import { Button } from "./ui";

/** Renders children once camera access is granted; asks for it otherwise. */
export function CameraPermissionGate({ children, reason }: { children: ReactNode; reason: string }) {
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const asked = useRef(false);

  // Ask once automatically the first time a camera screen is shown.
  useEffect(() => {
    if (!hasPermission && canRequestPermission && !asked.current) {
      asked.current = true;
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  if (hasPermission) return <>{children}</>;
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{reason}</Text>
      <Button
        title={canRequestPermission ? "Allow camera" : "Open settings"}
        onPress={() => (canRequestPermission ? requestPermission() : Linking.openSettings())}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  text: { color: "#fff", fontSize: 18, textAlign: "center" },
});

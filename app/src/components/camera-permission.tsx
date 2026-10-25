import { useCameraPermissions } from "expo-camera";
import { useEffect, useRef, type ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Button } from "./ui";

/** Renders children once camera access is granted; asks for it otherwise. */
export function CameraPermissionGate({ children, reason }: { children: ReactNode; reason: string }) {
  const [permission, requestPermission] = useCameraPermissions();
  const asked = useRef(false);

  // Ask once automatically the first time a camera screen is shown.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !asked.current) {
      asked.current = true;
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) return <View style={styles.box} />;
  if (permission.granted) return <>{children}</>;
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{reason}</Text>
      <Button
        title={permission.canAskAgain ? "Allow camera" : "Open settings"}
        onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  text: { color: "#fff", fontSize: 18, textAlign: "center" },
});

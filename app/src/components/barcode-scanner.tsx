import { useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, useCameraPermission } from "react-native-vision-camera";
import { useBarcodeScannerOutput, type TargetBarcodeFormat } from "react-native-vision-camera-barcode-scanner";
import { Button, colors } from "./ui";

// Retail barcodes plus the common shelf-label symbologies. QR codes are left
// out so a QR sticker near a product isn't picked up by mistake.
const FORMATS: TargetBarcodeFormat[] = ["ean-13", "ean-8", "upc-a", "upc-e", "code-128", "code-39", "itf"];

/** The same code is ignored for this long, so one barcode isn't read twice. */
const REPEAT_MS = 2500;

export interface BarcodeScannerProps {
  /** Called once per barcode read. */
  onCode: (code: string) => void;
  /** Stop reading codes (e.g. while a result is on screen). The preview keeps running. */
  paused?: boolean;
}

/** Live rear-camera preview that reports barcodes. */
export function BarcodeScanner({ onCode, paused }: BarcodeScannerProps) {
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const [asked, setAsked] = useState(false);
  const [torch, setTorch] = useState(false);
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const last = useRef({ code: "", at: 0 });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  // Ask once automatically the first time the scanner is shown.
  useEffect(() => {
    if (!hasPermission && canRequestPermission && !asked) {
      setAsked(true);
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, asked, requestPermission]);

  const output = useBarcodeScannerOutput({
    barcodeFormats: FORMATS,
    onBarcodeScanned(barcodes) {
      if (pausedRef.current) return;
      const code = barcodes.find((b) => b.rawValue)?.rawValue?.trim();
      if (!code) return;
      const now = Date.now();
      if (code === last.current.code && now - last.current.at < REPEAT_MS) return;
      last.current = { code, at: now };
      onCode(code);
    },
    onError(error) {
      console.warn("Barcode scanner error", error);
    },
  });

  if (!hasPermission) {
    return (
      <View style={[styles.fill, styles.permission]}>
        <Text style={styles.permissionText}>Camera access is needed to scan barcodes.</Text>
        <Button
          title={canRequestPermission ? "Allow camera" : "Open settings"}
          onPress={() => (canRequestPermission ? requestPermission() : Linking.openSettings())}
        />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device="back"
        isActive={isFocused && appActive}
        outputs={[output]}
        torchMode={torch ? "on" : "off"}
        enableNativeTapToFocusGesture
        enableNativeZoomGesture
      />
      <View pointerEvents="none" style={styles.frame} />
      {paused && <View pointerEvents="none" style={styles.dim} />}
      <Pressable
        accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
        onPress={() => setTorch((t) => !t)}
        style={[styles.torch, torch && styles.torchOn]}
      >
        <Text style={[styles.torchText, torch && { color: colors.text }]}>{torch ? "Torch on" : "Torch"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  permission: { alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  permissionText: { color: "#fff", fontSize: 18, textAlign: "center" },
  frame: {
    position: "absolute",
    left: "10%",
    right: "10%",
    top: "30%",
    bottom: "30%",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
  },
  dim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" },
  torch: {
    position: "absolute",
    top: 12,
    right: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
  },
  torchOn: { backgroundColor: "#FDE68A" },
  torchText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

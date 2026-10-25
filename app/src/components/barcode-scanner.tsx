import { CameraView, type BarcodeScanningResult, type BarcodeType } from "expo-camera";
import { useIsFocused } from "expo-router";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Image } from "react-native-nitro-image";
import { useAppActive } from "@/lib/use-app-active";
import { CameraPermissionGate } from "./camera-permission";
import { colors } from "./ui";

// Retail barcodes plus the common shelf-label symbologies. QR codes are left
// out so a QR sticker near a product isn't picked up by mistake.
const FORMATS: BarcodeType[] = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "itf14"];

/** The same code is ignored for this long, so one barcode isn't read twice. */
const REPEAT_MS = 2500;

export interface BarcodeScannerHandle {
  /** Photo of what the camera shows right now (for identifying by photo). */
  snapshot(): Promise<Image>;
}

export interface BarcodeScannerProps {
  ref?: Ref<BarcodeScannerHandle>;
  /** Called once per barcode read. */
  onCode: (code: string) => void;
  /** Stop reading codes (e.g. while a result is on screen). The preview keeps running. */
  paused?: boolean;
}

/** Live rear-camera preview that reports barcodes (expo-camera + ML Kit). */
export function BarcodeScanner(props: BarcodeScannerProps) {
  return (
    <CameraPermissionGate reason="Camera access is needed to scan barcodes.">
      <LiveScanner {...props} />
    </CameraPermissionGate>
  );
}

function LiveScanner({ onCode, paused, ref }: BarcodeScannerProps) {
  const [torch, setTorch] = useState(false);
  const isFocused = useIsFocused();
  const appActive = useAppActive();
  const camera = useRef<CameraView>(null);
  const last = useRef({ code: "", at: 0 });

  useImperativeHandle(ref, () => ({
    snapshot: async () => {
      // Loaded on first use, not at app start.
      const { takePhotoImage } = await import("@/lib/camera-photo");
      return takePhotoImage(camera.current);
    },
  }));

  const onScanned = (result: BarcodeScanningResult) => {
    const code = result.data?.trim();
    if (!code) return;
    const now = Date.now();
    if (code === last.current.code && now - last.current.at < REPEAT_MS) return;
    last.current = { code, at: now };
    onCode(code);
  };

  return (
    <View style={styles.fill}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        active={isFocused && appActive}
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: FORMATS }}
        // No handler while paused: expo-camera then stops reporting codes.
        onBarcodeScanned={paused ? undefined : onScanned}
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

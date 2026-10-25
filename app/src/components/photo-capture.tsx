import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, CommonResolutions, usePhotoOutput } from "react-native-vision-camera";
import { useAppActive } from "@/lib/use-app-active";
import { embedImage, warmUpEmbeddingModel } from "@/lib/embedding";
import { CameraPermissionGate } from "./camera-permission";
import { colors } from "./ui";

export interface CapturedPhoto {
  /** The JPEG as taken (about 768x1024), for storage and thumbnails. */
  jpeg: ArrayBuffer;
  /** Its image embedding, computed on the phone. */
  embedding: number[];
}

export interface PhotoCaptureProps {
  /** Called for each photo; the shutter is disabled until it resolves. */
  onCapture: (photo: CapturedPhoto) => Promise<void>;
  /** Text shown above the shutter, e.g. "2 of 5". */
  status?: string;
  disabled?: boolean;
}

/** Camera with a shutter button that returns each photo plus its embedding. */
export function PhotoCapture(props: PhotoCaptureProps) {
  return (
    <CameraPermissionGate reason="Camera access is needed to photograph products.">
      <LiveCapture {...props} />
    </CameraPermissionGate>
  );
}

function LiveCapture({ onCapture, status, disabled }: PhotoCaptureProps) {
  const isFocused = useIsFocused();
  const appActive = useAppActive();
  const [busy, setBusy] = useState(false);
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.HD_4_3,
    containerFormat: "jpeg",
    quality: 0.8,
  });

  useEffect(warmUpEmbeddingModel, []);

  const shoot = async () => {
    setBusy(true);
    try {
      const photo = await photoOutput.capturePhoto({ enableShutterSound: true }, {});
      try {
        const jpeg = await photo.getFileDataAsync();
        const image = await photo.toImageAsync();
        try {
          const embedding = await embedImage(image);
          await onCapture({ jpeg, embedding });
        } finally {
          image.dispose();
        }
      } finally {
        photo.dispose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.fill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device="back"
        isActive={isFocused && appActive}
        outputs={[photoOutput]}
        enableNativeTapToFocusGesture
      />
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={styles.frame} />
      </View>
      <View style={styles.bottom}>
        {status && <Text style={styles.status}>{status}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          onPress={shoot}
          disabled={busy || disabled}
          style={({ pressed }) => [styles.shutter, (pressed || busy || disabled) && { opacity: 0.6 }]}
        >
          {busy ? <ActivityIndicator color={colors.primary} size="large" /> : <View style={styles.shutterInner} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  // Marks the centre square of the photo, which is what the embedding model sees.
  frameWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  frame: {
    width: "88%",
    aspectRatio: 1,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 16,
  },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 24, alignItems: "center", gap: 12 },
  status: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
  },
  shutter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primary },
});

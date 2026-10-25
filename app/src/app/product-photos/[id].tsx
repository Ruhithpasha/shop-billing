import { useQueryClient } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MAX_IMAGES_PER_PRODUCT } from "@shop/shared";
import { PhotoCapture, type CapturedPhoto } from "@/components/photo-capture";
import { Button, colors } from "@/components/ui";
import { api } from "@/lib/api";
import { toBase64 } from "@/lib/base64";
import { errorMessage } from "@/lib/dialogs";
import { keys, useProduct, useProductImages } from "@/lib/queries";

const SUGGESTED = 5;

/** Take several photos of one product in a row; each is uploaded with its embedding. */
export default function ProductPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Number(id);
  const product = useProduct(productId);
  const images = useProductImages(productId);
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const count = images.data?.length ?? 0;
  const full = count >= MAX_IMAGES_PER_PRODUCT;

  const onCapture = async ({ jpeg, embedding }: CapturedPhoto) => {
    try {
      await api.addImage(productId, { image_base64: toBase64(jpeg), embedding });
      setMessage({ text: `✓ Photo ${count + 1} saved` });
    } catch (e) {
      setMessage({ text: errorMessage(e), error: true });
    } finally {
      qc.invalidateQueries({ queryKey: keys.images(productId) });
      qc.invalidateQueries({ queryKey: ["products"] });
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: product.data ? `Photos: ${product.data.name}` : "Photos" }} />
      <PhotoCapture
        onCapture={onCapture}
        disabled={full}
        status={full ? `${count} photos (maximum)` : `${count} of ${SUGGESTED} photos`}
      />
      <View style={[styles.panel, { paddingBottom: 12 + insets.bottom }]}>
        <Text style={[styles.message, message?.error && { color: colors.danger }]}>
          {message?.text ??
            "Fill the square with the product. Take 3–5 photos from different sides, in normal counter light."}
        </Text>
        <Button title="Done" variant={count >= 3 ? "primary" : "secondary"} onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  panel: { backgroundColor: colors.card, padding: 12, gap: 10 },
  message: { fontSize: 16, color: colors.text, textAlign: "center" },
});

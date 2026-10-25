import { Image } from "expo-image";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MAX_IMAGES_PER_PRODUCT } from "@shop/shared";
import { api, apiUrl } from "@/lib/api";
import { confirm, errorMessage, notify } from "@/lib/dialogs";
import { keys, useProductImages } from "@/lib/queries";
import { Button, colors, text } from "./ui";

/** Thumbnails of a product's matcher photos, with add and delete. */
export function ProductPhotos({ productId }: { productId: number }) {
  const images = useProductImages(productId);
  const qc = useQueryClient();
  const list = images.data ?? [];

  const remove = async (imageId: number) => {
    if (!(await confirm("Delete photo", "Remove this photo from the product?", "Delete"))) return;
    try {
      await api.deleteImage(productId, imageId);
    } catch (e) {
      notify("Couldn't delete photo", errorMessage(e));
    }
    qc.invalidateQueries({ queryKey: keys.images(productId) });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={text.label}>Photos for recognition ({list.length})</Text>
      {list.length === 0 ? (
        <Text style={text.muted}>Add 3–5 photos so the camera can recognise this product without a barcode.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {list.map((img) => (
            <Pressable
              key={img.id}
              onLongPress={() => remove(img.id)}
              accessibilityLabel="Photo, long-press to delete"
            >
              <Image source={apiUrl(img.url)} style={styles.thumb} contentFit="cover" transition={150} />
              <Pressable accessibilityLabel="Delete photo" onPress={() => remove(img.id)} style={styles.remove}>
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Button
        title={list.length === 0 ? "Take photos" : "Add more photos"}
        variant="secondary"
        disabled={list.length >= MAX_IMAGES_PER_PRODUCT}
        onPress={() => router.push({ pathname: "/product-photos/[id]", params: { id: String(productId) } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: colors.border },
  remove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 22 },
});

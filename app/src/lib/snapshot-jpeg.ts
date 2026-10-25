import type { Image } from "react-native-nitro-image";

const MAX_SIDE = 1024;

/** JPEG of a camera snapshot, at most 1024 px on its long side, for upload and thumbnails. */
export async function toUploadJpeg(image: Image): Promise<ArrayBuffer> {
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const small = scale < 1 ? await image.resizeAsync(Math.round(image.width * scale), Math.round(image.height * scale)) : image;
  try {
    return (await small.toEncodedImageDataAsync("jpg", 80)).buffer;
  } finally {
    if (small !== image) small.dispose();
  }
}

import type { CameraView } from "expo-camera";
import { loadImage, type Image } from "react-native-nitro-image";

/**
 * Takes a photo with expo-camera and loads it for the embedding model.
 * Product photos and "identify" photos both come through here, so they are
 * framed and oriented the same way (expo-camera returns upright photos).
 */
export async function takePhotoImage(camera: CameraView | null): Promise<Image> {
  if (!camera) throw new Error("The camera isn't ready yet");
  const picture = await camera.takePictureAsync({ quality: 0.7, shutterSound: false });
  return loadImage({ filePath: picture.uri });
}

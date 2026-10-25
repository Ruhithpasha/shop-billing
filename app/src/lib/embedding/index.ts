import { EMBEDDING_DIMENSIONS } from "@shop/shared";
import { loadTensorflowModel, type TfliteModel } from "react-native-fast-tflite";
import type { Image } from "react-native-nitro-image";
import { centerSquare, l2Normalize, toModelInput } from "./preprocess";

/**
 * Image -> embedding vector, the one place that decides how embeddings are
 * made. Today: MobileNetV3-Large on the phone (TFLite, CPU). To switch to a
 * server-side model later, change this function and EMBEDDING_DIMENSIONS
 * (and recreate the Vectorize index with the new dimensions).
 */
export async function embedImage(image: Image): Promise<number[]> {
  const [x0, y0, x1, y1] = centerSquare(image.width, image.height);
  const square = await image.cropAsync(x0, y0, x1, y1);
  const small = await square.resizeAsync(INPUT_SIZE, INPUT_SIZE);
  try {
    const input = toModelInput(await small.toRawPixelDataAsync());
    const [output] = await (await getModel()).run([input.buffer as ArrayBuffer]);
    const vector = new Float32Array(output);
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Model returned ${vector.length} numbers, expected ${EMBEDDING_DIMENSIONS}`);
    }
    return l2Normalize(vector);
  } finally {
    square.dispose();
    small.dispose();
  }
}

/** Loads the model in the background so the first photo isn't slow. */
export function warmUpEmbeddingModel() {
  getModel().catch((e) => console.warn("Embedding model failed to load", e));
}

const INPUT_SIZE = 224;
let model: Promise<TfliteModel> | null = null;

function getModel(): Promise<TfliteModel> {
  model ??= loadTensorflowModel(require("../../../assets/models/mobilenet_v3_large_embedding.tflite"), []).catch(
    (e) => {
      model = null; // allow a retry
      throw e;
    },
  );
  return model;
}

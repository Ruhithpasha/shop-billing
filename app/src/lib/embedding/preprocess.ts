/** Raw pixels as returned by react-native-nitro-image's toRawPixelData(). */
export interface RawPixels {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  pixelFormat: string;
}

// Byte offsets of R, G, B within one pixel, and bytes per pixel.
const LAYOUTS: Record<string, { r: number; g: number; b: number; bpp: number }> = {
  RGBA: { r: 0, g: 1, b: 2, bpp: 4 },
  RGBX: { r: 0, g: 1, b: 2, bpp: 4 },
  BGRA: { r: 2, g: 1, b: 0, bpp: 4 },
  BGRX: { r: 2, g: 1, b: 0, bpp: 4 },
  ARGB: { r: 1, g: 2, b: 3, bpp: 4 },
  XRGB: { r: 1, g: 2, b: 3, bpp: 4 },
  ABGR: { r: 3, g: 2, b: 1, bpp: 4 },
  XBGR: { r: 3, g: 2, b: 1, bpp: 4 },
  RGB: { r: 0, g: 1, b: 2, bpp: 3 },
  BGR: { r: 2, g: 1, b: 0, bpp: 3 },
};

/**
 * Converts pixels to the model's input: float32 [height, width, 3] RGB with
 * raw 0..255 values (MobileNetV3 rescales internally). Handles any pixel
 * layout and row padding.
 */
export function toModelInput(raw: RawPixels): Float32Array {
  const { width, height } = raw;
  // Android bitmaps are RGBA in memory; treat an unknown 4-byte format the same way.
  const layout = LAYOUTS[raw.pixelFormat] ?? LAYOUTS.RGBA;
  const bytes = new Uint8Array(raw.buffer);
  const stride = Math.floor(bytes.byteLength / height);
  if (stride < width * layout.bpp) {
    throw new Error(`Pixel buffer too small: ${bytes.byteLength} bytes for ${width}x${height} ${raw.pixelFormat}`);
  }
  const out = new Float32Array(width * height * 3);
  let o = 0;
  for (let y = 0; y < height; y++) {
    let p = y * stride;
    for (let x = 0; x < width; x++, p += layout.bpp) {
      out[o++] = bytes[p + layout.r];
      out[o++] = bytes[p + layout.g];
      out[o++] = bytes[p + layout.b];
    }
  }
  return out;
}

/** Scales a vector to length 1 so cosine similarity is a plain dot product. */
export function l2Normalize(v: Float32Array): number[] {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum) || 1;
  return Array.from(v, (x) => x / norm);
}

/** Largest centred square inside a width x height image: [startX, startY, endX, endY]. */
export function centerSquare(width: number, height: number): [number, number, number, number] {
  const side = Math.min(width, height);
  const x = Math.floor((width - side) / 2);
  const y = Math.floor((height - side) / 2);
  return [x, y, x + side, y + side];
}

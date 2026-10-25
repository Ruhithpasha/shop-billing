const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64-encodes binary data (React Native has no Buffer). */
export function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const parts: string[] = [];
  const CHUNK = 3 * 4096; // multiple of 3 so chunks join without padding
  for (let start = 0; start < bytes.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, bytes.length);
    let s = "";
    let i = start;
    for (; i + 2 < end; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      s += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63];
    }
    if (i < end) {
      const n = (bytes[i] << 16) | ((i + 1 < end ? bytes[i + 1] : 0) << 8);
      s += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63];
      s += i + 1 < end ? ALPHABET[(n >> 6) & 63] + "=" : "==";
    }
    parts.push(s);
  }
  return parts.join("");
}

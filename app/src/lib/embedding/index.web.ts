/** The web build is only a test harness; embeddings need the Android app. */
export async function embedImage(_image: unknown): Promise<number[]> {
  throw new Error("Photo recognition works in the Android app only.");
}

export function warmUpEmbeddingModel() {}

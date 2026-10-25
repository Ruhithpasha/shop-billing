import { env } from "cloudflare:workers";

/**
 * The few Vectorize operations we use. Normally this is the real Vectorize
 * index. `npm run dev:offline` runs without the binding (no Cloudflare login
 * needed); then an in-memory stand-in is used, emptied on every restart.
 */
export interface VectorStore {
  upsert(vectors: { id: string; values: number[]; metadata: { product_id: number } }[]): Promise<unknown>;
  deleteByIds(ids: string[]): Promise<unknown>;
  query(
    vector: number[],
    options: { topK: number; returnMetadata: "all" },
  ): Promise<{ matches: { id: string; score: number; metadata?: Record<string, unknown> }[] }>;
}

export function vectorStore(): VectorStore {
  const bound = (env as Partial<Cloudflare.Env>).VECTORIZE;
  if (bound) return bound as unknown as VectorStore;
  if (!warned) {
    console.warn("VECTORIZE is not bound: using an in-memory vector store (offline dev only).");
    warned = true;
  }
  return memoryStore;
}

let warned = false;
const memory = new Map<string, { values: number[]; metadata: { product_id: number } }>();

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const memoryStore: VectorStore = {
  async upsert(vectors) {
    for (const v of vectors) memory.set(v.id, { values: v.values, metadata: v.metadata });
  },
  async deleteByIds(ids) {
    for (const id of ids) memory.delete(id);
  },
  async query(vector, { topK }) {
    const matches = [...memory.entries()]
      .map(([id, v]) => ({ id, score: cosine(vector, v.values), metadata: v.metadata }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return { matches };
  },
};

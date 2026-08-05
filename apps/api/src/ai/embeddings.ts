// Lightweight local embedding fallback for the MVP's semantic search / chat
// retrieval, so "chat with comments" works without wiring up a second AI
// provider (Anthropic doesn't expose an embeddings endpoint) or standing up
// pgvector/Pinecone for a first demo.
//
// This is a hashing-trick bag-of-words vectorizer: deterministic, fast, and
// zero-dependency. It captures keyword overlap well enough to retrieve
// relevant comments for a question, but it is NOT a substitute for real
// sentence embeddings — swap `localEmbed` for a call to a real embedding
// model (or the AIProvider.embed() method backed by one) before relying on
// this for nuanced semantic similarity in production. The retrieval call
// site (chat.service.ts) only depends on `cosineSimilarity` + a 256-dim
// vector, so swapping the vectorizer later doesn't touch calling code.

const DIMENSIONS = 256;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash % DIMENSIONS;
}

export function localEmbed(text: string): number[] {
  const vector = new Array(DIMENSIONS).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    vector[hashToken(token)] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both vectors are already unit-normalized, so dot == cosine
}

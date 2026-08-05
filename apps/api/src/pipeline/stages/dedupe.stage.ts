// Marks near-duplicate / copy-paste-spam comments. Uses exact-match-after-
// normalization plus embedding cosine similarity above a high threshold —
// cheap enough to run in-process without a dedicated dedup service at MVP
// comment volumes.
import { cosineSimilarity } from "../../ai/embeddings";

const EXACT_DUP_THRESHOLD = 0.97;

export function findDuplicates(
  comments: { id: string; textOriginal: string; embedding: number[] }[]
): Map<string, string> {
  const duplicateOf = new Map<string, string>(); // commentId -> canonical commentId
  const seenNormalized = new Map<string, string>(); // normalized text -> commentId

  for (const comment of comments) {
    const normalized = comment.textOriginal.trim().toLowerCase();
    if (seenNormalized.has(normalized)) {
      duplicateOf.set(comment.id, seenNormalized.get(normalized)!);
      continue;
    }
    seenNormalized.set(normalized, comment.id);
  }

  // Embedding-similarity pass catches near-duplicates the exact-text pass
  // misses (minor rewording, punctuation changes).
  for (let i = 0; i < comments.length; i++) {
    if (duplicateOf.has(comments[i].id)) continue;
    for (let j = 0; j < i; j++) {
      if (duplicateOf.has(comments[j].id)) continue;
      const sim = cosineSimilarity(comments[i].embedding, comments[j].embedding);
      if (sim >= EXACT_DUP_THRESHOLD) {
        duplicateOf.set(comments[i].id, comments[j].id);
        break;
      }
    }
  }

  return duplicateOf;
}

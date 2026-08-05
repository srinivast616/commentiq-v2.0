// Stage 6: frequency-based keyword/hashtag/entity extraction.
//
// This is a lightweight statistical pass (stopword-filtered frequency count +
// regex-based hashtag/mention detection), not a full NER model — good enough
// for "most frequent words" and hashtags out of the box with zero AI calls.
// Named entities (people/orgs/locations/products) beyond hashtags are left
// to Phase 2's dedicated NER pass rather than faked here.
const STOPWORDS = new Set([
  "the","a","an","is","it","to","and","of","in","that","this","for","on","with",
  "was","as","are","be","or","but","not","you","i","its","at","so","if","we",
  "they","he","she","have","has","had","do","does","did","just","very","really",
  "im","dont","cant","its","my","your","their","our",
]);

export interface KeywordCount {
  term: string;
  type: "keyword" | "hashtag";
  frequency: number;
}

export function extractKeywords(texts: string[]): KeywordCount[] {
  const counts = new Map<string, KeywordCount>();

  for (const text of texts) {
    const hashtags = text.match(/#\w+/g) ?? [];
    for (const tag of hashtags) {
      const key = tag.toLowerCase();
      const existing = counts.get(key);
      if (existing) existing.frequency += 1;
      else counts.set(key, { term: tag, type: "hashtag", frequency: 1 });
    }

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s#]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w) && !w.startsWith("#"));

    for (const word of words) {
      const existing = counts.get(word);
      if (existing) existing.frequency += 1;
      else counts.set(word, { term: word, type: "keyword", frequency: 1 });
    }
  }

  return [...counts.values()].sort((a, b) => b.frequency - a.frequency).slice(0, 100);
}

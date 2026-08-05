// Minimal heuristic language detector — good enough to route the "is this
// English or not" branch for the MVP. Swap for a real model (e.g. `franc` or
// a fastText language-ID model) before relying on this for anything beyond a
// coarse routing decision; it does not attempt to distinguish similar
// languages accurately.
const SIGNALS: { code: string; pattern: RegExp }[] = [
  { code: "es", pattern: /[¿¡]|(?:\b(el|la|los|las|de|que|y|es|para|con)\b)/i },
  { code: "pt", pattern: /(?:\b(que|não|para|com|uma|obrigado)\b)/i },
  { code: "fr", pattern: /(?:\b(le|la|les|de|que|et|pour|avec|merci)\b)/i },
  { code: "de", pattern: /(?:\b(der|die|das|und|nicht|für|mit|danke)\b)/i },
  { code: "hi", pattern: /[\u0900-\u097F]/ },
  { code: "ar", pattern: /[\u0600-\u06FF]/ },
  { code: "ja", pattern: /[\u3040-\u30FF\u4E00-\u9FFF]/ },
  { code: "ko", pattern: /[\uAC00-\uD7AF]/ },
  { code: "ru", pattern: /[\u0400-\u04FF]/ },
];

export function detectLanguage(text: string): string {
  for (const { code, pattern } of SIGNALS) {
    if (pattern.test(text)) return code;
  }
  return "en";
}

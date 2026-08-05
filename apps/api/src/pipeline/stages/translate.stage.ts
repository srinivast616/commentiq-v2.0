import { getAIProvider } from "../../ai";

// Stage 4: translate non-English comments to English so every downstream
// classifier operates on a single language. Original text is always
// preserved in `textOriginal` (see schema) — translation only populates
// `textTranslated`.
export async function translateToEnglish(text: string, languageCode: string): Promise<string | null> {
  if (languageCode === "en") return null;
  const provider = getAIProvider();
  return provider.translate(text, languageCode);
}

// Stage: normalize raw comment text before any AI call touches it.
export function cleanText(text: string, stripEmoji = false): string {
  let cleaned = text
    .replace(/[\u0000-\u001F\u007F]/g, " ") // control chars
    .replace(/\s+/g, " ")
    .trim();

  if (stripEmoji) {
    cleaned = cleaned.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
  }

  return cleaned;
}

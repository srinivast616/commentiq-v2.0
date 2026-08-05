import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import {
  AIProvider,
  ChatAnswer,
  ClassificationResult,
  SummaryInput,
  SummaryResult,
} from "../ai-provider.interface";
import { localEmbed } from "../embeddings";

const MODEL = "claude-sonnet-4-6";

function extractJson<T>(text: string): T {
  // Models occasionally wrap JSON in prose or code fences despite instructions —
  // strip fences and grab the first {...} or [...] block defensively.
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  return JSON.parse(match ? match[0] : cleaned);
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    if (!env.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic");
    }
    this.client = new Anthropic({ apiKey: env.anthropicApiKey });
  }

  async classifyBatch(
    comments: { id: string; text: string }[],
    existingTopics: string[]
  ): Promise<ClassificationResult[]> {
    // Batched into one prompt per call (caller chunks into groups of ~25) to
    // keep per-comment AI cost manageable at scale, per the architecture doc.
    const prompt = `You are analyzing social media comments for an audience-intelligence tool.
For EACH comment below, return a JSON array (same order, same length) where each
element has exactly this shape:

{
  "commentId": string,
  "sentiment": { "label": "positive"|"neutral"|"negative", "confidence": number (0-1), "score": number (-1 to 1) },
  "emotions": { "joy": number, "anger": number, "sadness": number, "fear": number, "surprise": number, "disappointment": number, "confusion": number, "sarcasm": number } // each 0-1, only include the emotions actually present
  "toxicity": { "flags": { "spam": boolean, "hate_speech": boolean, "profanity": boolean, "threat": boolean, "bullying": boolean }, "confidence": { "<same keys>": number } },
  "intent": "question"|"complaint"|"suggestion"|"praise"|"purchase_intent"|"support_request"|"bug_report"|"feature_request"|"other",
  "topics": string[] // 1-3 short topic names. Prefer reusing one of these existing project topics if it fits: ${JSON.stringify(existingTopics)}. Otherwise invent a short new topic name.
}

Return ONLY the JSON array, no prose, no markdown fences.

Comments:
${comments.map((c, i) => `${i + 1}. [id=${c.id}] ${c.text.slice(0, 800)}`).join("\n")}`;

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    return extractJson<ClassificationResult[]>(text);
  }

  async summarize(input: SummaryInput): Promise<SummaryResult> {
    const prompt = `You are writing an executive summary of audience comments for a content
creator/brand dashboard called CommentIQ.

Project: "${input.projectName}"
Total comments analyzed: ${input.totalComments}
Sentiment distribution: ${JSON.stringify(input.sentimentDistribution)}
Top topics: ${JSON.stringify(input.topTopics)}
Sample of representative comments: ${JSON.stringify(input.sampleComments.slice(0, 40))}

Return ONLY this JSON shape, no prose, no markdown fences:
{
  "executiveSummary": string (2-4 sentences),
  "overallOpinion": string (one short phrase),
  "topPositivePoints": string[] (up to 5),
  "topNegativePoints": string[] (up to 5),
  "suggestions": string[] (audience suggestions, up to 5),
  "commonComplaints": string[] (up to 5),
  "appreciatedFeatures": string[] (up to 5)
}`;

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    return extractJson<SummaryResult>(text);
  }

  async answerQuestion(question: string, context: { text: string; sentiment: string }[]): Promise<ChatAnswer> {
    const prompt = `You are answering a question about audience comments using ONLY the
comments provided below as context. If the comments don't contain enough
information to answer confidently, say so plainly.

Question: "${question}"

Relevant comments (with sentiment labels):
${context.map((c, i) => `${i + 1}. [${c.sentiment}] ${c.text.slice(0, 400)}`).join("\n")}

Answer in 2-5 sentences, grounded specifically in the comments above. Return
ONLY the answer text, no JSON, no preamble.`;

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    return { answer: text.trim() };
  }

  async translate(text: string, sourceLanguageCode: string): Promise<string> {
    const prompt = `Translate the following comment (language code: ${sourceLanguageCode}) into
English. Return ONLY the translation, no notes, no quotation marks.

"${text}"`;
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    return response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
  }

  async embed(text: string): Promise<number[]> {
    // Anthropic doesn't expose an embeddings endpoint. Production should call
    // a dedicated embedding model (or Pinecone/pgvector's own embedding
    // integration); this MVP falls back to the local hashing vectorizer so
    // "chat with comments" retrieval still works out of the box regardless
    // of which AIProvider is active. Swap this one line when you wire up a
    // real embedding model.
    return localEmbed(text);
  }

  async translateToEnglish(text: string, sourceLanguageCode: string): Promise<string> {
    if (sourceLanguageCode === "en") return text;
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Translate the following text to English. Return ONLY the translation, no notes, no quotes:\n\n${text.slice(
            0,
            1000
          )}`,
        },
      ],
    });
    return response.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
  }
}

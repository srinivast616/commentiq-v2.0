// Every pipeline stage that needs an LLM call talks to this interface, never
// to a specific SDK. That's what makes "swap the model" a config change
// (AI_PROVIDER=anthropic|mock) instead of a rewrite, and it's how you'd add
// a third provider (e.g. an in-house fine-tuned classifier) later.

export interface SentimentResult {
  label: "positive" | "neutral" | "negative";
  confidence: number; // 0..1
  score: number; // -1..1
}

export interface EmotionResult {
  [emotion: string]: number; // 0..1 per emotion
}

export interface ToxicityResult {
  flags: Record<string, boolean>;
  confidence: Record<string, number>;
}

export type Intent =
  | "question"
  | "complaint"
  | "suggestion"
  | "praise"
  | "purchase_intent"
  | "support_request"
  | "bug_report"
  | "feature_request"
  | "other";

export interface ClassificationResult {
  commentId: string;
  sentiment: SentimentResult;
  emotions: EmotionResult;
  toxicity: ToxicityResult;
  intent: Intent;
  topics: string[]; // AI-assigned topic names, may be new or existing
}

export interface SummaryInput {
  projectName: string;
  totalComments: number;
  sentimentDistribution: Record<string, number>;
  topTopics: { name: string; count: number }[];
  sampleComments: { text: string; sentiment: string }[];
}

export interface SummaryResult {
  executiveSummary: string;
  overallOpinion: string;
  topPositivePoints: string[];
  topNegativePoints: string[];
  suggestions: string[];
  commonComplaints: string[];
  appreciatedFeatures: string[];
}

export interface ChatAnswer {
  answer: string;
}

export interface AIProvider {
  /** Classify a batch of comments in one call to control token/cost overhead. */
  classifyBatch(comments: { id: string; text: string }[], existingTopics: string[]): Promise<ClassificationResult[]>;

  /** Produce the project-level executive summary from aggregated stats + a sample. */
  summarize(input: SummaryInput): Promise<SummaryResult>;

  /** Answer a natural-language question grounded in a retrieved set of comments. */
  answerQuestion(question: string, context: { text: string; sentiment: string }[]): Promise<ChatAnswer>;

  /** Translate a single comment to English. Implementations may no-op for already-English text. */
  translate(text: string, sourceLanguageCode: string): Promise<string>;

  /** Deterministic-ish text embedding for semantic search (see embeddings.ts for the local fallback). */
  embed(text: string): Promise<number[]>;

  /** Translate text to English (no-op if already English). Used by the translate pipeline stage. */
  translateToEnglish(text: string, sourceLanguageCode: string): Promise<string>;
}

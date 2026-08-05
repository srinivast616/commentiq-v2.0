import {
  AIProvider,
  ChatAnswer,
  ClassificationResult,
  SummaryInput,
  SummaryResult,
} from "../ai-provider.interface";
import { localEmbed } from "../embeddings";

// Deterministic fake provider — lets you run the ENTIRE pipeline end to end
// (extraction → classification → aggregation → summary → chat) with zero API
// key and zero cost, which is useful for local development, demos, and
// automated tests. It uses simple heuristics (keyword spotting) rather than
// real ML, so its outputs are plausible but not accurate — never use it as
// the AI_PROVIDER value in production.

const POSITIVE_WORDS = ["love", "great", "amazing", "awesome", "best", "thanks", "good", "helpful"];
const NEGATIVE_WORDS = ["hate", "worst", "bad", "terrible", "awful", "broken", "scam", "annoying"];

function heuristicSentiment(text: string): ClassificationResult["sentiment"] {
  const lower = text.toLowerCase();
  const pos = POSITIVE_WORDS.filter((w) => lower.includes(w)).length;
  const neg = NEGATIVE_WORDS.filter((w) => lower.includes(w)).length;
  if (pos > neg) return { label: "positive", confidence: 0.7 + Math.min(pos, 3) * 0.1, score: 0.5 };
  if (neg > pos) return { label: "negative", confidence: 0.7 + Math.min(neg, 3) * 0.1, score: -0.5 };
  return { label: "neutral", confidence: 0.6, score: 0 };
}

const TOPIC_KEYWORDS: Record<string, string[]> = {
  Pricing: ["price", "expensive", "cost", "cheap", "afford"],
  "Quality/Bugs": ["bug", "broken", "crash", "quality", "glitch"],
  "Customer Support": ["support", "help", "response", "service"],
  "Feature Requests": ["wish", "should add", "please add", "feature", "dark mode"],
  General: [],
};

function heuristicTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const matches = Object.entries(TOPIC_KEYWORDS)
    .filter(([name, keywords]) => name !== "General" && keywords.some((k) => lower.includes(k)))
    .map(([name]) => name);
  return matches.length > 0 ? matches : ["General"];
}

export class MockProvider implements AIProvider {
  async classifyBatch(comments: { id: string; text: string }[]): Promise<ClassificationResult[]> {
    return comments.map((c) => {
      const sentiment = heuristicSentiment(c.text);
      const lower = c.text.toLowerCase();
      return {
        commentId: c.id,
        sentiment,
        emotions: {
          joy: sentiment.label === "positive" ? 0.7 : 0.1,
          anger: sentiment.label === "negative" ? 0.6 : 0.05,
          disappointment: sentiment.label === "negative" ? 0.4 : 0.05,
          confusion: lower.includes("?") ? 0.3 : 0.05,
        },
        toxicity: {
          flags: {
            spam: /http:\/\/|https:\/\/|subscribe to my/i.test(c.text),
            profanity: false,
            hate_speech: false,
            threat: false,
          },
          confidence: { spam: 0.6, profanity: 0.5, hate_speech: 0.5, threat: 0.5 },
        },
        intent: lower.includes("?")
          ? "question"
          : lower.includes("wish") || lower.includes("please add")
          ? "feature_request"
          : sentiment.label === "negative"
          ? "complaint"
          : sentiment.label === "positive"
          ? "praise"
          : "other",
        topics: heuristicTopics(c.text),
      };
    });
  }

  async summarize(input: SummaryInput): Promise<SummaryResult> {
    const posPct = Math.round((input.sentimentDistribution.positive ?? 0) * 100);
    const negPct = Math.round((input.sentimentDistribution.negative ?? 0) * 100);
    return {
      executiveSummary: `Across ${input.totalComments} comments on "${input.projectName}", audience sentiment is roughly ${posPct}% positive and ${negPct}% negative. The most discussed topics were ${input.topTopics
        .slice(0, 3)
        .map((t) => t.name)
        .join(", ")}.`,
      overallOpinion: posPct >= negPct ? "Generally favorable" : "Mixed to critical",
      topPositivePoints: ["Audience appreciates responsiveness", "Positive reception of recent updates"],
      topNegativePoints: ["Some frustration around pricing", "Recurring bug reports"],
      suggestions: ["Consider a pricing FAQ", "Publish a public bug tracker"],
      commonComplaints: ["Price", "Bugs"],
      appreciatedFeatures: ["Customer support responsiveness"],
    };
  }

  async answerQuestion(question: string, context: { text: string; sentiment: string }[]): Promise<ChatAnswer> {
    if (context.length === 0) {
      return { answer: "I couldn't find any comments relevant to that question in this project." };
    }
    const negatives = context.filter((c) => c.sentiment === "negative").length;
    return {
      answer: `Based on ${context.length} related comments (${negatives} negative), the audience's main signal here relates to: "${context[0].text.slice(
        0,
        120
      )}" — and similar recurring feedback. (Mock provider: switch AI_PROVIDER=anthropic for a real generated answer.)`,
    };
  }

  async embed(text: string): Promise<number[]> {
    return localEmbed(text);
  }

  async translateToEnglish(text: string, sourceLanguageCode: string): Promise<string> {
    if (sourceLanguageCode === "en") return text;
    // No real translation without a model — mark clearly rather than
    // pretending. Switch AI_PROVIDER=anthropic for real translation.
    return `[mock-translation from ${sourceLanguageCode}] ${text}`;
  }
}

import { prisma } from "../../db/prisma";
import { getAIProvider } from "../../ai";
import { SummaryResult } from "../../ai/ai-provider.interface";

export async function getDashboard(projectId: string) {
  const comments = await prisma.comment.findMany({
    where: { sourceId: { in: (await prisma.source.findMany({ where: { projectId }, select: { id: true } })).map((s) => s.id) } },
    include: { analysis: true },
  });

  const total = comments.length;
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  const emotionTotals = new Map<string, number>();
  const languageCounts = new Map<string, number>();
  const timelineMap = new Map<string, { positive: number; neutral: number; negative: number }>();
  const toxicitySummary = new Map<string, number>();

  for (const c of comments) {
    const label = (c.analysis?.sentimentLabel as "positive" | "neutral" | "negative") ?? "neutral";
    sentimentCounts[label] = (sentimentCounts[label] ?? 0) + 1;

    if (c.analysis?.emotions) {
      const emotions = JSON.parse(c.analysis.emotions) as Record<string, number>;
      for (const [emotion, score] of Object.entries(emotions)) {
        emotionTotals.set(emotion, (emotionTotals.get(emotion) ?? 0) + score);
      }
    }

    if (c.analysis?.toxicityFlags) {
      const flags = JSON.parse(c.analysis.toxicityFlags) as Record<string, boolean>;
      for (const [flag, value] of Object.entries(flags)) {
        if (value) toxicitySummary.set(flag, (toxicitySummary.get(flag) ?? 0) + 1);
      }
    }

    const lang = c.languageCode ?? "unknown";
    languageCounts.set(lang, (languageCounts.get(lang) ?? 0) + 1);

    const day = (c.postedAt ?? c.createdAt).toISOString().slice(0, 10);
    const bucket = timelineMap.get(day) ?? { positive: 0, neutral: 0, negative: 0 };
    bucket[label] += 1;
    timelineMap.set(day, bucket);
  }

  const topics = await prisma.topic.findMany({ where: { projectId }, orderBy: { commentCount: "desc" }, take: 15 });

  const emotionDistribution: Record<string, number> = {};
  for (const [emotion, sum] of emotionTotals.entries()) {
    emotionDistribution[emotion] = total > 0 ? Number((sum / total).toFixed(3)) : 0;
  }

  return {
    total_comments: total,
    sentiment_distribution: {
      positive: total ? Number((sentimentCounts.positive / total).toFixed(3)) : 0,
      neutral: total ? Number((sentimentCounts.neutral / total).toFixed(3)) : 0,
      negative: total ? Number((sentimentCounts.negative / total).toFixed(3)) : 0,
    },
    emotion_distribution: emotionDistribution,
    topic_distribution: topics.map((t) => ({ topic: t.name, count: t.commentCount })),
    language_distribution: Array.from(languageCounts.entries()).map(([language, count]) => ({ language, count })),
    timeline: Array.from(timelineMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts })),
    toxicity_summary: Object.fromEntries(toxicitySummary),
  };
}

let summaryCache = new Map<string, { result: SummaryResult; computedAt: number }>();
const SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;

export async function getSummary(projectId: string): Promise<SummaryResult> {
  const cached = summaryCache.get(projectId);
  if (cached && Date.now() - cached.computedAt < SUMMARY_CACHE_TTL_MS) {
    return cached.result;
  }

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const dashboard = await getDashboard(projectId);
  const topics = await prisma.topic.findMany({ where: { projectId }, orderBy: { commentCount: "desc" }, take: 5 });

  const sampleComments = await prisma.comment.findMany({
    where: { sourceId: { in: (await prisma.source.findMany({ where: { projectId }, select: { id: true } })).map((s) => s.id) } },
    include: { analysis: true },
    take: 40,
    orderBy: { likeCount: "desc" },
  });

  const ai = getAIProvider();
  const result = await ai.summarize({
    projectName: project.name,
    totalComments: dashboard.total_comments,
    sentimentDistribution: dashboard.sentiment_distribution,
    topTopics: topics.map((t) => ({ name: t.name, count: t.commentCount })),
    sampleComments: sampleComments.map((c) => ({
      text: (c.textTranslated ?? c.textOriginal).slice(0, 300),
      sentiment: c.analysis?.sentimentLabel ?? "neutral",
    })),
  });

  summaryCache.set(projectId, { result, computedAt: Date.now() });
  return result;
}

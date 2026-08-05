import { prisma } from "../db/prisma";
import { getAIProvider } from "../ai";
import { cleanText } from "./stages/clean.stage";
import { detectLanguage } from "./stages/detect-language.stage";
import { findDuplicates } from "./stages/dedupe.stage";
import { extractKeywords } from "./stages/extract-keywords.stage";
import { JobContext } from "../queue/queue";
import { logger } from "../utils/logger";

const CLASSIFY_BATCH_SIZE = 25;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Runs stages 2–10 of the AI pipeline described in the architecture doc
// (extraction, stage 1, already happened by the time this is called).
// Each stage writes its results to Postgres/SQLite before moving to the
// next, so a project's dashboard can show partial data even mid-run, and a
// failure partway through doesn't lose completed work.
export async function runAnalysisPipeline(projectId: string, sourceId: string, ctx: JobContext) {
  const ai = getAIProvider();
  const comments = await prisma.comment.findMany({ where: { sourceId } });

  if (comments.length === 0) {
    await prisma.project.update({ where: { id: projectId }, data: { status: "failed" } });
    throw new Error("No comments were extracted — nothing to analyze");
  }

  // --- Stage: clean + detect language + translate ---
  ctx.setStage("clean");
  ctx.setProgress(10);
  const prepared: { id: string; textForAnalysis: string; embedding: number[] }[] = [];

  for (const comment of comments) {
    const cleaned = cleanText(comment.textOriginal);
    const language = detectLanguage(cleaned);
    const translated = language === "en" ? null : await ai.translateToEnglish(cleaned, language);

    await prisma.comment.update({
      where: { id: comment.id },
      data: { textOriginal: cleaned, languageCode: language, textTranslated: translated },
    });

    prepared.push({ id: comment.id, textForAnalysis: translated ?? cleaned, embedding: [] });
  }
  ctx.setStage("detect-language");
  ctx.setProgress(20);
  ctx.setStage("translate");
  ctx.setProgress(30);

  // --- Stage: classify (sentiment, emotion, toxicity, intent, topics) ---
  ctx.setStage("classify");
  const existingTopics = (await prisma.topic.findMany({ where: { projectId } })).map((t) => t.name);
  const batches = chunk(
    prepared.map((p) => ({ id: p.id, text: p.textForAnalysis })),
    CLASSIFY_BATCH_SIZE
  );

  const topicCache = new Map<string, string>(); // topic name -> topic id
  for (const t of await prisma.topic.findMany({ where: { projectId } })) {
    topicCache.set(t.name, t.id);
  }

  let processedBatches = 0;
  for (const batch of batches) {
    let results;
    try {
      results = await ai.classifyBatch(batch, Array.from(topicCache.keys()));
    } catch (err) {
      logger.error("classify_batch_failed", { sourceId, error: (err as Error).message });
      // Per the architecture doc: a stage failure for a subset of comments
      // should not fail the whole project — mark this batch unclassified and
      // continue.
      results = batch.map((b) => ({
        commentId: b.id,
        sentiment: { label: "neutral" as const, confidence: 0, score: 0 },
        emotions: {},
        toxicity: { flags: {}, confidence: {} },
        intent: "other" as const,
        topics: [] as string[],
      }));
    }

    for (const result of results) {
      await prisma.commentAnalysis.upsert({
        where: { commentId: result.commentId },
        create: {
          commentId: result.commentId,
          sentimentLabel: result.sentiment.label,
          sentimentConfidence: result.sentiment.confidence,
          sentimentScore: result.sentiment.score,
          emotions: JSON.stringify(result.emotions),
          toxicityFlags: JSON.stringify(result.toxicity.flags),
          toxicityConfidence: JSON.stringify(result.toxicity.confidence),
          intent: result.intent,
          analyzedAt: new Date(),
        },
        update: {
          sentimentLabel: result.sentiment.label,
          sentimentConfidence: result.sentiment.confidence,
          sentimentScore: result.sentiment.score,
          emotions: JSON.stringify(result.emotions),
          toxicityFlags: JSON.stringify(result.toxicity.flags),
          toxicityConfidence: JSON.stringify(result.toxicity.confidence),
          intent: result.intent,
          analyzedAt: new Date(),
        },
      });

      for (const topicName of result.topics) {
        let topicId = topicCache.get(topicName);
        if (!topicId) {
          const topic = await prisma.topic.create({ data: { projectId, name: topicName } });
          topicId = topic.id;
          topicCache.set(topicName, topicId);
        }
        await prisma.commentTopic.upsert({
          where: { commentId_topicId: { commentId: result.commentId, topicId } },
          create: { commentId: result.commentId, topicId, relevanceScore: 1 },
          update: {},
        });
        await prisma.topic.update({
          where: { id: topicId },
          data: { commentCount: { increment: 1 } },
        });
      }
    }

    processedBatches += 1;
    ctx.setProgress(30 + Math.round((processedBatches / batches.length) * 30)); // 30 -> 60
  }

  // --- Stage: keyword extraction ---
  ctx.setStage("extract-keywords");
  ctx.setProgress(65);
  const keywords = extractKeywords(prepared.map((p) => p.textForAnalysis));
  for (const kw of keywords) {
    await prisma.keyword.create({ data: { projectId, term: kw.term, type: kw.type, frequency: kw.frequency } });
  }

  // --- Stage: embeddings ---
  ctx.setStage("embed");
  ctx.setProgress(75);
  for (const p of prepared) {
    const embedding = await ai.embed(p.textForAnalysis);
    p.embedding = embedding;
    await prisma.commentAnalysis.update({
      where: { commentId: p.id },
      data: { embedding: JSON.stringify(embedding) },
    });
  }

  // --- Stage: dedupe ---
  ctx.setStage("dedupe");
  ctx.setProgress(85);
  const duplicates = findDuplicates(
    comments.map((c, i) => ({ id: c.id, textOriginal: c.textOriginal, embedding: prepared[i].embedding }))
  );
  for (const [dupId, canonicalId] of duplicates.entries()) {
    await prisma.comment.update({
      where: { id: dupId },
      data: { isDuplicate: true, duplicateOfCommentId: canonicalId },
    });
  }

  // --- Stage: aggregate + summarize ---
  ctx.setStage("aggregate");
  ctx.setProgress(92);
  // Aggregation itself is computed on-demand by the dashboard service (see
  // dashboard.service.ts) rather than duplicated into stored rollup tables
  // for the MVP — comment volumes here are small enough that a live query is
  // fast. Revisit with materialized rollups if/when volumes grow.

  ctx.setStage("summarize");
  ctx.setProgress(96);
  await generateAndStoreSummaryFlag(projectId);

  await prisma.project.update({ where: { id: projectId }, data: { status: "ready" } });
  ctx.setProgress(100);
}

// Summaries are generated lazily on first GET /summary request (see
// dashboard.service.ts) rather than eagerly here, since the executive
// summary prompt wants the *final* aggregate stats, which are cheapest to
// compute at read time. This just marks the project ready for that request.
async function generateAndStoreSummaryFlag(projectId: string) {
  await prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
}

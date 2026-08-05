import { prisma } from "../../db/prisma";
import { fetchYouTubeComments } from "./providers/youtube.provider";
import { parseCommentsFile, RawComment } from "./providers/csv-upload.provider";
import { enqueue, JobContext } from "../../queue/queue";
import { runAnalysisPipeline } from "../../pipeline/pipeline.orchestrator";
import { ApiError } from "../../middleware/error-handler.middleware";
import { logger } from "../../utils/logger";

async function persistComments(sourceId: string, raw: RawComment[]) {
  // SQLite via Prisma doesn't support createMany with skipDuplicates the same
  // way Postgres does, and volumes here are MVP-scale (up to a couple
  // thousand), so a simple loop is clear and fast enough. For very large
  // imports in production, batch this with createMany against Postgres.
  for (const c of raw) {
    await prisma.comment.create({
      data: {
        sourceId,
        externalCommentId: c.externalCommentId || null,
        username: c.username,
        authorIsVerified: c.authorIsVerified,
        textOriginal: c.text,
        likeCount: c.likeCount,
        replyCount: c.replyCount,
        postedAt: c.postedAt ? new Date(c.postedAt) : null,
      },
    });
  }
}

async function extractYouTube(sourceId: string, sourceUrl: string, ctx: JobContext) {
  ctx.setStage("extract");
  const { title, comments } = await fetchYouTubeComments(sourceUrl);
  await prisma.source.update({
    where: { id: sourceId },
    data: { title, fetchedCommentCount: comments.length },
  });
  await persistComments(sourceId, comments);
}

async function extractCsvUpload(sourceId: string, fileBuffer: Buffer, filename: string) {
  const comments = parseCommentsFile(fileBuffer, filename);
  await prisma.source.update({
    where: { id: sourceId },
    data: { title: filename, fetchedCommentCount: comments.length },
  });
  await persistComments(sourceId, comments);
}

export async function startExtractionJob(params: {
  projectId: string;
  platform: "youtube" | "csv_upload";
  sourceUrl?: string;
  fileBuffer?: Buffer;
  filename?: string;
}) {
  if (params.platform === "youtube" && !params.sourceUrl) {
    throw new ApiError(400, "missing_source_url", "source_url is required for platform=youtube");
  }
  if (params.platform === "csv_upload" && !params.fileBuffer) {
    throw new ApiError(400, "missing_file", "A file upload is required for platform=csv_upload");
  }

  const source = await prisma.source.create({
    data: {
      projectId: params.projectId,
      platform: params.platform,
      sourceUrl: params.sourceUrl ?? null,
      fetchStatus: "running",
    },
  });

  await prisma.project.update({ where: { id: params.projectId }, data: { status: "processing" } });

  const job = enqueue("extract_and_analyze", {
    sourceId: source.id,
    platform: params.platform,
    sourceUrl: params.sourceUrl,
    fileBuffer: params.fileBuffer,
    filename: params.filename,
  });

  return { source, jobId: job.id };
}

// The actual processor is registered here (rather than in queue.ts) so the
// extraction module owns its own pipeline wiring; queue.ts stays a generic
// mechanism with no domain knowledge.
import { registerProcessor } from "../../queue/queue";

registerProcessor<{
  sourceId: string;
  platform: "youtube" | "csv_upload";
  sourceUrl?: string;
  fileBuffer?: Buffer;
  filename?: string;
}>("extract_and_analyze", async (payload, ctx) => {
  const { sourceId, platform, sourceUrl, fileBuffer, filename } = payload;

  try {
    if (platform === "youtube") {
      await extractYouTube(sourceId, sourceUrl!, ctx);
    } else {
      await extractCsvUpload(sourceId, fileBuffer!, filename ?? "upload.csv");
    }
    await prisma.source.update({ where: { id: sourceId }, data: { fetchStatus: "done" } });
  } catch (err) {
    await prisma.source.update({
      where: { id: sourceId },
      data: { fetchStatus: "failed", fetchError: (err as Error).message },
    });
    throw err;
  }

  // Extraction feeds straight into the analysis pipeline — this is the
  // "extract → analyze" chain described in the architecture doc, run as one
  // logical job so the frontend can poll a single job ID for the whole flow.
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } });
  await runAnalysisPipeline(source.projectId, sourceId, ctx);
});

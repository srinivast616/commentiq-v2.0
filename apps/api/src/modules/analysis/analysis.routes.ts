import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { AuthedRequest, requireAuth } from "../../middleware/auth.middleware";
import { ApiError } from "../../middleware/error-handler.middleware";
import { enqueue, registerProcessor } from "../../queue/queue";
import { runAnalysisPipeline } from "../../pipeline/pipeline.orchestrator";

export const analysisRouter = Router();
analysisRouter.use(requireAuth);

const schema = z.object({ source_id: z.string().uuid() });

// POST /analyze — (re-)run the AI pipeline for a source whose comments are
// already extracted. The normal flow chains this automatically after
// /extract; this endpoint exists for explicit re-analysis (e.g. after
// switching AI_PROVIDER, or re-running with an updated prompt).
analysisRouter.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "invalid_body", "source_id is required");

    const source = await prisma.source.findUnique({ where: { id: parsed.data.source_id }, include: { project: true } });
    if (!source || source.project.userId !== req.userId) {
      throw new ApiError(404, "source_not_found", "Source not found");
    }
    if (source.fetchStatus !== "done") {
      throw new ApiError(422, "not_extracted", "Source has not finished extraction yet");
    }

    const job = enqueue("re-analyze", { sourceId: source.id });
    res.status(202).json({ job_id: job.id, status: "queued" });
  } catch (err) {
    next(err);
  }
});

export function registerReanalysisProcessor() {
  registerProcessor<{ sourceId: string }>("re-analyze", async (payload, ctx) => {
    await runAnalysisPipeline(payload.sourceId, ctx);
  });
}

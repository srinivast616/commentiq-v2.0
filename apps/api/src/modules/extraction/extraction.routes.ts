import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { AuthedRequest, requireAuth } from "../../middleware/auth.middleware";
import { startExtractionJob } from "./extraction.service";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/error-handler.middleware";
import { getJob } from "../../queue/queue";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

export const extractionRouter = Router();

const youtubeBodySchema = z.object({
  project_id: z.string().uuid(),
  platform: z.literal("youtube"),
  source_url: z.string().url(),
});

async function assertProjectOwnership(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== userId) {
    throw new ApiError(404, "project_not_found", "Project not found");
  }
  return project;
}

// POST /extract — supports both JSON (YouTube URL) and multipart (CSV/XLSX upload).
extractionRouter.post("/extract", requireAuth, upload.single("file"), async (req: AuthedRequest, res, next) => {
  try {
    if (req.file) {
      const projectId = req.body.project_id;
      if (!projectId) throw new ApiError(400, "missing_project_id", "project_id is required");
      await assertProjectOwnership(projectId, req.userId!);

      const { source, jobId } = await startExtractionJob({
        projectId,
        platform: "csv_upload",
        fileBuffer: req.file.buffer,
        filename: req.file.originalname,
      });
      return res.status(202).json({ source_id: source.id, fetch_status: "running", job_id: jobId });
    }

    const parsed = youtubeBodySchema.parse(req.body);
    await assertProjectOwnership(parsed.project_id, req.userId!);

    const { source, jobId } = await startExtractionJob({
      projectId: parsed.project_id,
      platform: "youtube",
      sourceUrl: parsed.source_url,
    });
    res.status(202).json({ source_id: source.id, fetch_status: "running", job_id: jobId });
  } catch (err) {
    next(err);
  }
});

// GET /jobs/:job_id — poll extraction+analysis pipeline progress.
extractionRouter.get("/jobs/:jobId", requireAuth, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: { code: "job_not_found", message: "Unknown job id" } });
  }
  res.json({
    job_id: job.id,
    stage: job.stage,
    stages_completed: job.stagesCompleted,
    progress_pct: job.progressPct,
    status: job.status,
    error: job.error,
  });
});

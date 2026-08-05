import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { getJob } from "../queue/queue";

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

// GET /jobs/:job_id — polled by the frontend during extraction/analysis to
// drive the progress UI (see API spec).
jobsRouter.get("/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: { code: "job_not_found", message: "No such job" } });
  res.json({
    job_id: job.id,
    stage: job.stage,
    stages_completed: job.stagesCompleted,
    progress_pct: job.progressPct,
    status: job.status,
    error: job.error,
  });
});

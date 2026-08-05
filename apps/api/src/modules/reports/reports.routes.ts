import { Router } from "express";
import { z } from "zod";
import path from "path";
import { requireAuth, AuthedRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/error-handler.middleware";
import { generateReport, getReportFile } from "./reports.service";

export const reportsRouter = Router();

const bodySchema = z.object({
  project_id: z.string().uuid(),
  format: z.enum(["csv", "json", "pdf"]),
});

reportsRouter.post("/export", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const body = bodySchema.parse(req.body);
    const project = await prisma.project.findUnique({ where: { id: body.project_id } });
    if (!project || project.userId !== req.userId) throw new ApiError(404, "project_not_found", "Project not found");

    const report = await generateReport(body.project_id, body.format);
    res.status(202).json({ report_id: report.id, status: "ready" });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/reports/:reportId", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const report = await getReportFile(req.params.reportId);
    res.json({
      report_id: report.id,
      status: "ready",
      download_url: `/api/v1/reports/${report.id}/download`,
    });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/reports/:reportId/download", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const report = await getReportFile(req.params.reportId);
    res.download(path.resolve(report.filePath));
  } catch (err) {
    next(err);
  }
});

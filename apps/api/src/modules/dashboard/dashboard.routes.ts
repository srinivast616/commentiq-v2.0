import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/error-handler.middleware";
import { getDashboard, getSummary } from "./dashboard.service";

export const dashboardRouter = Router();

async function assertOwnership(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== userId) throw new ApiError(404, "project_not_found", "Project not found");
  return project;
}

dashboardRouter.get("/dashboard", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const projectId = String(req.query.project_id ?? "");
    await assertOwnership(projectId, req.userId!);
    res.json(await getDashboard(projectId));
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/summary", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const projectId = String(req.query.project_id ?? "");
    await assertOwnership(projectId, req.userId!);
    const summary = await getSummary(projectId);
    res.json({
      executive_summary: summary.executiveSummary,
      overall_opinion: summary.overallOpinion,
      top_positive_points: summary.topPositivePoints,
      top_negative_points: summary.topNegativePoints,
      suggestions: summary.suggestions,
      common_complaints: summary.commonComplaints,
      appreciated_features: summary.appreciatedFeatures,
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/topics", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const projectId = String(req.query.project_id ?? "");
    await assertOwnership(projectId, req.userId!);
    const topics = await prisma.topic.findMany({
      where: { projectId },
      orderBy: { commentCount: "desc" },
      include: { commentTopics: { include: { comment: true }, take: 3 } },
    });
    res.json(
      topics.map((t) => ({
        id: t.id,
        name: t.name,
        comment_count: t.commentCount,
        sample_comments: t.commentTopics.map((ct) => ct.comment.textOriginal.slice(0, 200)),
      }))
    );
  } catch (err) {
    next(err);
  }
});

import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/error-handler.middleware";
import { queryComments } from "./comments.service";

export const commentsRouter = Router();

commentsRouter.get("/comments", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const projectId = String(req.query.project_id ?? "");
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== req.userId) throw new ApiError(404, "project_not_found", "Project not found");

    const result = await queryComments(projectId, {
      sentiment: req.query.sentiment as string | undefined,
      emotion: req.query.emotion as string | undefined,
      topic: req.query.topic as string | undefined,
      language: req.query.language as string | undefined,
      dateFrom: req.query.date_from as string | undefined,
      dateTo: req.query.date_to as string | undefined,
      minLikes: req.query.min_likes ? Number(req.query.min_likes) : undefined,
      search: req.query.search as string | undefined,
      page: Number(req.query.page ?? 1),
      limit: Math.min(Number(req.query.limit ?? 20), 100),
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

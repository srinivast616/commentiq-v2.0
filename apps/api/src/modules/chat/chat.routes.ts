import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/error-handler.middleware";
import { rateLimit } from "../../middleware/rate-limit.middleware";
import { askQuestion } from "./chat.service";

export const chatRouter = Router();

const bodySchema = z.object({
  project_id: z.string().uuid(),
  session_id: z.string().uuid().nullable().optional(),
  question: z.string().min(1).max(500),
});

// Chat calls an LLM per request, so it gets a tighter rate limit than
// read-only endpoints.
chatRouter.post("/chat", requireAuth, rateLimit(30, 60_000), async (req: AuthedRequest, res, next) => {
  try {
    const body = bodySchema.parse(req.body);
    const project = await prisma.project.findUnique({ where: { id: body.project_id } });
    if (!project || project.userId !== req.userId) throw new ApiError(404, "project_not_found", "Project not found");

    const result = await askQuestion(body.project_id, req.userId!, body.question, body.session_id ?? undefined);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

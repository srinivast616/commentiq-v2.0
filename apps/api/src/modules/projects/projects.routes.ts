import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { AuthedRequest, requireAuth } from "../../middleware/auth.middleware";
import { ApiError } from "../../middleware/error-handler.middleware";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const createSchema = z.object({ name: z.string().min(1), description: z.string().optional() });

// Free-plan project cap — a small, honest stand-in for real plan
// enforcement (see subscriptions/usage_records in the full schema doc,
// deferred past MVP). Prevents unbounded resource use in a shared demo deployment.
const FREE_PLAN_PROJECT_LIMIT = 5;

projectsRouter.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "invalid_body", "name is required");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    if (user.plan === "free") {
      const count = await prisma.project.count({ where: { userId: req.userId } });
      if (count >= FREE_PLAN_PROJECT_LIMIT) {
        throw new ApiError(403, "plan_limit_reached", `Free plan is limited to ${FREE_PLAN_PROJECT_LIMIT} projects`);
      }
    }

    const project = await prisma.project.create({
      data: { userId: req.userId!, name: parsed.data.name, description: parsed.data.description },
    });
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));

    const [total, projects] = await Promise.all([
      prisma.project.count({ where: { userId: req.userId } }),
      prisma.project.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { sources: true },
      }),
    ]);

    res.json({ data: projects, page, total });
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { sources: true },
    });
    if (!project || project.userId !== req.userId) {
      throw new ApiError(404, "project_not_found", "Project not found");
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

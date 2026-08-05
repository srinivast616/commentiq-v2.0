import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { errorHandler, notFound } from "./middleware/error-handler.middleware";

import { authRouter } from "./modules/auth/auth.routes";
import { projectsRouter } from "./modules/projects/projects.routes";
import { extractionRouter } from "./modules/extraction/extraction.routes";
import { registerExtractionProcessor } from "./modules/extraction/extraction.service";
import { analysisRouter, registerReanalysisProcessor } from "./modules/analysis/analysis.routes";
import { jobsRouter } from "./modules/jobs.routes";
import { dashboardRouter, summaryRouter, topicsRouter } from "./modules/dashboard/dashboard.routes";
import { commentsRouter } from "./modules/comments/comments.routes";
import { chatRouter } from "./modules/chat/chat.routes";
import { reportsRouter } from "./modules/reports/reports.routes";

// Register BullMQ-style job processors before the server starts accepting
// traffic, so /extract and /analyze can enqueue work immediately.
registerExtractionProcessor();
registerReanalysisProcessor();

const app = express();
app.use(cors({ origin: env.webOrigin }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok", aiProvider: env.aiProvider }));

const v1 = express.Router();
v1.use("/auth", authRouter);
v1.use("/projects", projectsRouter);
v1.use("/extract", extractionRouter);
v1.use("/analyze", analysisRouter);
v1.use("/jobs", jobsRouter);
v1.use("/dashboard", dashboardRouter);
v1.use("/summary", summaryRouter);
v1.use("/topics", topicsRouter);
v1.use("/comments", commentsRouter);
v1.use("/chat", chatRouter);
v1.use("/export", reportsRouter);
v1.use("/reports", reportsRouter);

app.use("/api/v1", v1);
app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  logger.info("server_started", { port: env.port, aiProvider: env.aiProvider });
});

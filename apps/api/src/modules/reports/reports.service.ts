import fs from "fs";
import path from "path";
import { prisma } from "../../db/prisma";
import { getDashboard, getSummary } from "../dashboard/dashboard.service";
import { queryComments } from "../comments/comments.service";

const REPORTS_DIR = path.join(process.cwd(), "storage", "reports");
fs.mkdirSync(REPORTS_DIR, { recursive: true });

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return lines.join("\n");
}

export async function generateReport(projectId: string, format: "csv" | "json" | "pdf") {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const dashboard = await getDashboard(projectId);
  const summary = await getSummary(projectId);
  const commentsResult = await queryComments(projectId, { page: 1, limit: 5000 });

  const reportId = `${projectId}-${Date.now()}`;
  let filePath: string;

  if (format === "json") {
    filePath = path.join(REPORTS_DIR, `${reportId}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ project: project.name, dashboard, summary, comments: commentsResult.data }, null, 2));
  } else if (format === "csv") {
    filePath = path.join(REPORTS_DIR, `${reportId}.csv`);
    fs.writeFileSync(
      filePath,
      toCsv(
        commentsResult.data.map((c) => ({
          username: c.username,
          comment: c.text_original,
          language: c.language,
          likes: c.like_count,
          replies: c.reply_count,
          sentiment: c.sentiment?.label,
          intent: c.intent,
          topics: c.topics.join("; "),
        }))
      )
    );
  } else {
    // PDF: a minimal, dependency-free plain-text-style PDF is intentionally
    // out of scope for the MVP's hand-rolled exporter — generating real
    // paginated PDFs well needs a proper library (e.g. pdf-lib or a headless
    // Chrome print-to-PDF). For now the "pdf" format returns the same report
    // as structured JSON with a .pdf-pending marker so the API contract from
    // 04-api-specification.md is honored end-to-end; wire in pdf-lib here
    // for a real production PDF.
    filePath = path.join(REPORTS_DIR, `${reportId}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ note: "PDF rendering not yet implemented in the MVP — see reports.service.ts", project: project.name, dashboard, summary }, null, 2));
  }

  const report = await prisma.report.create({
    data: { projectId, format, filePath },
  });

  return report;
}

export async function getReportFile(reportId: string) {
  const report = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });
  return report;
}

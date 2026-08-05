"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SentimentDonut, TopicBarChart, LanguageBarChart, EmotionBarChart } from "@/components/charts/Charts";

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    load();
  }, [projectId]);

  async function load() {
    try {
      const p = await api.getProject(projectId);
      setProject(p);
      if (p.status === "ready") {
        const [d, s] = await Promise.all([api.getDashboard(projectId), api.getSummary(projectId)]);
        setDashboard(d);
        setSummary(s);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleExport(format: "csv" | "json" | "pdf") {
    setExporting(format);
    try {
      const { report_id } = await api.exportReport(projectId, format);
      // Poll until the report file is ready, then trigger a download.
      const check = async () => {
        const report = await api.getReport(report_id);
        if (report.status === "ready") {
          window.open(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}${report.download_url}`, "_blank");
          setExporting(null);
        } else {
          setTimeout(check, 1000);
        }
      };
      check();
    } catch (err) {
      setError((err as Error).message);
      setExporting(null);
    }
  }

  if (error) {
    return (
      <DashboardShell>
        <p className="text-signal-negative">{error}</p>
      </DashboardShell>
    );
  }

  if (!project) {
    return (
      <DashboardShell>
        <p className="text-graphite-400">Loading...</p>
      </DashboardShell>
    );
  }

  if (project.status !== "ready") {
    return (
      <DashboardShell>
        <div className="card p-10 text-center">
          <p className="text-graphite-200 font-medium">Analysis is {project.status}...</p>
          <p className="text-sm text-graphite-400 mt-1">This page will refresh automatically once it's ready.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-graphite-200">{project.name}</h1>
          <p className="text-sm text-graphite-400 mt-1">{dashboard?.total_comments ?? 0} comments analyzed</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/dashboard/${projectId}/comments`} className="rounded-lg border border-graphite-600 px-4 py-2 text-sm font-medium text-graphite-200 hover:bg-graphite-800">
            Comment Explorer
          </Link>
          <Link href={`/dashboard/${projectId}/chat`} className="rounded-lg border border-graphite-600 px-4 py-2 text-sm font-medium text-graphite-200 hover:bg-graphite-800">
            Chat with Comments
          </Link>
        </div>
      </div>

      {summary && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-graphite-200 mb-2">Executive Summary</h2>
          <p className="text-sm text-graphite-400">{summary.executiveSummary}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
            <SummaryList title="Top positive points" items={summary.topPositivePoints} accent="positive" />
            <SummaryList title="Top negative points" items={summary.topNegativePoints} accent="negative" />
            <SummaryList title="Suggestions from audience" items={summary.suggestions} accent="neutral" />
            <SummaryList title="Common complaints" items={summary.commonComplaints} accent="negative" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-graphite-200 mb-2">Sentiment</h3>
          <SentimentDonut distribution={dashboard.sentiment_distribution} />
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-graphite-200 mb-2">Emotions</h3>
          <EmotionBarChart emotions={dashboard.emotion_distribution} />
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-graphite-200 mb-2">Languages</h3>
          <LanguageBarChart languages={dashboard.language_distribution} />
        </div>
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-graphite-200 mb-2">Top Topics</h3>
          <TopicBarChart topics={dashboard.topic_distribution} />
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-graphite-200 mb-3">Export</h3>
          <div className="space-y-2">
            {(["csv", "json", "pdf"] as const).map((format) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                disabled={exporting === format}
                className="w-full rounded-lg border border-graphite-600 py-2 text-sm font-medium text-graphite-200 hover:bg-graphite-800 disabled:opacity-50"
              >
                {exporting === format ? "Preparing..." : `Download ${format.toUpperCase()}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function SummaryList({ title, items, accent }: { title: string; items: string[]; accent: "positive" | "negative" | "neutral" }) {
  const color = accent === "positive" ? "text-signal-positive" : accent === "negative" ? "text-signal-negative" : "text-signal-neutral";
  return (
    <div>
      <h4 className={`text-xs font-mono uppercase tracking-wide ${color}`}>{title}</h4>
      <ul className="mt-2 space-y-1">
        {items?.map((item, i) => (
          <li key={i} className="text-sm text-graphite-400">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

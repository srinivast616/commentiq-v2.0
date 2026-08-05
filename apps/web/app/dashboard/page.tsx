"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const result = await api.listProjects();
      setProjects(result.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-graphite-200">Projects</h1>
          <p className="text-sm text-graphite-400 mt-1">Each project holds one analyzed source.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-signal-positive px-4 py-2 font-medium text-graphite-950 hover:opacity-90 transition"
        >
          + New project
        </button>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={refresh} />}

      {loading ? (
        <p className="text-graphite-400">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-graphite-400">No projects yet. Create one to analyze your first YouTube video or CSV export.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/dashboard/${p.id}`)}
              className="card p-5 text-left hover:border-graphite-600 transition"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-graphite-200">{p.name}</h3>
                <StatusBadge status={p.status} />
              </div>
              {p.description && <p className="mt-1 text-sm text-graphite-400">{p.description}</p>}
              <p className="mt-3 text-xs text-graphite-400 font-mono">
                {p.sources?.length ?? 0} source{p.sources?.length === 1 ? "" : "s"}
              </p>
            </button>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: "bg-signal-positive/20 text-signal-positive",
    processing: "bg-signal-neutral/20 text-signal-neutral",
    pending: "bg-graphite-600/40 text-graphite-400",
    failed: "bg-signal-negative/20 text-signal-negative",
  };
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded ${colors[status] ?? colors.pending}`}>{status}</span>
  );
}

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"name" | "ingest">("name");
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [source, setSource] = useState<"youtube" | "csv">("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobStatus, setJobStatus] = useState<any>(null);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const project = await api.createProject(name);
      setProjectId(project.id);
      setStep("ingest");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setError(null);
    setBusy(true);
    try {
      const result =
        source === "youtube" ? await api.extractYoutube(projectId, youtubeUrl) : file ? await api.extractUpload(projectId, file) : null;
      if (!result) throw new Error("Please choose a file to upload");
      pollJob(result.job_id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function pollJob(jobId: string) {
    const interval = setInterval(async () => {
      const job = await api.getJob(jobId);
      setJobStatus(job);
      if (job.status === "completed") {
        clearInterval(interval);
        router.push(`/dashboard/${projectId}`);
      } else if (job.status === "failed") {
        clearInterval(interval);
        setError(job.error ?? "Analysis failed");
        setBusy(false);
      }
    }, 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-graphite-200">
            {step === "name" ? "New project" : "Add a comment source"}
          </h2>
          <button onClick={onClose} className="text-graphite-400 hover:text-graphite-200">
            ✕
          </button>
        </div>

        {step === "name" ? (
          <form onSubmit={handleCreateProject} className="space-y-4">
            <input
              className="w-full bg-graphite-800 border border-graphite-600 rounded-lg px-3 py-2 text-graphite-200"
              placeholder="Project name (e.g. Q3 Launch Video)"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <p className="text-sm text-signal-negative">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-signal-positive py-2.5 font-medium text-graphite-950 hover:opacity-90 disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        ) : jobStatus ? (
          <div>
            <p className="text-sm text-graphite-400 mb-2">
              Stage: <span className="font-mono text-graphite-200">{jobStatus.stage ?? "starting"}</span>
            </p>
            <div className="h-2 rounded-full bg-graphite-700 overflow-hidden">
              <div
                className="h-full bg-signal-positive transition-all"
                style={{ width: `${jobStatus.progress_pct ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-graphite-400 font-mono">{jobStatus.progress_pct ?? 0}%</p>
            {error && <p className="mt-3 text-sm text-signal-negative">{error}</p>}
          </div>
        ) : (
          <form onSubmit={handleIngest} className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSource("youtube")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                  source === "youtube" ? "bg-signal-positive text-graphite-950" : "bg-graphite-800 text-graphite-400"
                }`}
              >
                YouTube URL
              </button>
              <button
                type="button"
                onClick={() => setSource("csv")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                  source === "csv" ? "bg-signal-positive text-graphite-950" : "bg-graphite-800 text-graphite-400"
                }`}
              >
                CSV / Excel upload
              </button>
            </div>

            {source === "youtube" ? (
              <input
                className="w-full bg-graphite-800 border border-graphite-600 rounded-lg px-3 py-2 text-graphite-200"
                placeholder="https://youtube.com/watch?v=..."
                required
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
              />
            ) : (
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-graphite-400"
              />
            )}

            {error && <p className="text-sm text-signal-negative">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-signal-positive py-2.5 font-medium text-graphite-950 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Starting analysis..." : "Start analysis"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

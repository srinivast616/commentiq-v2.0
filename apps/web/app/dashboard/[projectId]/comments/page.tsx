"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import { DashboardShell } from "@/components/layout/DashboardShell";

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "text-signal-positive",
  neutral: "text-signal-neutral",
  negative: "text-signal-negative",
};

export default function CommentExplorerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [comments, setComments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [language, setLanguage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    load();
  }, [projectId, page, sentiment, language]);

  async function load() {
    setLoading(true);
    try {
      const query: Record<string, string> = { page: String(page), limit: "20" };
      if (search) query.search = search;
      if (sentiment) query.sentiment = sentiment;
      if (language) query.language = language;
      const result = await api.getComments(projectId, query);
      setComments(result.data);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <DashboardShell>
      <h1 className="text-2xl font-semibold text-graphite-200 mb-6">Comment Explorer</h1>

      <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search comments..."
          className="flex-1 min-w-[200px] bg-graphite-800 border border-graphite-600 rounded-lg px-3 py-2 text-graphite-200 text-sm"
        />
        <select
          value={sentiment}
          onChange={(e) => {
            setSentiment(e.target.value);
            setPage(1);
          }}
          className="bg-graphite-800 border border-graphite-600 rounded-lg px-3 py-2 text-graphite-200 text-sm"
        >
          <option value="">All sentiment</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
        <input
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setPage(1);
          }}
          placeholder="Language code (e.g. en)"
          className="w-40 bg-graphite-800 border border-graphite-600 rounded-lg px-3 py-2 text-graphite-200 text-sm"
        />
        <button type="submit" className="rounded-lg bg-signal-positive px-4 py-2 text-sm font-medium text-graphite-950">
          Search
        </button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-graphite-700 text-left text-graphite-400">
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Comment</th>
              <th className="p-3 font-medium">Sentiment</th>
              <th className="p-3 font-medium">Topics</th>
              <th className="p-3 font-medium">Likes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-graphite-400">
                  Loading...
                </td>
              </tr>
            ) : comments.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-graphite-400">
                  No comments match these filters.
                </td>
              </tr>
            ) : (
              comments.map((c) => (
                <tr key={c.id} className="border-b border-graphite-800">
                  <td className="p-3 text-graphite-200 whitespace-nowrap">{c.username}</td>
                  <td className="p-3 text-graphite-400 max-w-md">{c.text_translated ?? c.text_original}</td>
                  <td className={`p-3 font-mono text-xs ${SENTIMENT_COLOR[c.sentiment?.label] ?? ""}`}>
                    {c.sentiment?.label ?? "—"}
                  </td>
                  <td className="p-3 text-graphite-400 text-xs">{c.topics?.join(", ")}</td>
                  <td className="p-3 text-graphite-400 font-mono">{c.like_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-graphite-400">
        <span>
          Page {page} · {total} total comments
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-graphite-600 px-3 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-graphite-600 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import { DashboardShell } from "@/components/layout/DashboardShell";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What do people dislike most?",
  "What feature is requested most?",
  "What percentage of comments are positive?",
  "What do people love about this?",
];

export default function ChatPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendQuestion(question: string) {
    if (!question.trim()) return;
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const result = await api.chat(projectId, question, sessionId);
      setSessionId(result.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell>
      <h1 className="text-2xl font-semibold text-graphite-200 mb-2">Chat with Comments</h1>
      <p className="text-sm text-graphite-400 mb-6">
        Ask a question — the answer is grounded in the actual comments for this project via semantic retrieval.
      </p>

      <div className="card flex flex-col h-[520px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendQuestion(q)}
                  className="rounded-full border border-graphite-600 px-3 py-1.5 text-xs text-graphite-400 hover:border-signal-positive hover:text-signal-positive transition"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-signal-positive text-graphite-950" : "bg-graphite-800 text-graphite-200"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg px-4 py-2.5 text-sm bg-graphite-800 text-graphite-400">Thinking...</div>
            </div>
          )}
        </div>

        {error && <p className="px-6 text-sm text-signal-negative">{error}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="border-t border-graphite-700 p-4 flex gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about this project's comments..."
            className="flex-1 bg-graphite-800 border border-graphite-600 rounded-lg px-3 py-2 text-graphite-200 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-signal-positive px-5 py-2 text-sm font-medium text-graphite-950 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}

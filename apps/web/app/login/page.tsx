"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@commentiq.dev");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = mode === "login" ? await api.login(email, password) : await api.register(email, password, name);
      setToken(result.token);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-graphite-900 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="signal-ribbon w-16 mb-6" />
        <h1 className="text-2xl font-semibold text-graphite-200">
          {mode === "login" ? "Sign in to CommentIQ" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-graphite-400">
          {mode === "login" ? "Demo credentials are pre-filled." : "Takes about 15 seconds."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {mode === "register" && (
            <Field label="Name">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </Field>
          )}
          <Field label="Email">
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && <p className="text-sm text-signal-negative">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-signal-positive py-2.5 font-medium text-graphite-950 hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 text-sm text-graphite-400 hover:text-graphite-200"
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          background-color: #1b1f26;
          border: 1px solid #333a45;
          border-radius: 8px;
          padding: 0.6rem 0.8rem;
          color: #e7eaee;
        }
        .input:focus {
          outline: none;
          border-color: #3ed6b5;
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-graphite-400 uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

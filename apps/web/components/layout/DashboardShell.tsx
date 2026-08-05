"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/api";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-graphite-900">
      <header className="border-b border-graphite-700">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="signal-ribbon w-8" />
            <span className="font-semibold text-graphite-200">CommentIQ</span>
          </Link>
          <button onClick={handleLogout} className="text-sm text-graphite-400 hover:text-graphite-200">
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}

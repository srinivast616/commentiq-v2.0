// Thin fetch wrapper around the CommentIQ API. Centralizes the base URL,
// auth header injection, and error unwrapping so pages/components never
// touch `fetch` directly.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("commentiq_token");
}

export function setToken(token: string) {
  window.localStorage.setItem("commentiq_token", token);
}

export function clearToken() {
  window.localStorage.removeItem("commentiq_token");
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  isFormData?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!options.isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.isFormData ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = json?.error?.message ?? `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return json as T;
}

export const api = {
  register: (email: string, password: string, name?: string) =>
    apiRequest<{ token: string; user: any }>("/auth/register", { method: "POST", body: { email, password, name } }),
  login: (email: string, password: string) =>
    apiRequest<{ token: string; user: any }>("/auth/login", { method: "POST", body: { email, password } }),

  listProjects: () => apiRequest<{ data: any[]; total: number }>("/projects"),
  createProject: (name: string, description?: string) =>
    apiRequest<any>("/projects", { method: "POST", body: { name, description } }),
  getProject: (id: string) => apiRequest<any>(`/projects/${id}`),

  extractYoutube: (projectId: string, sourceUrl: string) =>
    apiRequest<{ source_id: string; job_id: string }>("/extract", {
      method: "POST",
      body: { project_id: projectId, platform: "youtube", source_url: sourceUrl },
    }),
  extractUpload: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("project_id", projectId);
    form.append("platform", "csv_upload");
    form.append("file", file);
    return apiRequest<{ source_id: string; job_id: string }>("/extract", {
      method: "POST",
      body: form,
      isFormData: true,
    });
  },
  getJob: (jobId: string) => apiRequest<any>(`/jobs/${jobId}`),

  getDashboard: (projectId: string) => apiRequest<any>(`/dashboard?project_id=${projectId}`),
  getSummary: (projectId: string) => apiRequest<any>(`/summary?project_id=${projectId}`),
  getTopics: (projectId: string) => apiRequest<any[]>(`/topics?project_id=${projectId}`),
  getComments: (projectId: string, query: Record<string, string> = {}) => {
    const params = new URLSearchParams({ project_id: projectId, ...query });
    return apiRequest<{ data: any[]; total: number; page: number }>(`/comments?${params.toString()}`);
  },

  chat: (projectId: string, question: string, sessionId?: string | null) =>
    apiRequest<{ session_id: string; answer: string; cited_comment_ids: string[] }>("/chat", {
      method: "POST",
      body: { project_id: projectId, question, session_id: sessionId ?? null },
    }),

  exportReport: (projectId: string, format: "csv" | "json" | "pdf") =>
    apiRequest<{ report_id: string; status: string }>("/export", { method: "POST", body: { project_id: projectId, format } }),
  getReport: (reportId: string) => apiRequest<any>(`/reports/${reportId}`),
};

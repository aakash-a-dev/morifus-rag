const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface DocumentDto {
  id: string;
  filename: string;
  mimeType: string;
  status: "processing" | "ready" | "error";
  errorReason?: string | null;
  uploadedAt: string;
  metadata: Record<string, unknown>;
  _count?: { chunks: number };
}

export interface Citation {
  chunkId: string;
  documentId: string;
  filename: string;
  page: number | null;
  section: string | null;
  similarity: number;
  excerpt: string;
}

export interface ContradictionFinding {
  id: string;
  chunkAId: string;
  chunkBId: string;
  statementA: string;
  statementB: string;
  sourceA: { filename: string; page: number | null; section: string | null };
  sourceB: { filename: string; page: number | null; section: string | null };
  type: "factual" | "logical" | "temporal" | "numerical";
  severity: "critical" | "warning" | "info";
  reasoning: string;
  isNew: boolean;
}

export interface ChatResponse {
  conversationId: string;
  answer: string;
  citations: Citation[];
  confidence: number;
  lowContext: boolean;
  fromCache: boolean;
  contradictions: ContradictionFinding[];
  trace: { retrievedChunks: { chunkId: string; filename: string; similarity: number; rerankScore: number }[] };
}

export const api = {
  listDocuments: () => request<DocumentDto[]>("/api/documents"),
  deleteDocument: (id: string) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),
  loadDemoData: () => request<{ documents: DocumentDto[] }>("/api/dev/load-demo-data", { method: "POST" }),
  uploadFiles: async (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const res = await fetch(`${API_URL}/api/documents/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
  ask: (query: string, conversationId?: string, documentIds: string[] = []) =>
    request<ChatResponse>("/api/chat/ask", {
      method: "POST",
      body: JSON.stringify({ query, conversationId, documentIds }),
    }),
  listContradictions: (status?: string) =>
    request<any[]>(`/api/contradictions${status ? `?status=${status}` : ""}`),
  updateContradictionStatus: (id: string, status: "resolved" | "false_positive" | "open") =>
    request(`/api/contradictions/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  metrics: () => request<any>("/api/dev/metrics"),
};

export function progressStreamUrl() {
  return `${API_URL}/api/progress/stream`;
}

import { request } from "@/services/api";
import type { GenerateOutputResponse, UploadDocumentResponse } from "@/types/output";
import type { RequirementAnalysis } from "@/types/requirement";

export interface SaveRequirementPayload {
  raw_input: string;
  extra_context: Record<string, unknown>;
}

export interface SaveRequirementResponse {
  project_id: string;
  requirement_id: string;
  raw_input: string;
  extra_context: Record<string, unknown>;
  status: string;
}

export async function saveRequirement(projectId: string, payload: SaveRequirementPayload): Promise<SaveRequirementResponse> {
  return request<SaveRequirementResponse>(`/api/projects/${projectId}/requirements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function analyzeRequirement(projectId: string, requirementId: string): Promise<RequirementAnalysis> {
  return request<RequirementAnalysis>(`/api/projects/${projectId}/analyze`, {
    method: "POST",
    body: JSON.stringify({ requirement_id: requirementId }),
  });
}

export async function generateOutput(projectId: string, requirementId: string, target: string): Promise<GenerateOutputResponse> {
  return request<GenerateOutputResponse>(`/api/projects/${projectId}/generate`, {
    method: "POST",
    body: JSON.stringify({ target, requirement_id: requirementId, regenerate: false }),
  });
}

export async function uploadDocument(projectId: string, file: File): Promise<UploadDocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/documents`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Upload failed: ${response.status}`);
  }

  return response.json() as Promise<UploadDocumentResponse>;
}

export async function listDocuments(projectId: string): Promise<UploadDocumentResponse[]> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/documents`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `List documents failed: ${response.status}`);
  }

  return response.json() as Promise<UploadDocumentResponse[]>;
}

export async function getDocument(projectId: string, documentId: string): Promise<UploadDocumentResponse & { extracted_text?: string }> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/documents/${documentId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Get document failed: ${response.status}`);
  }

  return response.json() as Promise<UploadDocumentResponse & { extracted_text?: string }>;
}

export async function deleteDocument(projectId: string, documentId: string): Promise<{ status: string; document_id: string }> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/documents/${documentId}`, {
    method: "DELETE",
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Delete failed: ${response.status}`);
  }

  return response.json() as Promise<{ status: string; document_id: string }>;
}

export async function followup(projectId: string, target: string, instruction: string): Promise<GenerateOutputResponse> {
  return request<GenerateOutputResponse>(`/api/projects/${projectId}/followup`, {
    method: "POST",
    body: JSON.stringify({ target, instruction }),
  });
}

export async function exportOutput(projectId: string, format: string, targets: string[]): Promise<void> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format, targets }),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Export failed: ${response.status}`);
  }

  const result = await response.json();

  if (format === "xlsx" || format === "excel") {
    // Hex-encoded Excel data — convert and download
    const hex = result.data;
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((b: string) => parseInt(b, 16)) || []);
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linghang-${projectId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } else if (format === "json") {
    const dataStr = JSON.stringify(result.data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linghang-${projectId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } else if (format === "markdown" || format === "md") {
    const blob = new Blob([result.data as string], { type: "text/markdown" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linghang-${projectId}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// Streaming generation (SSE over fetch) — exposes model reasoning & progress
// ---------------------------------------------------------------------------

export interface StreamHandlers {
  onStatus?: (data: { target?: string; stage: string; message?: string; targets?: string[] }) => void;
  onReasoning?: (delta: string, target: string) => void;
  onModuleDone?: (target: string, content: unknown) => void;
  onDone?: (result: GenerateOutputResponse & { elapsed_ms?: number }) => void;
  onError?: (message: string) => void;
}

interface SseFrame {
  event: string;
  data: Record<string, unknown>;
}

/** Parse an SSE byte stream into event/data frames. */
async function* readSse(resp: Response): AsyncGenerator<SseFrame> {
  const reader = resp.body?.getReader();
  if (!reader) throw new Error("浏览器不支持流式读取");
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const frame: SseFrame = { event: "message", data: {} };
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) frame.event = line.slice(6).trim();
        else if (line.startsWith("data:")) {
          try {
            frame.data = JSON.parse(line.slice(5).trim());
          } catch {
            /* keep raw */
          }
        }
      }
      yield frame;
    }
  }
}

/** Stream a generation task (target: single target or "all"). */
export async function streamGenerate(
  projectId: string,
  requirementId: string,
  target: string,
  handlers: StreamHandlers,
): Promise<void> {
  const API_BASE_URL_LOCAL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const resp = await fetch(`${API_BASE_URL_LOCAL}/api/projects/${projectId}/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, requirement_id: requirementId, regenerate: false }),
  });
  if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);

  for await (const frame of readSse(resp)) {
    const d = frame.data as Record<string, string & string[]>;
    if (frame.event === "status") handlers.onStatus?.(d as never);
    else if (frame.event === "reasoning") handlers.onReasoning?.(d.delta as string, d.target as string);
    else if (frame.event === "module_done") handlers.onModuleDone?.(d.target as string, d.content);
    else if (frame.event === "done") handlers.onDone?.(d as never);
    else if (frame.event === "error") handlers.onError?.(String(d.message));
  }
}

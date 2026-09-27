import { API_BASE_URL, downloadBlob, errorMessage, request } from "@/services/api";
import type { DocumentRow, GenerateOutputResponse, UploadDocumentResponse } from "@/types/output";

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

export async function uploadDocument(projectId: string, file: File): Promise<UploadDocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return request<UploadDocumentResponse>(`/api/projects/${projectId}/documents`, {
    method: "POST",
    body: formData,
  });
}

/** 后端列表返回的是数据库行（id），统一映射成前端的 document_id */
export async function listDocuments(projectId: string): Promise<DocumentRow[]> {
  const rows = await request<Array<DocumentRow & { id?: string }>>(`/api/projects/${projectId}/documents`);
  return rows.map((row) => ({ ...row, document_id: row.document_id ?? row.id ?? "" }));
}

export async function deleteDocument(projectId: string, documentId: string): Promise<{ status: string; document_id: string }> {
  return request(`/api/projects/${projectId}/documents/${documentId}`, { method: "DELETE" });
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

export async function exportOutput(projectId: string, format: string, targets: string[]): Promise<void> {
  const result = await request<{ data: unknown }>(`/api/projects/${projectId}/export`, {
    method: "POST",
    body: JSON.stringify({ format, targets }),
  });
  const base = `linghang-${projectId}`;

  if (format === "xlsx") {
    const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    downloadBlob(new Blob([hexToBytes(result.data as string)], { type }), `${base}.xlsx`);
  } else if (format === "json") {
    downloadBlob(new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" }), `${base}.json`);
  } else {
    downloadBlob(new Blob([result.data as string], { type: "text/markdown" }), `${base}.md`);
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

/** Stream a generation task (target: single target or "all"). Abort via `signal`. */
export async function streamGenerate(
  projectId: string,
  requirementId: string,
  target: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const resp = await fetch(`${API_BASE_URL}/api/projects/${projectId}/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, requirement_id: requirementId, regenerate: false }),
    signal,
  });
  if (!resp.ok) throw new Error(await errorMessage(resp, "Request failed"));

  for await (const frame of readSse(resp)) {
    const d = frame.data as Record<string, string & string[]>;
    if (frame.event === "status") handlers.onStatus?.(d as never);
    else if (frame.event === "reasoning") handlers.onReasoning?.(d.delta as string, d.target as string);
    else if (frame.event === "module_done") handlers.onModuleDone?.(d.target as string, d.content);
    else if (frame.event === "done") handlers.onDone?.(d as never);
    else if (frame.event === "error") handlers.onError?.(String(d.message));
  }
}


// ---------------------------------------------------------------------------
// Follow-up (revision log): AI answers / proposes, user applies or discards
// ---------------------------------------------------------------------------

export type FollowupStatus = "thinking" | "answered" | "proposed" | "applied" | "discarded" | "error";

export interface FollowupRecord {
  id: string;
  target: string;
  instruction: string;
  status: FollowupStatus;
  reply: string;
  changes: string[];
  /** 修改后的完整模块内容；纯提问时为 null */
  revised: Record<string, unknown> | null;
  detail: string;
  created_at: string | null;
  /** 仅前端：流式思考过程 */
  reasoning?: string;
}

export async function streamFollowup(
  projectId: string,
  target: string,
  instruction: string,
  handlers: {
    onRecord?: (record: FollowupRecord) => void;
    onReasoning?: (delta: string) => void;
    onError?: (message: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const resp = await fetch(`${API_BASE_URL}/api/projects/${projectId}/followup/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, instruction }),
    signal,
  });
  if (!resp.ok) throw new Error(await errorMessage(resp, "Request failed"));

  for await (const frame of readSse(resp)) {
    const d = frame.data as Record<string, unknown>;
    if (frame.event === "record") handlers.onRecord?.(d as unknown as FollowupRecord);
    else if (frame.event === "reasoning") handlers.onReasoning?.(String(d.delta ?? ""));
    else if (frame.event === "error") handlers.onError?.(String(d.message));
  }
}

export async function applyFollowup(projectId: string, followupId: string): Promise<{ record: FollowupRecord; content: unknown }> {
  return request(`/api/projects/${projectId}/followups/${followupId}/apply`, { method: "POST" });
}

export async function discardFollowup(projectId: string, followupId: string): Promise<{ record: FollowupRecord }> {
  return request(`/api/projects/${projectId}/followups/${followupId}/discard`, { method: "POST" });
}

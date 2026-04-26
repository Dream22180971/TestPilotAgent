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
    a.download = `testpilot-${projectId}.xlsx`;
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
    a.download = `testpilot-${projectId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } else if (format === "markdown" || format === "md") {
    const blob = new Blob([result.data as string], { type: "text/markdown" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `testpilot-${projectId}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }
}

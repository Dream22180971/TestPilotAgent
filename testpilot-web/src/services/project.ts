import { request } from "@/services/api";
import type { Project } from "@/types/project";
import type { FollowupRecord } from "@/services/generation";

export interface CreateProjectPayload {
  name: string;
  system_type: string;
  test_types: string[];
  script_language: string;
  output_language: string;
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  return request<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listProjects(): Promise<{ items: Project[] }> {
  return request<{ items: Project[] }>("/api/projects");
}

/** 获取单个项目；不存在时抛错（用于失效检测） */
export async function getProject(projectId: string): Promise<Project> {
  return request<Project>(`/api/projects/${projectId}`);
}

export interface ProjectSnapshot {
  requirement: {
    id: string;
    raw_input: string;
    extra_context: { business_flow?: string; roles?: string[]; non_functional?: string[] } | null;
  } | null;
  outputs: Record<string, unknown>;
  followups: FollowupRecord[];
}

/** 最近一次需求 + 已保存的全部生成结果，用于从历史恢复项目 */
export async function getProjectSnapshot(projectId: string): Promise<ProjectSnapshot> {
  return request<ProjectSnapshot>(`/api/projects/${projectId}/snapshot`);
}

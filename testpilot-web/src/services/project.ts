import { request } from "@/services/api";
import type { Project } from "@/types/project";

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

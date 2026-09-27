import { request } from "@/services/api";

export interface LlmSettings {
  configured: boolean;
  api_key_masked: string;
  model: string;
  base_url: string;
  default_model: string;
  env_file: string;
  env_has_key: boolean;
}

export async function getLlmSettings(): Promise<LlmSettings> {
  return request<LlmSettings>("/api/settings");
}

export interface UpdateLlmSettingsPayload {
  api_key?: string;
  model?: string;
  base_url?: string;
}

export async function updateLlmSettings(payload: UpdateLlmSettingsPayload): Promise<LlmSettings> {
  return request<LlmSettings>("/api/settings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

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

export interface TestConnectionResult {
  ok: boolean;
  models_ok?: boolean;
  chat_ok?: boolean;
  models?: string[];
  latency_ms?: number;
  error?: string;
  models_error?: string;
  chat_error?: string;
  model?: string;
}

/** 测试连接（用填写的值或当前配置，不保存） */
export async function testLlmConnection(payload: UpdateLlmSettingsPayload): Promise<TestConnectionResult> {
  return request<TestConnectionResult>("/api/settings/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** 从服务拉取可用模型列表（不保存） */
export async function fetchLlmModels(payload: UpdateLlmSettingsPayload): Promise<{ ok: boolean; models: string[]; error?: string }> {
  return request<{ ok: boolean; models: string[]; error?: string }>("/api/settings/models", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

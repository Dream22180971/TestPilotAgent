"use client";

import { Alert, AutoComplete, Input, Modal, Space, Tag, Typography } from "antd";
import { ApiOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";

import {
  getLlmSettings,
  updateLlmSettings,
  type LlmSettings,
} from "@/services/settings";

const { Text } = Typography;

const MODEL_SUGGESTIONS = [
  "qwen3-vl-flash-2026-01-22",
  "qwen-plus",
  "qwen-turbo",
  "qwen-max",
  "deepseek-v3",
].map((v) => ({ value: v }));

/**
 * 模型配置弹窗：配置 DashScope/OpenAI 兼容 API。
 * 保存后立即生效（后端热切换），并持久化到 testpilot-api/.env。
 */
export default function ModelSettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<LlmSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const s = await getLlmSettings();
      setSettings(s);
      setModel(s.model);
      setBaseUrl(s.base_url);
    } catch {
      setSettings(null);
    }
  }

  useEffect(() => {
    if (open) {
      setApiKey("");
      load();
    }
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      if (model.trim() && model.trim() !== settings?.model) payload.model = model.trim();
      if (baseUrl.trim() && baseUrl.trim() !== settings?.base_url) payload.base_url = baseUrl.trim();
      const s = await updateLlmSettings(payload);
      setSettings(s);
      setApiKey("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={
        <Space>
          <ApiOutlined style={{ color: "#1677ff" }} />
          模型配置
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="保存并生效"
      cancelText="关闭"
      width={520}
    >
      <Space direction="vertical" size={14} style={{ width: "100%", marginTop: 8 }}>
        <Alert
          type={settings?.configured ? "success" : "info"}
          showIcon
          message={
            settings?.configured ? (
              <Space wrap size={4}>
                <Text>AI 模式已启用</Text>
                <Tag color="blue">{settings.model}</Tag>
                {settings.api_key_masked && <Text type="secondary">Key：{settings.api_key_masked}</Text>}
              </Space>
            ) : (
              "当前为规则引擎模式（未配置 API Key），配置后生成质量更好"
            )
          }
        />

        <div>
          <Text strong style={{ display: "block", marginBottom: 4 }}>API Key</Text>
          <Input.Password
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              settings?.api_key_masked
                ? `已配置（${settings.api_key_masked}），输入新值可覆盖`
                : "粘贴 DashScope 或 OpenAI 兼容 API Key"
            }
            autoComplete="new-password"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            阿里云百炼控制台（bailian.console.aliyun.com）可创建 DashScope Key
          </Text>
        </div>

        <div>
          <Text strong style={{ display: "block", marginBottom: 4 }}>模型名称</Text>
          <AutoComplete
            value={model}
            onChange={setModel}
            options={MODEL_SUGGESTIONS}
            placeholder="qwen-plus 等，可输入任意模型名"
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <Text strong style={{ display: "block", marginBottom: 4 }}>
            Base URL <Text type="secondary" style={{ fontWeight: 400 }}>（可选，OpenAI 兼容接口）</Text>
          </Text>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
          />
        </div>

        {settings && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            保存后立即生效，并写入 {settings.env_file}（重启后仍有效）
          </Text>
        )}
      </Space>
    </Modal>
  );
}

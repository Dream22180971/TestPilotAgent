"use client";

import {
  Alert,
  AutoComplete,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { ApiOutlined, LinkOutlined, ReloadOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";

import {
  fetchLlmModels,
  getLlmSettings,
  testLlmConnection,
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
 * 模型配置弹窗：配置任意 OpenAI 兼容服务（模型名与 Base URL 均可自定义），
 * 支持「测试连接」验证可用性与「获取模型列表」直接选择。
 * 保存后立即生效（后端热切换），并持久化到 testpilot-api/.env。
 */
export default function ModelSettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const [settings, setSettings] = useState<LlmSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [remoteModels, setRemoteModels] = useState<string[]>([]);

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
      setTestResult(null);
      setRemoteModels([]);
      load();
    }
  }, [open]);

  /** 当前表单里填的值（未保存的也能直接测试/拉列表） */
  function currentPayload() {
    const payload: Record<string, string> = {};
    if (apiKey.trim()) payload.api_key = apiKey.trim();
    if (model.trim()) payload.model = model.trim();
    if (baseUrl.trim()) payload.base_url = baseUrl.trim();
    return payload;
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testLlmConnection(currentPayload());
      if (r.ok) {
        setTestResult({ ok: true, text: `连接成功，模型 ${r.model} 响应 ${r.latency_ms}ms` });
      } else {
        const detail = r.chat_error ?? r.models_error ?? r.error ?? "未知错误";
        setTestResult({ ok: false, text: `连接失败：${detail}` });
      }
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setTesting(false);
    }
  }

  async function handleFetchModels() {
    setFetchingModels(true);
    try {
      const r = await fetchLlmModels(currentPayload());
      if (r.ok && r.models.length > 0) {
        setRemoteModels(r.models);
        messageApi.success(`获取到 ${r.models.length} 个模型`);
      } else {
        messageApi.error(r.error ?? "该服务未提供模型列表接口，请手动输入模型名");
      }
    } catch (e) {
      messageApi.error(e instanceof Error ? e.message : "获取模型列表失败");
    } finally {
      setFetchingModels(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const prev = settings;
      const payload: Record<string, string> = {};
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      if (model.trim() && model.trim() !== prev?.model) payload.model = model.trim();
      if (baseUrl.trim() && baseUrl.trim() !== prev?.base_url) payload.base_url = baseUrl.trim();
      const s = await updateLlmSettings(payload);
      setSettings(s);
      setApiKey("");
      messageApi.success("已保存并生效");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={
        <Space>
          <ApiOutlined style={{ color: "#0D9488" }} />
          模型配置
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="保存并生效"
      cancelText="关闭"
      width={560}
    >
      {contextHolder}
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
            支持任意 OpenAI 兼容服务：阿里云百炼 / DeepSeek / Moonshot / OpenAI 等
          </Text>
        </div>

        <div>
          <Text strong style={{ display: "block", marginBottom: 4 }}>
            模型名称{" "}
            <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>（可自定义输入）</Text>
          </Text>
          {remoteModels.length > 0 ? (
            <Select
              showSearch
              value={model}
              onChange={setModel}
              options={remoteModels.map((m) => ({ value: m, label: m }))}
              style={{ width: "100%" }}
              placeholder="从服务获取的模型列表"
            />
          ) : (
            <AutoComplete
              value={model}
              onChange={setModel}
              options={MODEL_SUGGESTIONS}
              placeholder="输入任意模型名"
              style={{ width: "100%" }}
            />
          )}
          <Button
            size="small"
            type="link"
            icon={<ReloadOutlined />}
            loading={fetchingModels}
            onClick={handleFetchModels}
            style={{ padding: 0, marginTop: 4 }}
          >
            {remoteModels.length > 0 ? "刷新模型列表" : "从服务获取模型列表"}
          </Button>
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

        <div>
          <Button
            icon={<LinkOutlined />}
            loading={testing}
            onClick={handleTest}
          >
            测试连接
          </Button>
          {testResult && (
            <Alert
              style={{ marginTop: 8 }}
              type={testResult.ok ? "success" : "error"}
              showIcon
              message={testResult.text}
            />
          )}
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

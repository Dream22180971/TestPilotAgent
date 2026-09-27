"use client";

import { Layout, Menu, Tooltip, Typography } from "antd";
import { ExperimentOutlined, GithubOutlined, HistoryOutlined, SettingOutlined } from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getLlmSettings, type LlmSettings } from "@/services/settings";
import ModelSettingsModal from "./ModelSettingsModal";

const { Sider, Content } = Layout;
const { Text } = Typography;

const NAV_ITEMS = [
  { key: "/workspace", icon: <ExperimentOutlined />, label: "工作台" },
  { key: "/history", icon: <HistoryOutlined />, label: "项目历史" },
];

const REPO_URL = "https://github.com/Dream22180971/TestPilotAgent";

/** 领航标志：罗盘指针 */
function BrandMark() {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 12px rgba(13, 148, 136, 0.3)",
        flexShrink: 0,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" />
        <path d="M15.8 8.2 13.4 13.4 8.2 15.8 10.6 10.6Z" fill="#fff" />
        <circle cx="12" cy="12" r="1.3" fill="#0F766E" />
      </svg>
    </div>
  );
}

/**
 * 全局工作台壳：左侧导航（品牌 / 菜单 / 模型状态）+ 内容区。
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [llm, setLlm] = useState<LlmSettings | null>(null);
  const [apiDown, setApiDown] = useState(false);

  const selectedKey = NAV_ITEMS.some((item) => item.key === pathname) ? pathname : "/workspace";

  const loadLlm = useCallback(async () => {
    try {
      setLlm(await getLlmSettings());
      setApiDown(false);
    } catch {
      setApiDown(true);
    }
  }, []);

  useEffect(() => {
    loadLlm();
  }, [loadLlm]);

  const statusTitle = apiDown ? "API 未连接" : llm?.configured ? "AI 模式" : "规则引擎";
  const statusDetail = apiDown ? "请先运行 start-api.ps1" : llm?.configured ? llm.model : "点此配置模型";

  return (
    <Layout className="workbench-bg" style={{ height: "100vh", overflow: "hidden" }}>
      <Sider
        width={216}
        collapsedWidth={68}
        collapsible
        breakpoint="lg"
        collapsed={navCollapsed}
        onCollapse={setNavCollapsed}
        theme="light"
        className="app-nav"
        style={{ height: "100%", zIndex: 20 }}
      >
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: navCollapsed ? "18px 0" : "18px 18px",
              justifyContent: navCollapsed ? "center" : "flex-start",
            }}
          >
            <BrandMark />
            {!navCollapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2, color: "var(--ink)", letterSpacing: 1 }}>
                  领航
                </div>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  AI 测试工作台
                </Text>
              </div>
            )}
          </div>

          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={NAV_ITEMS}
            onClick={({ key }) => router.push(key)}
            style={{ borderInlineEnd: "none" }}
          />

          <div style={{ flex: 1 }} />

          <div style={{ padding: navCollapsed ? "0 0 12px" : "0 12px 12px", flexShrink: 0 }}>
            {navCollapsed ? (
              <Tooltip title={`${statusTitle} · ${statusDetail}`} placement="right">
                <button
                  type="button"
                  className="model-status"
                  onClick={() => setSettingsOpen(true)}
                  style={{ justifyContent: "center", border: "none", background: "transparent" }}
                  aria-label="模型配置"
                >
                  <SettingOutlined style={{ color: "var(--ink-3)" }} />
                </button>
              </Tooltip>
            ) : (
              <button type="button" className="model-status" onClick={() => setSettingsOpen(true)}>
                <span className={`status-dot${llm?.configured && !apiDown ? "" : " is-off"}`} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{statusTitle}</span>
                  <Text type="secondary" ellipsis style={{ display: "block", fontSize: 11.5 }}>
                    {statusDetail}
                  </Text>
                </span>
                <SettingOutlined style={{ color: "var(--ink-4)" }} />
              </button>
            )}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: navCollapsed ? "center" : "flex-start",
                gap: 6,
                marginTop: 10,
                padding: navCollapsed ? 0 : "0 4px",
                color: "var(--ink-4)",
                fontSize: 12,
              }}
            >
              <GithubOutlined />
              {!navCollapsed && "GitHub 仓库"}
            </a>
          </div>
        </div>
      </Sider>
      <ModelSettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          loadLlm();
        }}
      />
      <Layout style={{ background: "transparent" }}>
        <Content style={{ padding: "20px 24px", height: "100%", overflow: "hidden" }}>{children}</Content>
      </Layout>
    </Layout>
  );
}

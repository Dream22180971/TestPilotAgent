"use client";

import { Button, Layout, Menu, Tooltip, Typography } from "antd";
import {
  ExperimentOutlined,
  HistoryOutlined,
  GithubOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";

import ModelSettingsModal from "./ModelSettingsModal";
import { useState } from "react";

const { Sider, Content } = Layout;
const { Text } = Typography;

const NAV_ITEMS = [
  { key: "/workspace", icon: <ExperimentOutlined />, label: "工作台" },
  { key: "/history", icon: <HistoryOutlined />, label: "项目历史" },
];

/**
 * 全局工作台壳：左侧固定导航 + 内容区。
 * 参考 Ant Design Pro 的 ProLayout 布局范式。
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const selectedKey = NAV_ITEMS.some((item) => item.key === pathname)
    ? pathname
    : "/workspace";

  return (
    <Layout className="workbench-bg" style={{ height: "100vh", overflow: "hidden" }}>
      <Sider
        width={208}
        collapsedWidth={64}
        collapsible
        breakpoint="lg"
        collapsed={navCollapsed}
        onCollapse={setNavCollapsed}
        theme="light"
        style={{
          borderRight: "1px solid #f0f0f0",
          height: "100%",
          overflow: "auto",
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", justifyContent: navCollapsed ? "center" : "flex-start" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #1677ff, #69b1ff)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            领
          </div>
          {!navCollapsed && (
            <div>
              <Text strong style={{ display: "block", lineHeight: 1.2, fontSize: 15 }}>
                领航
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
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
        <div style={{ position: "absolute", bottom: 16, width: "100%", padding: navCollapsed ? 0 : "0 20px", textAlign: navCollapsed ? "center" : "left" }}>
          <div style={{ marginBottom: 10 }}>
            {navCollapsed ? (
              <Tooltip title="模型配置" placement="right">
                <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)} />
              </Tooltip>
            ) : (
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => setSettingsOpen(true)}
                style={{ padding: "0 0", color: "rgba(0,0,0,0.65)", fontSize: 13 }}
              >
                模型配置
              </Button>
            )}
          </div>
          {navCollapsed ? (
            <Tooltip title="GitHub 仓库" placement="right">
              <Link href="https://github.com/Dream22180971/TestPilotAgent" target="_blank" style={{ color: "rgba(0,0,0,0.45)", fontSize: 14 }}>
                <GithubOutlined />
              </Link>
            </Tooltip>
          ) : (
            <Link
              href="https://github.com/Dream22180971/TestPilotAgent"
              target="_blank"
              style={{ color: "rgba(0,0,0,0.45)", fontSize: 12 }}
            >
              <GithubOutlined style={{ marginRight: 6 }} />
              GitHub 仓库
            </Link>
          )}
        </div>
      </Sider>
      <ModelSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Layout>
        <Content style={{ padding: 24, height: "100%", overflow: "hidden" }}>{children}</Content>
      </Layout>
    </Layout>
  );
}

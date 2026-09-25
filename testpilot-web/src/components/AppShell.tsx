"use client";

import { Layout, Menu, Typography } from "antd";
import {
  ExperimentOutlined,
  HistoryOutlined,
  GithubOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const selectedKey = NAV_ITEMS.some((item) => item.key === pathname)
    ? pathname
    : "/workspace";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={208}
        theme="light"
        style={{
          borderRight: "1px solid #f0f0f0",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px" }}>
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
              fontSize: 16,
            }}
          >
            T
          </div>
          <div>
            <Text strong style={{ display: "block", lineHeight: 1.2 }}>
              TestPilot
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              测试工作台
            </Text>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS}
          style={{ borderInlineEnd: "none" }}
        />
        <div style={{ position: "absolute", bottom: 16, width: "100%", padding: "0 20px" }}>
          <Link
            href="https://github.com/Dream22180971/TestPilotAgent"
            target="_blank"
            style={{ color: "rgba(0,0,0,0.45)", fontSize: 12 }}
          >
            <GithubOutlined style={{ marginRight: 6 }} />
            GitHub 仓库
          </Link>
        </div>
      </Sider>
      <Layout>
        <Content style={{ padding: 24 }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}

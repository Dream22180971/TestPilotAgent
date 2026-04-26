"use client";

import { Card, List, Space, Tag, Typography } from "antd";

const { Title, Text } = Typography;

const demoProjects = [
  {
    id: "proj_demo_01",
    name: "电商下单测试分析",
    systemType: "Web",
    updatedAt: "2026-04-26 22:10",
    lastGeneratedModule: "test_cases",
  },
  {
    id: "proj_demo_02",
    name: "会员注册与登录流程",
    systemType: "App",
    updatedAt: "2026-04-26 21:40",
    lastGeneratedModule: "analysis",
  },
];

export default function HistoryPage() {
  return (
    <main style={{ padding: 24, background: "#f3f5f7", minHeight: "100vh" }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>项目历史</Title>
          <Text type="secondary">这里先放演示数据，下一步接真实项目列表接口。</Text>
        </div>
        <Card bordered={false}>
          <List
            itemLayout="horizontal"
            dataSource={demoProjects}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={item.name}
                  description={
                    <Space wrap>
                      <Tag>{item.systemType}</Tag>
                      <Text type="secondary">最近更新：{item.updatedAt}</Text>
                      <Text type="secondary">最近生成模块：{item.lastGeneratedModule}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </Space>
    </main>
  );
}

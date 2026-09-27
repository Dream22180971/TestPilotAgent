"use client";

import { App as AntdApp, Button, Card, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FolderOpenOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import { listProjects } from "@/services/project";
import type { Project } from "@/types/project";

const { Title, Text } = Typography;

interface HistoryRow {
  id: string;
  name: string;
  system_type: string;
  test_types: string[];
  script_language: string;
  created_at?: string;
}

const columns: ColumnsType<HistoryRow> = [
  { title: "项目名称", dataIndex: "name", key: "name" },
  {
    title: "系统类型",
    dataIndex: "system_type",
    key: "system_type",
    width: 160,
    render: (value: string) =>
      String(value)
        .split(",")
        .filter(Boolean)
        .map((v) => (
          <Tag key={v} color="blue" style={{ marginBottom: 2 }}>
            {v}
          </Tag>
        )),
  },
  {
    title: "测试类型",
    dataIndex: "test_types",
    key: "test_types",
    width: 220,
    render: (values: string[]) =>
      values?.map((v) => <Tag key={v} style={{ marginBottom: 2 }}>{v}</Tag>),
  },
  { title: "脚本语言", dataIndex: "script_language", key: "script_language", width: 100 },
  {
    title: "创建时间",
    dataIndex: "created_at",
    key: "created_at",
    width: 170,
    render: (value?: string) =>
      value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-",
  },
  {
    title: "操作",
    key: "actions",
    width: 100,
    render: (_, record) => (
      <Button
        type="link"
        size="small"
        icon={<FolderOpenOutlined />}
        onClick={() => {
          sessionStorage.setItem("testpilot:openProjectId", record.id);
          window.location.href = "/workspace";
        }}
      >
        打开
      </Button>
    ),
  },
];

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    listProjects()
      .then(({ items }) => setRows(items ?? []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          项目历史
        </Title>
        <Text type="secondary">
          所有已创建的项目。打开项目会恢复其配置与文档，生成结果需在工作台重新生成。
        </Text>
      </div>
      <Card size="small">
        {failed ? (
          <Typography.Text type="warning">
            无法连接 API 服务（默认 http://127.0.0.1:8000），请先运行 start-api.ps1。
          </Typography.Text>
        ) : (
          <Table<HistoryRow>
            columns={columns}
            dataSource={rows}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
            locale={{ emptyText: "还没有项目，去工作台创建第一个吧。" }}
            onRow={(record) => ({
              onClick: () => {
                sessionStorage.setItem("testpilot:openProjectId", record.id);
                window.location.href = "/workspace";
              },
              style: { cursor: "pointer" },
            })}
          />
        )}
      </Card>
    </AppShell>
  );
}

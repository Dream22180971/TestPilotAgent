"use client";

import { Alert, Button, Card, Input, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FolderOpenOutlined, SearchOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import { useWorkspaceContext } from "@/components/WorkspaceProvider";
import { TARGET_LABELS } from "@/hooks/useWorkspace";
import { listProjects } from "@/services/project";
import type { Project } from "@/types/project";

const { Title, Text } = Typography;

function formatTime(value?: string): string {
  if (!value) return "-";
  // 后端存的是 UTC 且不带时区后缀（SQLite），补 Z 再按本地时区显示
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return date.toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function HistoryPage() {
  const ws = useWorkspaceContext();
  const router = useRouter();
  const [rows, setRows] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    listProjects()
      .then(({ items }) => setRows(items ?? []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const open = (project: Project) => {
    ws.openProject(project);
    router.push("/workspace");
  };

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return k ? rows.filter((r) => r.name.toLowerCase().includes(k)) : rows;
  }, [rows, keyword]);

  const columns: ColumnsType<Project> = [
    {
      title: "项目名称",
      dataIndex: "name",
      key: "name",
      render: (value: string, record) => (
        <Space size={8}>
          <Text strong>{value}</Text>
          {record.id === ws.projectId && (
            <Tag color="cyan" bordered={false}>
              当前
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "系统类型",
      dataIndex: "system_type",
      key: "system_type",
      width: 170,
      render: (value: string) =>
        String(value)
          .split(",")
          .filter(Boolean)
          .map((v) => (
            <Tag key={v} bordered={false} color="cyan" style={{ marginBottom: 2 }}>
              {v}
            </Tag>
          )),
    },
    {
      title: "测试类型",
      dataIndex: "test_types",
      key: "test_types",
      width: 230,
      render: (values: string[]) =>
        values?.map((v) => (
          <Tag key={v} bordered={false} style={{ marginBottom: 2 }}>
            {v}
          </Tag>
        )),
    },
    {
      title: "最近生成",
      dataIndex: "last_generated_module",
      key: "last_generated_module",
      width: 110,
      render: (value?: string | null) =>
        value ? <Text>{TARGET_LABELS[value] ?? value}</Text> : <Text type="secondary">未生成</Text>,
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 130,
      sorter: (a, b) => (a.updated_at ?? "").localeCompare(b.updated_at ?? ""),
      defaultSortOrder: "descend",
      render: (value?: string) => <Text className="tabular" type="secondary">{formatTime(value)}</Text>,
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_, record) => (
        <Button type="link" size="small" icon={<FolderOpenOutlined />} onClick={(e) => { e.stopPropagation(); open(record); }}>
          打开
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
          <div>
            <Title level={3} className="page-title">
              项目历史
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              打开项目会恢复它的配置、最近一次需求、上传文档和已生成的全部结果。
            </Text>
          </div>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: "var(--ink-4)" }} />}
            placeholder="搜索项目名称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 240 }}
          />
        </div>
        <Card size="small" style={{ flex: 1, minHeight: 0, overflow: "hidden" }} styles={{ body: { height: "100%", overflowY: "auto" } }}>
          {failed ? (
            <Alert type="warning" showIcon message="无法连接 API 服务（默认 http://127.0.0.1:8000），请先运行 start-api.ps1。" />
          ) : (
            <Table<Project>
              columns={columns}
              dataSource={filtered}
              rowKey="id"
              loading={loading}
              size="middle"
              pagination={{ pageSize: 15, hideOnSinglePage: true, showTotal: (n) => `共 ${n} 个项目` }}
              locale={{ emptyText: keyword ? "没有匹配的项目" : "还没有项目，去工作台创建第一个吧。" }}
              onRow={(record) => ({ onClick: () => open(record), style: { cursor: "pointer" } })}
            />
          )}
        </Card>
      </div>
    </AppShell>
  );
}

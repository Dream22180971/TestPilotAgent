"use client";

import { Button, Descriptions, Modal, Space, Table, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import type { TestCaseRow, TestPointRow } from "@/types/output";
import { EmptyHint, PriorityTag, TypeTag } from "./ModuleViews";

const { Text } = Typography;

/** 列筛选项：从数据里取去重值 */
function filtersOf<T>(rows: T[], pick: (row: T) => string) {
  return Array.from(new Set(rows.map(pick).filter(Boolean))).map((v) => ({ text: v, value: v }));
}

export function TestPointsTable({ rows }: { rows: TestPointRow[] }) {
  const columns = useMemo<ColumnsType<TestPointRow>>(
    () => [
      {
        title: "模块",
        dataIndex: "module",
        key: "module",
        width: 120,
        filters: filtersOf(rows, (r) => r.module),
        onFilter: (value, record) => record.module === value,
        render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
      },
      { title: "场景", dataIndex: "scenario", key: "scenario", width: 160 },
      { title: "测试点", dataIndex: "point", key: "point" },
      {
        title: "类型",
        dataIndex: "type",
        key: "type",
        width: 80,
        filters: filtersOf(rows, (r) => r.type),
        onFilter: (value, record) => record.type === value,
        render: (v: string) => <TypeTag value={v} />,
      },
      {
        title: "优先级",
        dataIndex: "priority",
        key: "priority",
        width: 84,
        filters: filtersOf(rows, (r) => r.priority),
        onFilter: (value, record) => record.priority === value,
        render: (v: string) => <PriorityTag value={v} />,
      },
    ],
    [rows],
  );

  if (rows.length === 0) {
    return <EmptyHint text="尚未生成测试点。点击上方「生成」开始。" />;
  }
  return (
    <Table<TestPointRow>
      columns={columns}
      dataSource={rows}
      rowKey={(r, i) => r.id || String(i)}
      size="small"
      pagination={{ pageSize: 20, hideOnSinglePage: true, showTotal: (n) => `共 ${n} 条` }}
    />
  );
}

/** 用例列表：表格 + 详情抽屉（参考测试平台常见的列表-详情交互） */
export function TestCasesTable({ rows }: { rows: TestCaseRow[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeCase = activeIndex === null ? null : rows[activeIndex] ?? null;

  const columns = useMemo<ColumnsType<TestCaseRow>>(
    () => [
      {
        title: "编号",
        dataIndex: "id",
        key: "id",
        width: 104,
        render: (v: string) => <Text className="tabular" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{v}</Text>,
      },
      {
        title: "模块",
        dataIndex: "module",
        key: "module",
        width: 120,
        filters: filtersOf(rows, (r) => r.module),
        onFilter: (value, record) => record.module === value,
      },
      { title: "用例标题", dataIndex: "title", key: "title" },
      {
        title: "步骤",
        key: "steps",
        width: 64,
        align: "center",
        render: (_, record) => <Text type="secondary" className="tabular">{record.steps?.length ?? 0}</Text>,
      },
      {
        title: "优先级",
        dataIndex: "priority",
        key: "priority",
        width: 84,
        filters: filtersOf(rows, (r) => r.priority),
        onFilter: (value, record) => record.priority === value,
        render: (v: string) => <PriorityTag value={v} />,
      },
      {
        title: "",
        key: "actions",
        width: 64,
        render: () => (
          <Button type="link" size="small" style={{ padding: 0 }}>
            详情
          </Button>
        ),
      },
    ],
    [rows],
  );

  if (rows.length === 0) {
    return <EmptyHint text="尚未生成测试用例。点击上方「生成」开始。" />;
  }

  const listBlock = (title: string, items: string[] | undefined, ordered = false) => {
    const Tag = ordered ? "ol" : "ul";
    return (
      <div style={{ marginBottom: 18 }}>
        <Text strong style={{ display: "block", marginBottom: 6 }}>
          {title}
        </Text>
        {items?.length ? (
          <Tag style={{ paddingLeft: 20, margin: 0, lineHeight: 1.9, color: "var(--ink-2)" }}>
            {items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </Tag>
        ) : (
          <Text type="secondary">无</Text>
        )}
      </div>
    );
  };

  return (
    <>
      <Table<TestCaseRow>
        columns={columns}
        dataSource={rows}
        rowKey={(r, i) => r.id || String(i)}
        size="small"
        pagination={{ pageSize: 20, hideOnSinglePage: true, showTotal: (n) => `共 ${n} 条` }}
        onRow={(record) => ({
          onClick: () => setActiveIndex(rows.indexOf(record)),
          style: { cursor: "pointer" },
        })}
      />
      <Modal
        centered
        open={Boolean(activeCase)}
        onCancel={() => setActiveIndex(null)}
        width="min(760px, 76vw)"
        title={
          activeCase && (
            <div style={{ paddingRight: 24 }}>
              <Text type="secondary" className="tabular" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
                {activeCase.id}
              </Text>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5, marginTop: 2 }}>{activeCase.title}</div>
            </div>
          )
        }
        styles={{ body: { maxHeight: "64vh", overflowY: "auto", paddingRight: 8 } }}
        footer={
          activeIndex !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text type="secondary" className="tabular" style={{ fontSize: 12 }}>
                {activeIndex + 1} / {rows.length}
              </Text>
              <Space>
                <Button icon={<LeftOutlined />} disabled={activeIndex <= 0} onClick={() => setActiveIndex(activeIndex - 1)}>
                  上一条
                </Button>
                <Button disabled={activeIndex >= rows.length - 1} onClick={() => setActiveIndex(activeIndex + 1)}>
                  下一条 <RightOutlined />
                </Button>
              </Space>
            </div>
          )
        }
      >
        {activeCase && (
          <div>
            <Descriptions
              size="small"
              column={2}
              bordered
              style={{ marginBottom: 20 }}
              items={[
                { key: "module", label: "模块", children: activeCase.module },
                { key: "priority", label: "优先级", children: <PriorityTag value={activeCase.priority} /> },
                { key: "scenario", label: "场景", children: activeCase.scenario, span: 2 },
              ]}
            />
            {listBlock("前置条件", activeCase.preconditions)}
            {listBlock("测试步骤", activeCase.steps, true)}
            {listBlock("预期结果", activeCase.expected_results)}
          </div>
        )}
      </Modal>
    </>
  );
}

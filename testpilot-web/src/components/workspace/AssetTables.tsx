"use client";

import { Drawer, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import type { TestCaseRow, TestPointRow } from "@/types/output";
import { EmptyHint, PriorityTag } from "./ModuleViews";

const { Text, Paragraph } = Typography;

const POINT_COLUMNS: ColumnsType<TestPointRow> = [
  { title: "模块", dataIndex: "module", key: "module", width: 110 },
  { title: "场景", dataIndex: "scenario", key: "scenario", width: 150 },
  { title: "测试点", dataIndex: "point", key: "point" },
  { title: "类型", dataIndex: "type", key: "type", width: 90 },
  {
    title: "优先级",
    dataIndex: "priority",
    key: "priority",
    width: 90,
    render: (value: string) => <PriorityTag value={value} />,
  },
];

export function TestPointsTable({ rows }: { rows: TestPointRow[] }) {
  if (rows.length === 0) {
    return <EmptyHint text="尚未生成测试点。点击上方「生成」开始。" />;
  }
  return (
    <Table<TestPointRow>
      columns={POINT_COLUMNS}
      dataSource={rows}
      rowKey="id"
      size="small"
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
    />
  );
}

const CASE_COLUMNS: ColumnsType<TestCaseRow> = [
  { title: "编号", dataIndex: "id", key: "id", width: 100 },
  { title: "模块", dataIndex: "module", key: "module", width: 110 },
  { title: "用例标题", dataIndex: "title", key: "title" },
  {
    title: "优先级",
    dataIndex: "priority",
    key: "priority",
    width: 90,
    render: (value: string) => <PriorityTag value={value} />,
  },
  {
    title: "操作",
    key: "actions",
    width: 70,
    render: (_, record) => <Text style={{ color: "#1677ff" }}>详情</Text>,
  },
];

/** 用例列表：表格 + 详情抽屉（参考测试平台常见的列表-详情交互） */
export function TestCasesTable({ rows }: { rows: TestCaseRow[] }) {
  const [activeCase, setActiveCase] = useState<TestCaseRow | null>(null);

  if (rows.length === 0) {
    return <EmptyHint text="尚未生成测试用例。点击上方「生成」开始。" />;
  }

  return (
    <>
      <Table<TestCaseRow>
        columns={CASE_COLUMNS}
        dataSource={rows}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        onRow={(record) => ({
          onClick: () => setActiveCase(record),
          style: { cursor: "pointer" },
        })}
      />
      <Drawer
        title={activeCase ? `${activeCase.id} ${activeCase.title}` : ""}
        open={Boolean(activeCase)}
        onClose={() => setActiveCase(null)}
        width={520}
      >
        {activeCase && (
          <div>
            <Paragraph>
              <Text strong>模块 / 场景：</Text>
              {activeCase.module} / {activeCase.scenario}
            </Paragraph>
            <Paragraph>
              <Text strong>优先级：</Text>
              <PriorityTag value={activeCase.priority} />
            </Paragraph>
            <Text strong>前置条件</Text>
            <ul style={{ paddingLeft: 20 }}>
              {activeCase.preconditions.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <Text strong>测试步骤</Text>
            <ol style={{ paddingLeft: 20 }}>
              {activeCase.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <Text strong>预期结果</Text>
            <ul style={{ paddingLeft: 20 }}>
              {activeCase.expected_results.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </Drawer>
    </>
  );
}

"use client";

import { Card, Collapse, Spin, Tag, Typography } from "antd";
import { CaretRightOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useEffect, useRef } from "react";

const { Text } = Typography;

export interface TaskState {
  active: boolean;
  stage: string;
  message: string;
  reasoning: Record<string, string>;
  elapsedMs?: number;
}

/**
 * 生成任务面板：实时展示当前阶段与模型思考过程。
 * 生成中思考流自动滚动；完成后保留为可展开回看的记录。
 */
export default function TaskPanel({ task }: { task: TaskState | null }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const reasoningText = task ? Object.values(task.reasoning).join("\n\n") : "";

  useEffect(() => {
    if (task?.active && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [reasoningText, task?.active]);

  if (!task || (!task.active && !reasoningText)) return null;

  const running = task.active;

  return (
    <Card
      size="small"
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {running ? <Spin size="small" /> : <ThunderboltOutlined style={{ color: "#0D9488" }} />}
          <span>{running ? "正在生成" : "任务完成"}</span>
          <Tag color={running ? "processing" : task.stage === "error" ? "error" : "success"}>
            {running ? task.message || "进行中…" : task.message}
          </Tag>
        </span>
      }
      styles={{ body: { padding: running ? "8px 12px" : 0 } }}
    >
      {running && (
        <div
          ref={boxRef}
          style={{
            maxHeight: 180,
            overflowY: "auto",
            fontSize: 12,
            lineHeight: 1.7,
            color: "#475569",
            whiteSpace: "pre-wrap",
            background: "#f8fafc",
            borderRadius: 6,
            padding: reasoningText ? "8px 12px" : 0,
            border: reasoningText ? "1px solid #e2e8f0" : "none",
          }}
        >
          {reasoningText || "正在准备任务…（模型思考过程将实时显示在这里）"}
        </div>
      )}
      {!running && reasoningText && (
        <Collapse
          ghost
          size="small"
          items={[
            {
              key: "reasoning",
              label: <Text type="secondary" style={{ fontSize: 13 }}>查看模型思考过程（{reasoningText.length} 字）</Text>,
              children: (
                <div
                  style={{
                    maxHeight: 320,
                    overflowY: "auto",
                    fontSize: 12,
                    lineHeight: 1.8,
                    color: "#475569",
                    whiteSpace: "pre-wrap",
                    background: "#f8fafc",
                    borderRadius: 6,
                    padding: "10px 14px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {reasoningText}
                </div>
              ),
            },
          ]}
          expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
        />
      )}
    </Card>
  );
}

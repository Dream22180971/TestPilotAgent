"use client";

import { Button, Spin, Tag, Typography } from "antd";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  CloseOutlined,
  DownOutlined,
  PauseCircleFilled,
  UpOutlined,
} from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";

import { TARGET_LABELS, type TaskState } from "@/hooks/useWorkspace";

const { Text } = Typography;

function useElapsed(task: TaskState | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!task?.active) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [task?.active]);
  if (!task) return 0;
  return task.active ? now - task.startedAt : task.elapsedMs ?? 0;
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * 生成任务条：阶段消息 + 进度 + 计时 + 停止；
 * 下方是模型思考流（生成中自动展开并跟随滚动，完成后可折叠回看）。
 */
export default function TaskPanel({ task, onStop }: { task: TaskState | null; onStop: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const elapsed = useElapsed(task);

  const sections = task
    ? Object.entries(task.reasoning).filter(([, text]) => text.trim())
    : [];
  const reasoningLength = sections.reduce((n, [, text]) => n + text.length, 0);

  // 新任务开始时展开思考流
  useEffect(() => {
    if (task?.active) setOpen(true);
  }, [task?.startedAt, task?.active]);

  useEffect(() => {
    if (task?.active && open && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [reasoningLength, task?.active, open]);

  if (!task || dismissed === task.startedAt) return null;

  const running = task.active;
  const total = Math.max(task.targets.length, 1);
  const finished = task.finished.filter((t) => task.targets.includes(t)).length;
  const percent = running ? Math.max(4, Math.round((finished / total) * 100)) : 100;

  const icon = running ? (
    <Spin size="small" />
  ) : task.stage === "error" ? (
    <CloseCircleFilled style={{ color: "var(--danger)", fontSize: 16 }} />
  ) : task.stage === "stopped" ? (
    <PauseCircleFilled style={{ color: "var(--warning)", fontSize: 16 }} />
  ) : (
    <CheckCircleFilled style={{ color: "var(--success)", fontSize: 16 }} />
  );

  return (
    <div>
      <div className={`task-bar${running ? " is-running" : ""}`}>
        {running && <span className="task-progress" style={{ width: `${percent}%` }} />}
        {icon}
        <Text strong ellipsis style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
          {task.message}
        </Text>
        {running && task.current && <Tag color="processing" style={{ marginInlineEnd: 0 }}>{TARGET_LABELS[task.current]}</Tag>}
        <Text type="secondary" className="tabular" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {finished}/{total} 模块 · {formatElapsed(elapsed)}
        </Text>
        {sections.length > 0 && (
          <Button
            size="small"
            type="text"
            icon={open ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setOpen(!open)}
            style={{ color: "var(--ink-3)" }}
          >
            思考过程
          </Button>
        )}
        {running ? (
          <Button size="small" danger onClick={onStop}>
            停止
          </Button>
        ) : (
          <Button
            size="small"
            type="text"
            icon={<CloseOutlined />}
            aria-label="关闭任务条"
            onClick={() => setDismissed(task.startedAt)}
            style={{ color: "var(--ink-4)" }}
          />
        )}
      </div>

      {open && (running || sections.length > 0) && (
        <div ref={boxRef} className="reasoning-stream" style={{ marginTop: 8, maxHeight: running ? 150 : 260 }}>
          {sections.length === 0 ? (
            <span style={{ color: "#64748b" }}>
              正在等待模型输出…（支持思考模式的模型会在这里实时显示推理过程）
            </span>
          ) : (
            sections.map(([target, text], i) => (
              <div key={target} style={{ marginTop: i ? 10 : 0 }}>
                <div className="reasoning-head" style={{ fontWeight: 600 }}>$ {TARGET_LABELS[target] ?? target}</div>
                {text}
              </div>
            ))
          )}
          {running && <span className="reasoning-caret" />}
        </div>
      )}
    </div>
  );
}

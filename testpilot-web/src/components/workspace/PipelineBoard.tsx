"use client";

import { Button, Card, Space, Tooltip } from "antd";
import {
  AimOutlined,
  BranchesOutlined,
  CalendarOutlined,
  CheckOutlined,
  LoadingOutlined,
  OrderedListOutlined,
  PauseCircleOutlined,
  ProfileOutlined,
  RocketOutlined,
  QuestionCircleFilled,
  SafetyCertificateOutlined,
  WarningFilled,
} from "@ant-design/icons";

import { STEP_ORDER, TARGET_LABELS, type ModuleStatus } from "@/hooks/useWorkspace";

const STEP_ICONS: Record<string, React.ReactNode> = {
  analysis: <AimOutlined />,
  test_strategy: <SafetyCertificateOutlined />,
  test_plan: <CalendarOutlined />,
  test_points: <OrderedListOutlined />,
  test_cases: <ProfileOutlined />,
  test_design: <BranchesOutlined />,
};

const STATUS_TEXT: Record<ModuleStatus, string> = {
  empty: "未生成",
  queued: "排队中",
  busy: "生成中…",
  done: "已生成",
};

/**
 * 生成流水线看板：六个模块一行排开，节点即状态 + 入口。
 * 已生成的节点间连线点亮；生成中的节点呼吸脉冲；点击节点切换到对应结果页。
 */
export default function PipelineBoard({
  statusOf,
  countOf,
  selected,
  onSelect,
  running,
  onRunAll,
  onStop,
  riskCount,
  unknownCount,
  onShowUnknowns,
}: {
  statusOf: (target: string) => ModuleStatus;
  countOf: (target: string) => number | null;
  selected: string;
  onSelect: (target: string) => void;
  running: boolean;
  onRunAll: () => void;
  onStop: () => void;
  riskCount: number;
  unknownCount: number;
  onShowUnknowns: () => void;
}) {
  const doneCount = STEP_ORDER.filter((t) => statusOf(t) === "done").length;
  const percent = Math.round((doneCount / STEP_ORDER.length) * 100);

  return (
    <Card
      size="small"
      className="pipeline-hero"
      title={
        <Space size={10}>
          <span
            className="progress-ring"
            style={{ background: `conic-gradient(#5eead4 ${percent}%, rgba(255,255,255,0.14) 0)` }}
            aria-label={`已完成 ${percent}%`}
          />
          <span style={{ color: "#ecfeff", fontWeight: 700, letterSpacing: 0.5 }}>生成流水线</span>
          <span className="tabular" style={{ fontSize: 12, fontWeight: 500, color: "rgba(236,254,255,0.55)" }}>
            {doneCount}/{STEP_ORDER.length} 已完成
          </span>
        </Space>
      }
      extra={
        <Space size={8}>
          {riskCount > 0 && (
            <Tooltip title="需求分析识别出的风险">
              <button type="button" className="hero-chip is-risk" onClick={() => onSelect("analysis")}>
                <WarningFilled /> 风险 {riskCount}
              </button>
            </Tooltip>
          )}
          {unknownCount > 0 && (
            <Tooltip title="需要与产品确认的问题">
              <button type="button" className="hero-chip is-unknown" onClick={onShowUnknowns}>
                <QuestionCircleFilled /> 待确认 {unknownCount}
              </button>
            </Tooltip>
          )}
          {running ? (
            <Button danger icon={<PauseCircleOutlined />} onClick={onStop}>
              停止生成
            </Button>
          ) : (
            <Button className="btn-accent" icon={<RocketOutlined />} onClick={onRunAll}>
              一键生成全部
            </Button>
          )}
        </Space>
      }
      styles={{ body: { padding: "10px 10px 8px" } }}
    >
      <div className="pipeline" role="tablist" aria-label="生成流水线">
        {STEP_ORDER.map((target, index) => {
          const status = statusOf(target);
          const count = countOf(target);
          const sub = status === "done" && count !== null ? `${count} 条` : STATUS_TEXT[status];
          return (
            <button
              key={target}
              type="button"
              role="tab"
              aria-selected={selected === target}
              className={`pipeline-node is-${status}${selected === target ? " is-selected" : ""}`}
              onClick={() => onSelect(target)}
            >
              <span className="pipeline-dot">
                {status === "done" ? <CheckOutlined /> : status === "busy" ? <LoadingOutlined /> : STEP_ICONS[target]}
              </span>
              <span className="pipeline-label">
                <span style={{ opacity: 0.45, fontWeight: 500, marginRight: 4 }}>{String(index + 1).padStart(2, "0")}</span>
                {TARGET_LABELS[target]}
              </span>
              <span className="pipeline-sub">{sub}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

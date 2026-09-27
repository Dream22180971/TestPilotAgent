"use client";

import { Alert, Card, Empty, Space, Tag, Typography } from "antd";
import {
  AimOutlined,
  AppstoreOutlined,
  BulbOutlined,
  CloudUploadOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  NodeIndexOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { TestPlan, TestStrategy } from "@/types/output";
import { NumberedGrid, RichText, ScheduleView, SegmentBlocks, TitledGrid, parseTitledList } from "./StructuredText";
import type { RequirementAnalysis } from "@/types/requirement";

const { Text, Paragraph } = Typography;

function Section({
  icon,
  label,
  count,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span className="icon-tile icon-tile-sm">{icon}</span>
        <Text strong style={{ fontSize: 14, color: "var(--ink)" }}>{label}</Text>
        {count !== undefined && <span className="count-badge">{count}</span>}
      </div>
      {children}
    </div>
  );
}

/** 长条目清单：模型给出的范围描述常是整句，用列表比标签更易读 */
function CheckList({ items, muted = false }: { items: string[]; muted?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {parseTitledList(items).parsed.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.75, color: muted ? "var(--ink-3)" : "var(--ink-2)" }}>
          <span
            style={{
              flexShrink: 0,
              width: 6,
              height: 6,
              borderRadius: "50%",
              marginTop: 9,
              background: muted ? "var(--ink-4)" : "var(--brand)",
            }}
          />
          <span>
            <RichText item={item} />
          </span>
        </div>
      ))}
    </div>
  );
}


function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-value" style={{ color }}>{value}</div>
      <div className="stat-tile-label">{label}</div>
    </div>
  );
}

const EMPTY_STEPS = [
  { icon: <CloudUploadOutlined />, title: "① 输入需求", desc: "左侧粘贴需求，或上传 TXT / MD / PDF / DOCX 文档" },
  { icon: <ThunderboltOutlined />, title: "② AI 生成", desc: "点击「分析需求」或「一键生成全部」" },
  { icon: <FileDoneOutlined />, title: "③ 审阅修订", desc: "查看结果、全屏浏览、追问修订、导出资产" },
];

export function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{ padding: "4px 0" }}>
      <div
        style={{
          background: "linear-gradient(135deg, #E6FBF6 0%, #F7FEFC 100%)",
          border: "1px dashed #99F6E4",
          borderRadius: 12,
          padding: "32px 24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <Text strong style={{ fontSize: 14, color: "#334155" }}>{text}</Text>
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          {EMPTY_STEPS.map((step) => (
            <div
              key={step.title}
              className="empty-step"
              style={{
                flex: "1 1 180px",
                maxWidth: 220,
                background: "#fff",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                boxShadow: "0 1px 2px rgba(15,28,46,0.04)",
              }}
            >
              <div className="icon-tile" style={{ marginBottom: 10 }}>
                {step.icon}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>{step.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: "#64748b" }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnalysisView({ analysis }: { analysis: RequirementAnalysis | null }) {
  if (!analysis) {
    return <EmptyHint text="完成需求分析后，这里展示业务目标、模块划分与风险提示。" />;
  }
  const flows = analysis.core_flows.filter(Boolean);
  const rules = analysis.business_rules.filter(Boolean);
  const risks = analysis.risks.filter(Boolean);
  const constraints = analysis.constraints.filter(Boolean);
  const unknowns = analysis.unknowns.filter(Boolean);

  return (
    <div>
      {/* 业务目标摘要卡 */}
      <div className="goal-hero">
        <Space size={10} style={{ marginBottom: 10 }}>
          <span className="icon-tile">
            <AimOutlined />
          </span>
          <span>
            <Text strong style={{ fontSize: 15, display: "block", lineHeight: 1.3 }}>业务目标</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>AI 从需求中提炼的核心价值</Text>
          </span>
        </Space>
        <Paragraph style={{ fontSize: 14.5, lineHeight: 1.9, marginBottom: 16, color: "var(--ink-2)", position: "relative" }}>
          {analysis.business_goal}
        </Paragraph>
        <Space size={10} wrap>
          <StatPill label="功能模块" value={analysis.modules.length} color="#0F766E" />
          <StatPill label="用户角色" value={analysis.roles.length} color="#7C3AED" />
          <StatPill label="核心流程" value={flows.length} color="#0891B2" />
          <StatPill label="业务规则" value={rules.length} color="#EA580C" />
          <StatPill label="风险" value={risks.length} color="#DC2626" />
          <StatPill label="待确认" value={unknowns.length} color="#D97706" />
        </Space>
      </div>

      <Section icon={<TeamOutlined />} label="用户角色" count={analysis.roles.length}>
        {analysis.roles.map((role, i) => (
          <Tag key={i} color="purple" style={{ marginBottom: 6, padding: "3px 12px", borderRadius: 14 }}>
            {role}
          </Tag>
        ))}
      </Section>

      <Section icon={<AppstoreOutlined />} label="功能模块" count={analysis.modules.length}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {analysis.modules.map((m, i) => (
            <div
              key={i}
              style={{
                border: "1px solid var(--line)",
                borderTop: "3px solid var(--brand-bright)",
                borderRadius: 10,
                padding: "10px 12px",
                background: "var(--surface)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: m.description ? 4 : 0 }}>{m.name}</div>
              {m.description && (
                <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--ink-3)" }}>{m.description}</div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {flows.length > 0 && (
        <Section icon={<NodeIndexOutlined />} label="核心流程" count={flows.length}>
          {flows.map((flow, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "10px 14px",
                background: "#fafbfc",
                border: "1px solid #eef1f5",
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#0D9488",
                  color: "#fff",
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.8, color: "#334155" }}>{flow}</span>
            </div>
          ))}
        </Section>
      )}

      {rules.length > 0 && (
        <Section icon={<CheckSquareOutlined />} label="业务规则" count={rules.length}>
          {rules.map((rule, i) => (
            <div
              key={i}
              style={{
                borderLeft: "3px solid #0D9488",
                background: "#F0FDFA",
                padding: "8px 14px",
                marginBottom: 6,
                fontSize: 13,
                lineHeight: 1.8,
                color: "#334155",
                borderRadius: "0 8px 8px 0",
              }}
            >
              {rule}
            </div>
          ))}
        </Section>
      )}

      {constraints.length > 0 && (
        <Section icon={<BulbOutlined />} label="约束条件" count={constraints.length}>
          <CheckList items={constraints} />
        </Section>
      )}

      {risks.length > 0 && (
        <Section icon={<WarningOutlined />} label="风险提示" count={risks.length}>
          {risks.map((risk, i) => (
            <Alert
              key={i}
              type="warning"
              showIcon
              message={risk}
              style={{ marginBottom: 8, borderRadius: 8 }}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

export function StrategyView({ strategy }: { strategy: TestStrategy | null }) {
  if (!strategy) {
    return <EmptyHint text="尚未生成测试策略。点击上方「生成」开始。" />;
  }
  return (
    <div>
      <Section icon={<AimOutlined />} label="概述">
        <Paragraph style={{ marginBottom: 0 }}>{strategy.overview}</Paragraph>
      </Section>
      <Section icon={<AppstoreOutlined />} label="测试范围" count={strategy.scope.length}>
        <CheckList items={strategy.scope} />
      </Section>
      {strategy.out_of_scope.length > 0 && (
        <Section icon={<CheckSquareOutlined />} label="不在范围内" count={strategy.out_of_scope.length}>
          <CheckList items={strategy.out_of_scope} muted />
        </Section>
      )}
      {strategy.test_levels.length > 0 && (
        <Section icon={<NodeIndexOutlined />} label="测试级别" count={strategy.test_levels.length}>
          <TitledGrid items={strategy.test_levels} />
        </Section>
      )}
      {strategy.test_types.length > 0 && (
        <Section icon={<AppstoreOutlined />} label="测试类型" count={strategy.test_types.length}>
          <TitledGrid items={strategy.test_types} tone="violet" />
        </Section>
      )}
      {strategy.tools_and_env && (
        <Section icon={<BulbOutlined />} label="工具与环境">
          <SegmentBlocks text={strategy.tools_and_env} />
        </Section>
      )}
      {strategy.risks_and_mitigation.length > 0 && (
        <Section icon={<WarningOutlined />} label="风险与缓解措施" count={strategy.risks_and_mitigation.length}>
          {strategy.risks_and_mitigation.map((item, index) => (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                border: "1px solid var(--line)",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 8,
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              <div style={{ padding: "8px 12px", background: "#FEF2F2" }}>
                <Text type="danger" strong style={{ fontSize: 12 }}>风险</Text>
                <div style={{ color: "var(--ink-2)" }}>{item.risk}</div>
              </div>
              <div style={{ padding: "8px 12px", background: "#F0FDF4" }}>
                <Text type="success" strong style={{ fontSize: 12 }}>缓解</Text>
                <div style={{ color: "var(--ink-2)" }}>{item.mitigation}</div>
              </div>
            </div>
          ))}
        </Section>
      )}
      {(strategy.entry_criteria.length > 0 || strategy.exit_criteria.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <Section icon={<CheckSquareOutlined />} label="准入标准" count={strategy.entry_criteria.length}>
            {strategy.entry_criteria.map((item, i) => (
              <div key={i} className="rule-card">{item}</div>
            ))}
          </Section>
          <Section icon={<FileDoneOutlined />} label="准出标准" count={strategy.exit_criteria.length}>
            {strategy.exit_criteria.map((item, i) => (
              <div key={i} className="rule-card">{item}</div>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

export function PlanView({ plan }: { plan: TestPlan | null }) {
  if (!plan) {
    return <EmptyHint text="尚未生成测试计划。点击上方「生成」开始。" />;
  }
  return (
    <div>
      <Section icon={<AimOutlined />} label="计划概述">
        <Paragraph style={{ marginBottom: 0 }}>{plan.overview}</Paragraph>
      </Section>
      <Section icon={<NodeIndexOutlined />} label="阶段安排">
        {plan.phases.map((phase, index) => (
          <Card
            key={index}
            size="small"
            title={
              <Space size={8}>
                <span className="flow-dot">{index + 1}</span>
                {phase.name}
              </Space>
            }
            extra={phase.estimated_days ? <Tag bordered={false} color="cyan">{/\d$/.test(phase.estimated_days) ? `${phase.estimated_days} 天` : phase.estimated_days}</Tag> : null}
            style={{ marginBottom: 8 }}
          >
            <ol className="phase-tasks">
              {phase.tasks.map((task, taskIndex) => (
                <li key={taskIndex}>{task}</li>
              ))}
            </ol>
            {phase.deliverables.length > 0 && (
              <div className="phase-deliverables">
                <span className="phase-deliverables-label">交付物</span>
                {phase.deliverables.map((d, i) => (
                  <Tag key={i} bordered={false} color="cyan" style={{ marginBottom: 4 }}>
                    {d}
                  </Tag>
                ))}
              </div>
            )}
          </Card>
        ))}
      </Section>
      {plan.resource_estimate && (
        <Section icon={<TeamOutlined />} label="资源估算">
          <SegmentBlocks text={plan.resource_estimate} />
        </Section>
      )}
      {plan.schedule_summary && (
        <Section icon={<NodeIndexOutlined />} label="进度安排">
          <ScheduleView text={plan.schedule_summary} />
        </Section>
      )}
      {plan.dependencies.length > 0 && (
        <Section icon={<CheckSquareOutlined />} label="依赖" count={plan.dependencies.length}>
          <NumberedGrid items={plan.dependencies} />
        </Section>
      )}
    </div>
  );
}

export function UnknownsView({ analysis }: { analysis: RequirementAnalysis | null }) {
  if (!analysis || analysis.unknowns.length === 0) {
    return <EmptyHint text="需求分析完成后，待确认项会汇总在这里。" />;
  }
  return (
    <div>
      <Paragraph type="secondary" style={{ fontSize: 13 }}>
        以下问题建议在测试设计前与产品 / 开发确认，确认后可在需求输入中补充并重新生成。
      </Paragraph>
      {analysis.unknowns.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: "10px 14px",
            border: "1px solid var(--line)",
            borderRadius: 10,
            marginBottom: 8,
            background: "var(--surface)",
          }}
        >
          <QuestionCircleOutlined style={{ color: "var(--warning)", marginTop: 4 }} />
          <span style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-2)" }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

const PRIORITY_COLORS: Record<string, string> = { 高: "red", 中: "gold", 低: "green", P0: "red", P1: "volcano", P2: "gold", P3: "green" };

export function PriorityTag({ value }: { value: string }) {
  return (
    <Tag color={PRIORITY_COLORS[value] ?? "default"} bordered={false} style={{ fontWeight: 600, marginInlineEnd: 0 }}>
      {value}
    </Tag>
  );
}

const TYPE_COLORS: Record<string, string> = { 正常: "cyan", 异常: "magenta", 边界: "purple" };

export function TypeTag({ value }: { value: string }) {
  return (
    <Tag color={TYPE_COLORS[value] ?? "default"} bordered={false} style={{ marginInlineEnd: 0 }}>
      {value}
    </Tag>
  );
}

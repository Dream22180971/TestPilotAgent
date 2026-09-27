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
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "#e6f4ff",
            color: "#1677ff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
          }}
        >
          {icon}
        </span>
        <Text strong style={{ fontSize: 14 }}>{label}</Text>
        {count !== undefined && <Tag style={{ borderRadius: 10, fontSize: 11 }}>{count}</Tag>}
      </div>
      {children}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e8eef5",
        borderRadius: 8,
        padding: "4px 14px",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 700, color, marginRight: 6 }}>{value}</span>
      <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
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
    <div style={{ padding: "20px 4px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          background: "linear-gradient(135deg, #e6f4ff 0%, #f5f9ff 100%)",
          border: "1px dashed #b8d4ff",
          borderRadius: 14,
          padding: "26px 24px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <Text strong style={{ fontSize: 14, color: "#334155" }}>{text}</Text>
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          {EMPTY_STEPS.map((step) => (
            <div
              key={step.title}
              style={{
                flex: "1 1 180px",
                maxWidth: 220,
                background: "#fff",
                border: "1px solid #e8eef5",
                borderRadius: 10,
                padding: "14px 16px",
                boxShadow: "0 1px 2px rgba(15,28,46,0.04)",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #1668dc, #4096ff)",
                  color: "#fff",
                  fontSize: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                {step.icon}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1c2e", marginBottom: 4 }}>{step.title}</div>
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
      <div
        style={{
          background: "linear-gradient(135deg, #e6f4ff 0%, #f5f9ff 100%)",
          border: "1px solid #d6e8ff",
          borderRadius: 12,
          padding: "18px 22px",
          marginBottom: 20,
        }}
      >
        <Space size={6} style={{ marginBottom: 8 }}>
          <AimOutlined style={{ color: "#1677ff" }} />
          <Text strong style={{ fontSize: 15 }}>业务目标</Text>
        </Space>
        <Paragraph style={{ fontSize: 14, lineHeight: 1.9, marginBottom: 14 }}>
          {analysis.business_goal}
        </Paragraph>
        <Space size={10} wrap>
          <StatPill label="功能模块" value={analysis.modules.length} color="#1677ff" />
          <StatPill label="用户角色" value={analysis.roles.length} color="#722ed1" />
          <StatPill label="核心流程" value={flows.length} color="#13c2c2" />
          <StatPill label="业务规则" value={rules.length} color="#fa8c16" />
          <StatPill label="风险" value={risks.length} color="#f5222d" />
          <StatPill label="待确认" value={unknowns.length} color="#8c8c8c" />
        </Space>
      </div>

      <Section icon={<TeamOutlined />} label="用户角色" count={analysis.roles.length}>
        {analysis.roles.map((role) => (
          <Tag key={role} color="purple" style={{ marginBottom: 6, padding: "3px 12px", borderRadius: 14 }}>
            {role}
          </Tag>
        ))}
      </Section>

      <Section icon={<AppstoreOutlined />} label="功能模块" count={analysis.modules.length}>
        {analysis.modules.map((m) => (
          <Tag key={m.name} color="processing" style={{ marginBottom: 6, padding: "3px 12px", borderRadius: 14 }}>
            {m.name}
            {m.description ? <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>{m.description}</Text> : null}
          </Tag>
        ))}
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
                  background: "#1677ff",
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
                borderLeft: "3px solid #1677ff",
                background: "#f8fbff",
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
          {constraints.map((c) => (
            <Tag key={c} style={{ marginBottom: 6, padding: "3px 12px" }}>{c}</Tag>
          ))}
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
      <Section icon={<AppstoreOutlined />} label="测试范围">
        {strategy.scope.map((item) => (
          <Tag key={item} style={{ marginBottom: 4 }}>
            {item}
          </Tag>
        ))}
      </Section>
      {strategy.out_of_scope.length > 0 && (
        <Section icon={<CheckSquareOutlined />} label="不在范围内">
          {strategy.out_of_scope.map((item) => (
            <Tag key={item} style={{ marginBottom: 4 }}>
              {item}
            </Tag>
          ))}
        </Section>
      )}
      <Section icon={<NodeIndexOutlined />} label="测试级别 / 类型">
        {strategy.test_levels.map((item) => (
          <Tag key={item} color="blue" style={{ marginBottom: 4 }}>
            {item}
          </Tag>
        ))}
        {strategy.test_types.map((item) => (
          <Tag key={item} color="green" style={{ marginBottom: 4 }}>
            {item}
          </Tag>
        ))}
      </Section>
      <Section icon={<BulbOutlined />} label="工具与环境">
        <Paragraph style={{ marginBottom: 0 }}>{strategy.tools_and_env}</Paragraph>
      </Section>
      {strategy.risks_and_mitigation.length > 0 && (
        <Section icon={<WarningOutlined />} label="风险与缓解措施">
          {strategy.risks_and_mitigation.map((item, index) => (
            <Card key={index} size="small" style={{ marginBottom: 8 }}>
              <Text type="danger">风险：</Text>
              {item.risk}
              <br />
              <Text type="success">缓解：</Text>
              {item.mitigation}
            </Card>
          ))}
        </Section>
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
          <Card key={index} size="small" title={`${index + 1}. ${phase.name}`} extra={<Tag>{phase.estimated_days}</Tag>} style={{ marginBottom: 8 }}>
            {phase.tasks.map((task, taskIndex) => (
              <Paragraph key={taskIndex} style={{ marginBottom: 2 }}>
                {taskIndex + 1}. {task}
              </Paragraph>
            ))}
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              交付物：{phase.deliverables.join("、")}
            </Paragraph>
          </Card>
        ))}
      </Section>
      <Section icon={<BulbOutlined />} label="资源与时间">
        <Paragraph style={{ marginBottom: 2 }}>{plan.resource_estimate}</Paragraph>
        <Paragraph style={{ marginBottom: 0 }}>{plan.schedule_summary}</Paragraph>
      </Section>
      {plan.dependencies.length > 0 && (
        <Section icon={<CheckSquareOutlined />} label="依赖">
          {plan.dependencies.map((item) => (
            <Tag key={item} style={{ marginBottom: 4 }}>
              {item}
            </Tag>
          ))}
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
      {analysis.unknowns.map((item) => (
        <Card key={item} size="small" style={{ marginBottom: 8 }}>
          {item}
        </Card>
      ))}
    </div>
  );
}

export function PriorityTag({ value }: { value: string }) {
  const color = value === "高" ? "red" : value === "中" ? "blue" : "green";
  return <Tag color={color}>{value}</Tag>;
}

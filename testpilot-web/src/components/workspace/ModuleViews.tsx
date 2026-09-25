"use client";

import { Card, Empty, Tag, Typography } from "antd";
import type { TestPlan, TestScripts, TestStrategy, ScriptFile } from "@/types/output";
import type { RequirementAnalysis } from "@/types/requirement";

const { Text, Paragraph } = Typography;

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Text strong style={{ display: "block", marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  );
}

export function EmptyHint({ text }: { text: string }) {
  return <Empty description={text} style={{ padding: "32px 0" }} />;
}

export function AnalysisView({ analysis }: { analysis: RequirementAnalysis | null }) {
  if (!analysis) {
    return <EmptyHint text="完成需求分析后，这里展示业务目标、模块划分与风险提示。" />;
  }
  return (
    <div>
      <Section label="业务目标">
        <Paragraph style={{ marginBottom: 0 }}>{analysis.business_goal}</Paragraph>
      </Section>
      <Section label="用户角色">
        {analysis.roles.map((role) => (
          <Tag key={role} style={{ marginBottom: 4 }}>
            {role}
          </Tag>
        ))}
      </Section>
      <Section label="功能模块">
        {analysis.modules.map((m) => (
          <Tag key={m.name} color="processing" style={{ marginBottom: 4 }}>
            {m.name}
          </Tag>
        ))}
      </Section>
      <Section label="核心流程">
        {analysis.core_flows.map((flow) => (
          <Paragraph key={flow} style={{ marginBottom: 2 }}>
            {flow}
          </Paragraph>
        ))}
      </Section>
      {analysis.business_rules.length > 0 && (
        <Section label="业务规则">
          {analysis.business_rules.map((rule) => (
            <Paragraph key={rule} style={{ marginBottom: 2 }}>
              {rule}
            </Paragraph>
          ))}
        </Section>
      )}
      {analysis.risks.length > 0 && (
        <Section label="风险提示">
          {analysis.risks.map((risk) => (
            <Paragraph key={risk} type="warning" style={{ marginBottom: 2 }}>
              {risk}
            </Paragraph>
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
      <Section label="概述">
        <Paragraph style={{ marginBottom: 0 }}>{strategy.overview}</Paragraph>
      </Section>
      <Section label="测试范围">
        {strategy.scope.map((item) => (
          <Tag key={item} style={{ marginBottom: 4 }}>
            {item}
          </Tag>
        ))}
      </Section>
      {strategy.out_of_scope.length > 0 && (
        <Section label="不在范围内">
          {strategy.out_of_scope.map((item) => (
            <Tag key={item} style={{ marginBottom: 4 }}>
              {item}
            </Tag>
          ))}
        </Section>
      )}
      <Section label="测试级别 / 类型">
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
      <Section label="工具与环境">
        <Paragraph style={{ marginBottom: 0 }}>{strategy.tools_and_env}</Paragraph>
      </Section>
      {strategy.risks_and_mitigation.length > 0 && (
        <Section label="风险与缓解措施">
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
      <Section label="计划概述">
        <Paragraph style={{ marginBottom: 0 }}>{plan.overview}</Paragraph>
      </Section>
      <Section label="阶段安排">
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
      <Section label="资源与时间">
        <Paragraph style={{ marginBottom: 2 }}>{plan.resource_estimate}</Paragraph>
        <Paragraph style={{ marginBottom: 0 }}>{plan.schedule_summary}</Paragraph>
      </Section>
      {plan.dependencies.length > 0 && (
        <Section label="依赖">
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

export function ScriptsView({ scripts }: { scripts: TestScripts | null }) {
  if (!scripts) {
    return <EmptyHint text="尚未生成测试脚本。点击上方「生成」开始。" />;
  }
  return (
    <div>
      <Section label="技术栈">
        <Tag color="blue">{scripts.language}</Tag>
        <Tag color="geekblue">{scripts.framework}</Tag>
      </Section>
      {scripts.files.map((file: ScriptFile, index) => (
        <Card
          key={index}
          size="small"
          title={file.filename}
          style={{ marginBottom: 8 }}
          styles={{ body: { padding: 0 } }}
        >
          <pre
            style={{
              margin: 0,
              padding: 12,
              whiteSpace: "pre-wrap",
              fontSize: 12,
              lineHeight: 1.6,
              maxHeight: 420,
              overflow: "auto",
              background: "#fafafa",
              borderRadius: "0 0 8px 8px",
            }}
          >
            {file.code}
          </pre>
        </Card>
      ))}
      {scripts.setup_instructions && (
        <Section label="运行说明">
          <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
            {scripts.setup_instructions}
          </Paragraph>
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

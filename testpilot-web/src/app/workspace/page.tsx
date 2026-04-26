"use client";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Drawer,
  Input,
  Layout,
  List,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { UploadOutlined } from "@ant-design/icons";
import { useMemo, useRef, useState } from "react";

import {
  analyzeRequirement,
  deleteDocument,
  exportOutput,
  followup,
  generateOutput,
  getDocument,
  listDocuments,
  saveRequirement,
  uploadDocument,
} from "@/services/generation";
import { createProject } from "@/services/project";
import type {
  DocumentRow,
  GenerateOutputResponse,
  ScriptFile,
  TestCaseRow,
  TestPlan,
  TestPointRow,
  TestScripts,
  TestStrategy,
  UploadDocumentResponse,
} from "@/types/output";
import type { RequirementAnalysis } from "@/types/requirement";

const { Header, Content } = Layout;
const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;

const testTypeOptions = ["功能测试", "接口测试", "UI测试", "性能测试", "安全测试"];
const EXPORT_FORMATS = ["json", "markdown", "xlsx"];

const pointColumns: ColumnsType<TestPointRow> = [
  { title: "模块", dataIndex: "module", key: "module", width: 120 },
  { title: "场景", dataIndex: "scenario", key: "scenario", width: 170 },
  { title: "测试点", dataIndex: "point", key: "point" },
  { title: "类型", dataIndex: "type", key: "type", width: 100 },
  {
    title: "优先级",
    dataIndex: "priority",
    key: "priority",
    width: 100,
    render: (value: string) => <Tag color={value === "高" ? "red" : value === "中" ? "blue" : "green"}>{value}</Tag>,
  },
];

const caseColumns: ColumnsType<TestCaseRow> = [
  { title: "ID", dataIndex: "id", key: "id", width: 100 },
  { title: "模块", dataIndex: "module", key: "module", width: 120 },
  { title: "场景", dataIndex: "scenario", key: "scenario", width: 150 },
  { title: "标题", dataIndex: "title", key: "title" },
  {
    title: "优先级",
    dataIndex: "priority",
    key: "priority",
    width: 100,
    render: (value: string) => <Tag color={value === "高" ? "red" : value === "中" ? "blue" : "green"}>{value}</Tag>,
  },
];

function buildDemoAnalysis(
  requirementText: string,
  systemType: string,
  projectId: string | null,
  requirementId: string | null,
): RequirementAnalysis {
  return {
    project_id: projectId ?? "local-demo",
    requirement_id: requirementId ?? "local-demo",
    business_goal: requirementText || "请先输入需求",
    system_type: systemType,
    roles: ["普通用户", "管理员"],
    modules: [
      { name: "登录", description: "围绕登录的需求场景" },
      { name: "商品浏览", description: "围绕商品浏览的需求场景" },
      { name: "下单", description: "围绕下单的需求场景" },
      { name: "支付", description: "围绕支付的需求场景" },
    ],
    core_flows: ["登录-浏览商品-下单-支付"],
    business_rules: [],
    constraints: [],
    risks: ["支付失败后的状态流转需重点校验", "需确认重复提交订单的幂等处理"],
    unknowns: ["未说明退款流程", "未明确库存不足时的提示策略"],
    test_focus: ["优先覆盖支付相关主流程与异常路径"],
  };
}

const demoTestPoints: TestPointRow[] = [
  { id: "demo-1", module: "支付", scenario: "支付成功", point: "验证支付成功后订单状态更新为已支付，并展示成功结果。", type: "正常", priority: "高" },
  { id: "demo-2", module: "支付", scenario: "支付失败", point: "验证支付失败后页面提示失败，订单状态保持待支付。", type: "异常", priority: "高" },
];

const demoTestCases: TestCaseRow[] = [
  {
    id: "CASE-001", module: "支付", scenario: "支付失败",
    title: "验证支付失败后订单状态保持待支付",
    preconditions: ["订单已创建", "用户已登录"],
    steps: ["提交支付请求", "模拟支付失败返回", "刷新订单详情页"],
    expected_results: ["页面提示支付失败", "订单状态保持待支付"],
    priority: "高",
  },
];

export default function WorkspacePage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [projectName, setProjectName] = useState("电商下单测试分析");
  const [systemType, setSystemType] = useState("Web");
  const [scriptLanguage, setScriptLanguage] = useState("Python");
  const [testTypes, setTestTypes] = useState<string[]>(["功能测试", "接口测试"]);
  const [requirementText, setRequirementText] = useState("用户登录后可浏览商品、提交订单并完成支付，支付失败时订单保持待支付状态。");
  const [businessFlow, setBusinessFlow] = useState("登录-浏览商品-下单-支付");
  const [rolesText, setRolesText] = useState("普通用户, 管理员");
  const [nonFunctionalText, setNonFunctionalText] = useState("支付结果返回时间小于3秒");
  const [apiError, setApiError] = useState("");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPoints, setIsGeneratingPoints] = useState(false);
  const [isGeneratingCases, setIsGeneratingCases] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [requirementId, setRequirementId] = useState<string | null>(null);

  const [analysisResult, setAnalysisResult] = useState<RequirementAnalysis | null>(null);
  const [testPoints, setTestPoints] = useState<TestPointRow[]>(demoTestPoints);
  const [testCases, setTestCases] = useState<TestCaseRow[]>(demoTestCases);
  const [testStrategy, setTestStrategy] = useState<TestStrategy | null>(null);
  const [testPlan, setTestPlan] = useState<TestPlan | null>(null);
  const [testScripts, setTestScripts] = useState<TestScripts | null>(null);
  const [generatedOutputs, setGeneratedOutputs] = useState<Record<string, unknown>>({});

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("json");
  const [exportTargets, setExportTargets] = useState<string[]>(["test_points", "test_cases"]);

  const [isExporting, setIsExporting] = useState(false);
  const [isFollowingUp, setIsFollowingUp] = useState<string | null>(null);
  const [followupText, setFollowupText] = useState("");

  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  const analysis = useMemo(
    () => analysisResult ?? buildDemoAnalysis(requirementText, systemType, projectId, requirementId),
    [analysisResult, projectId, requirementId, requirementText, systemType],
  );

  async function ensureProjectAndRequirement(): Promise<{ nextProjectId: string; nextRequirementId: string }> {
    let nextProjectId = projectId;
    let nextRequirementId = requirementId;

    if (!nextProjectId) {
      const project = await createProject({
        name: projectName,
        system_type: systemType,
        test_types: testTypes,
        script_language: scriptLanguage,
        output_language: "中文",
      });
      nextProjectId = project.id;
      setProjectId(project.id);
    }

    if (!nextRequirementId) {
      const savedRequirement = await saveRequirement(nextProjectId, {
        raw_input: requirementText,
        extra_context: {
          business_flow: businessFlow,
          roles: rolesText.split(",").map((item) => item.trim()).filter(Boolean),
          non_functional: nonFunctionalText.split(",").map((item) => item.trim()).filter(Boolean),
        },
      });
      nextRequirementId = savedRequirement.requirement_id;
      setRequirementId(savedRequirement.requirement_id);
    }

    return { nextProjectId, nextRequirementId };
  }

  async function handleAnalyze() {
    if (!projectName.trim()) { messageApi.warning("请先填写项目名称。"); return; }
    if (!requirementText.trim()) { messageApi.warning("请先填写需求描述。"); return; }

    setIsAnalyzing(true);
    setApiError("");

    try {
      const { nextProjectId, nextRequirementId } = await ensureProjectAndRequirement();
      setProjectId(nextProjectId);
      setRequirementId(nextRequirementId);
      const analyzed = await analyzeRequirement(nextProjectId, nextRequirementId);
      setAnalysisResult(analyzed);
      if (nextProjectId) await handleListDocuments(nextProjectId);
      messageApi.success("需求分析已完成。");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "请求失败");
      messageApi.error("调用后端接口失败，请检查 API 服务是否已启动。");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleGeneratePoints() {
    setIsGeneratingPoints(true);
    setApiError("");
    try {
      const { nextProjectId, nextRequirementId } = await ensureProjectAndRequirement();
      const response = await generateOutput(nextProjectId, nextRequirementId, "test_points");
      setTestPoints(response.content.rows ?? []);
      messageApi.success("测试点已生成。");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "请求失败");
      messageApi.error("生成测试点失败。");
    } finally {
      setIsGeneratingPoints(false);
    }
  }

  async function handleGenerateCases() {
    setIsGeneratingCases(true);
    setApiError("");
    try {
      const { nextProjectId, nextRequirementId } = await ensureProjectAndRequirement();
      const response = await generateOutput(nextProjectId, nextRequirementId, "test_cases");
      setTestCases(response.content.cases ?? []);
      messageApi.success("测试用例已生成。");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "请求失败");
      messageApi.error("生成测试用例失败。");
    } finally {
      setIsGeneratingCases(false);
    }
  }

  async function handleGenerateTarget(target: string) {
    setApiError("");
    try {
      const { nextProjectId, nextRequirementId } = await ensureProjectAndRequirement();
      const response = await generateOutput(nextProjectId, nextRequirementId, target);

      if (target === "test_strategy") setTestStrategy(response.content.test_strategy ?? null);
      else if (target === "test_plan") setTestPlan(response.content.test_plan ?? null);
      else if (target === "test_script") setTestScripts(response.content.test_script ?? null);

      setGeneratedOutputs((prev) => ({ ...prev, [target]: response.content }));
      messageApi.success(`"${target}" 已生成。`);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "请求失败");
      messageApi.error(`生成 "${target}" 失败。`);
    }
  }

  async function handleGenerateAll() {
    setIsGeneratingAll(true);
    setApiError("");
    try {
      const { nextProjectId, nextRequirementId } = await ensureProjectAndRequirement();
      const response = await generateOutput(nextProjectId, nextRequirementId, "all");

      const content = response.content;
      if (content.analysis) setAnalysisResult(content.analysis as RequirementAnalysis);
      if (content.test_points) {
        const tp = content.test_points as { rows?: TestPointRow[] };
        setTestPoints(tp.rows ?? []);
      }
      if (content.test_cases) {
        const tc = content.test_cases as { cases?: TestCaseRow[] };
        setTestCases(tc.cases ?? []);
      }
      if (content.test_strategy) setTestStrategy(content.test_strategy as TestStrategy);
      if (content.test_plan) setTestPlan(content.test_plan as TestPlan);
      if (content.test_script) setTestScripts(content.test_script as TestScripts);

      setGeneratedOutputs(content);
      messageApi.success("全部模块已生成。");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "请求失败");
      messageApi.error("全量生成失败。");
    } finally {
      setIsGeneratingAll(false);
    }
  }

  async function handleUpload(file: File): Promise<boolean> {
    try {
      const { nextProjectId } = await ensureProjectAndRequirement();
      const result = await uploadDocument(nextProjectId, file);
      setRequirementText(result.text_preview || requirementText);
      messageApi.success(`文档 "${result.filename}" 已上传并提取文本。`);
      if (nextProjectId) await handleListDocuments(nextProjectId);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "上传失败");
    }
    return false; // prevent default upload behavior
  }

  async function handleListDocuments(projectId: string) {
    try {
      const docs = await listDocuments(projectId);
      setDocuments(docs);
    } catch {
      // silently ignore — no documents is fine
    }
  }

  async function handleDelete(projectId: string, doc: DocumentRow) {
    try {
      await deleteDocument(projectId, doc.document_id);
      messageApi.success(`文档 "${doc.filename}" 已删除。`);
      await handleListDocuments(projectId);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  async function handleFollowup(target: string) {
    if (!followupText.trim()) { messageApi.warning("请输入追问内容。"); return; }
    if (!projectId) { messageApi.warning("请先创建项目。"); return; }

    setIsFollowingUp(target);
    setApiError("");
    const instruction = followupText;
    setFollowupText("");

    try {
      const response = await followup(projectId, target, instruction);
      if (response.status === "not_found") {
        messageApi.warning(`尚未生成 "${target}"，请先点击生成按钮。`);
        return;
      }

      if (target === "test_points") setTestPoints(response.content.rows ?? []);
      else if (target === "test_cases") setTestCases(response.content.cases ?? []);
      else if (target === "test_strategy") setTestStrategy(response.content.test_strategy ?? null);
      else if (target === "test_plan") setTestPlan(response.content.test_plan ?? null);
      else if (target === "test_script") setTestScripts(response.content.test_script ?? null);

      messageApi.success("追问处理完成，输出已更新。");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "请求失败");
      messageApi.error("追问处理失败。");
    } finally {
      setIsFollowingUp(null);
    }
  }

  async function handleExport() {
    if (!projectId) { messageApi.warning("请先创建项目。"); return; }
    if (exportTargets.length === 0) { messageApi.warning("请选择要导出的模块。"); return; }

    setIsExporting(true);
    try {
      await exportOutput(projectId, exportFormat, exportTargets);
      setExportModalOpen(false);
      messageApi.success("导出完成。");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setIsExporting(false);
    }
  }

  const allTargets = ["analysis", "test_strategy", "test_plan", "test_points", "test_cases", "test_script"];

  const strategyContent = testStrategy ? (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <div><Text strong>概述</Text><Paragraph>{testStrategy.overview}</Paragraph></div>
      <div><Text strong>测试范围</Text>{testStrategy.scope.map((s) => <Tag key={s}>{s}</Tag>)}</div>
      {testStrategy.out_of_scope.length > 0 && (
        <div><Text strong>非测试范围</Text>{testStrategy.out_of_scope.map((s) => <Tag key={s}>{s}</Tag>)}</div>
      )}
      <div><Text strong>测试级别</Text>{testStrategy.test_levels.map((s) => <Tag color="blue" key={s}>{s}</Tag>)}</div>
      <div><Text strong>测试类型</Text>{testStrategy.test_types.map((s) => <Tag color="green" key={s}>{s}</Tag>)}</div>
      <div><Text strong>工具与环境</Text><Paragraph>{testStrategy.tools_and_env}</Paragraph></div>
      {testStrategy.risks_and_mitigation.length > 0 && (
        <div>
          <Text strong>风险与缓解措施</Text>
          {testStrategy.risks_and_mitigation.map((item, i) => (
            <Card key={i} size="small" style={{ marginTop: 8 }}>
              <Text type="danger">风险：</Text>{item.risk}<br />
              <Text type="success">缓解：</Text>{item.mitigation}
            </Card>
          ))}
        </div>
      )}
    </Space>
  ) : (
    <Paragraph type="secondary">尚未生成测试策略。点击上方按钮或使用"一键生成全部"。</Paragraph>
  );

  const planContent = testPlan ? (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <div><Text strong>计划概述</Text><Paragraph>{testPlan.overview}</Paragraph></div>
      {testPlan.phases.map((phase, i) => (
        <Card key={i} size="small" title={`${i + 1}. ${phase.name}（${phase.estimated_days}）`}>
          <Paragraph><Text strong>任务：</Text></Paragraph>
          {phase.tasks.map((t, j) => <Paragraph key={j} style={{ marginBottom: 4 }}> - {t}</Paragraph>)}
          <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
            <Text strong>交付物：</Text>{phase.deliverables.join("、")}
          </Paragraph>
        </Card>
      ))}
      <div><Text strong>资源估算</Text><Paragraph>{testPlan.resource_estimate}</Paragraph></div>
      <div><Text strong>时间安排</Text><Paragraph>{testPlan.schedule_summary}</Paragraph></div>
      {testPlan.dependencies.length > 0 && (
        <div><Text strong>依赖</Text>{testPlan.dependencies.map((d) => <Tag key={d}>{d}</Tag>)}</div>
      )}
    </Space>
  ) : (
    <Paragraph type="secondary">尚未生成测试计划。点击上方按钮或使用"一键生成全部"。</Paragraph>
  );

  const scriptContent = testScripts ? (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <div>
        <Text strong>语言：</Text><Tag>{testScripts.language}</Tag>
        <Text strong style={{ marginLeft: 16 }}>框架：</Text><Tag>{testScripts.framework}</Tag>
      </div>
      {testScripts.files.map((file: ScriptFile, i: number) => (
        <Card key={i} size="small" title={file.filename}>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 400, overflow: "auto" }}>
            {file.code}
          </pre>
        </Card>
      ))}
      {testScripts.setup_instructions && (
        <Card size="small" title="运行说明">
          <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{testScripts.setup_instructions}</Paragraph>
        </Card>
      )}
    </Space>
  ) : (
    <Card size="small" title={`${scriptLanguage} 脚本初稿`}>
      <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
        {scriptLanguage === "Python"
          ? `import pytest\n\nclass TestGeneratedCases:\n    def test_placeholder(self):\n        assert True`
          : `import org.junit.jupiter.api.Test;\n\nclass GeneratedCasesTest {\n    @Test\n    void placeholder() {\n        assert true;\n    }\n}`}
      </pre>
    </Card>
  );

  const exportTargetOptions = allTargets.map((t) => ({
    label: { analysis: "需求分析", test_strategy: "测试策略", test_plan: "测试计划", test_points: "测试点", test_cases: "测试用例", test_script: "测试脚本" }[t] || t,
    value: t,
  }));

  return (
    <Layout style={{ minHeight: "100vh", background: "#f3f5f7" }}>
      {contextHolder}
      <Header style={{ background: "#101828", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%" }}>
          <Title level={4} style={{ color: "#fff", margin: 0 }}>TestPilot Workspace</Title>
          <Space>
            {projectId && (
              <Button size="small" icon={<UploadOutlined />} onClick={() => setExportModalOpen(true)}>
                导出
              </Button>
            )}
            <Tag color="blue">MVP</Tag>
            <Text style={{ color: "#cbd5e1" }}>{projectName}</Text>
          </Space>
        </div>
      </Header>
      <Content style={{ padding: 24 }}>
        <Row gutter={16} align="top">
          <Col xs={24} lg={9}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Card title="项目配置" bordered={false}>
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="项目名称" />
                  <Select value={systemType} onChange={setSystemType} options={["Web", "App", "API", "小程序", "后台系统"].map((v) => ({ value: v, label: v }))} />
                  <Select mode="multiple" value={testTypes} onChange={setTestTypes} options={testTypeOptions.map((v) => ({ value: v, label: v }))} />
                  <Select value={scriptLanguage} onChange={setScriptLanguage} options={["Python", "Java"].map((v) => ({ value: v, label: v }))} />
                </Space>
              </Card>

              <Card title="需求输入" bordered={false}>
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Upload accept=".txt,.pdf,.docx" beforeUpload={handleUpload} showUploadList={false}>
                    <Button icon={<UploadOutlined />}>上传文档（TXT/PDF/DOCX）</Button>
                  </Upload>
                  <TextArea rows={8} value={requirementText} onChange={(e) => setRequirementText(e.target.value)} placeholder="请输入需求描述，或上传文档自动提取文本。" />
                  <Input value={businessFlow} onChange={(e) => setBusinessFlow(e.target.value)} placeholder="核心业务流程，例如：登录-浏览商品-下单-支付" />
                  <Input value={rolesText} onChange={(e) => setRolesText(e.target.value)} placeholder="用户角色，逗号分隔" />
                  <Input value={nonFunctionalText} onChange={(e) => setNonFunctionalText(e.target.value)} placeholder="非功能要求，逗号分隔" />
                  {apiError ? <Alert type="error" showIcon message="接口调用失败" description={apiError} /> : null}
                  <Space wrap>
                    <Button type="primary" loading={isAnalyzing} onClick={handleAnalyze}>创建项目并分析需求</Button>
                    <Button loading={isGeneratingPoints} onClick={handleGeneratePoints}>生成测试点</Button>
                    <Button loading={isGeneratingCases} onClick={handleGenerateCases}>生成测试用例</Button>
                    <Button type="primary" ghost loading={isGeneratingAll} onClick={handleGenerateAll}>一键生成全部</Button>
                  </Space>
                  {projectId ? <Text type="secondary">项目 ID：{projectId}</Text> : null}
                  {requirementId ? <Text type="secondary">需求 ID：{requirementId}</Text> : null}
                </Space>
              </Card>

              {projectId ? (
                <Card title="上传文档" bordered={false}>
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Upload accept=".txt,.pdf,.docx" beforeUpload={handleUpload} showUploadList={false}>
                      <Button icon={<UploadOutlined />}>上传新文档（TXT/PDF/DOCX）</Button>
                    </Upload>
                    {documents.length === 0 ? (
                      <Paragraph type="secondary" style={{ textAlign: "center", padding: "16px 0" }}>暂无上传文档。</Paragraph>
                    ) : (
                      documents.map((doc) => (
                        <Card key={doc.document_id} size="small" hoverable
                          bodyStyle={{ padding: "8px 12px" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text strong>{doc.filename}</Text>
                              <div style={{ marginTop: 4 }}>
                                <Tag>{doc.file_format.toUpperCase()}</Tag>
                                {doc.page_count > 0 && <Tag color="blue">{doc.page_count} 页</Tag>}
                                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{doc.status}</Text>
                              </div>
                              {doc.text_preview && (
                                <Paragraph style={{ margin: "8px 0 0", fontSize: 12, marginBottom: 0, lineHeight: 1.5 }}>
                                  {doc.text_preview.slice(0, 120)}{doc.text_preview.length > 120 ? "..." : ""}
                                </Paragraph>
                              )}
                            </div>
                            <Popconfirm title={`删除 "${doc.filename}"?`} onConfirm={() => handleDelete(projectId, doc)}>
                              <Text type="danger" style={{ cursor: "pointer", whiteSpace: "nowrap" }}>删除</Text>
                            </Popconfirm>
                          </div>
                        </Card>
                      ))
                    )}
                  </Space>
                </Card>
              ) : null}
            </Space>
          </Col>

          <Col xs={24} lg={15}>
            <Card bordered={false} styles={{ body: { paddingTop: 12 } }}>
              <Tabs
                items={[
                  {
                    key: "analysis",
                    label: "需求分析",
                    children: (
                      <Space direction="vertical" size={16} style={{ width: "100%" }}>
                        <div><Text strong>业务目标</Text><Paragraph>{analysis.business_goal}</Paragraph></div>
                        <div><Text strong>角色</Text><div style={{ marginTop: 8 }}>{analysis.roles.map((r) => <Tag key={r}>{r}</Tag>)}</div></div>
                        <div><Text strong>功能模块</Text><div style={{ marginTop: 8 }}>{analysis.modules.map((m) => <Tag color="processing" key={m.name}>{m.name}</Tag>)}</div></div>
                        <div><Text strong>核心流程</Text>{analysis.core_flows.map((f) => <Paragraph key={f}>{f}</Paragraph>)}</div>
                        {analysis.business_rules.length > 0 && (
                          <div><Text strong>业务规则</Text>{analysis.business_rules.map((r) => <Paragraph key={r}>{r}</Paragraph>)}</div>
                        )}
                        <div><Text strong>风险提示</Text>{analysis.risks.map((r) => <Paragraph key={r}>{r}</Paragraph>)}</div>
                      </Space>
                    ),
                  },
                  {
                    key: "strategy",
                    label: "测试策略",
                    children: (
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <Space wrap>
                          <Button onClick={() => handleGenerateTarget("test_strategy")} loading={isFollowingUp === "test_strategy"}>生成测试策略</Button>
                        </Space>
                        {strategyContent}
                        <div style={{ marginTop: 16 }}>
                          <Input.TextArea rows={2} value={isFollowingUp === "test_strategy" ? followupText : followupText} onChange={(e) => { setFollowupText(e.target.value); setIsFollowingUp("test_strategy"); }} placeholder="追问：对测试策略进行修改或补充..." />
                          <Button size="small" style={{ marginTop: 8 }} onClick={() => handleFollowup("test_strategy")} loading={isFollowingUp === "test_strategy"}>提交追问</Button>
                        </div>
                      </Space>
                    ),
                  },
                  {
                    key: "plan",
                    label: "测试计划",
                    children: (
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <Space wrap>
                          <Button onClick={() => handleGenerateTarget("test_plan")} loading={isFollowingUp === "test_plan"}>生成测试计划</Button>
                        </Space>
                        {planContent}
                        <div style={{ marginTop: 16 }}>
                          <Input.TextArea rows={2} value={isFollowingUp === "test_plan" ? followupText : followupText} onChange={(e) => { setFollowupText(e.target.value); setIsFollowingUp("test_plan"); }} placeholder="追问：对测试计划进行修改或补充..." />
                          <Button size="small" style={{ marginTop: 8 }} onClick={() => handleFollowup("test_plan")} loading={isFollowingUp === "test_plan"}>提交追问</Button>
                        </div>
                      </Space>
                    ),
                  },
                  {
                    key: "points",
                    label: "测试点",
                    children: (
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <Space wrap>
                          <Button onClick={handleGeneratePoints} loading={isGeneratingPoints}>生成测试点</Button>
                        </Space>
                        <Table columns={pointColumns} dataSource={testPoints} rowKey="id" pagination={false} size="small" />
                        <div style={{ marginTop: 16 }}>
                          <Input.TextArea rows={2} value={isFollowingUp === "test_points" ? followupText : followupText} onChange={(e) => { setFollowupText(e.target.value); setIsFollowingUp("test_points"); }} placeholder="追问：添加更多测试点或修改现有测试点..." />
                          <Button size="small" style={{ marginTop: 8 }} onClick={() => handleFollowup("test_points")} loading={isFollowingUp === "test_points"}>提交追问</Button>
                        </div>
                      </Space>
                    ),
                  },
                  {
                    key: "cases",
                    label: "测试用例",
                    children: (
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <Space wrap>
                          <Button onClick={handleGenerateCases} loading={isGeneratingCases}>生成测试用例</Button>
                        </Space>
                        <Table columns={caseColumns} dataSource={testCases} rowKey="id" pagination={false} size="small" expandable={{
                          expandedRowRender: (record) => (
                            <div style={{ padding: "8px 0" }}>
                              <Paragraph><Text strong>前置条件：</Text>{record.preconditions.join("；")}</Paragraph>
                              <Paragraph><Text strong>步骤：</Text></Paragraph>
                              {record.steps.map((s, i) => <Paragraph key={i} style={{ marginBottom: 2 }}>{i + 1}. {s}</Paragraph>)}
                              <Paragraph style={{ marginTop: 8 }}><Text strong>预期结果：</Text></Paragraph>
                              {record.expected_results.map((r, i) => <Paragraph key={i} style={{ marginBottom: 2 }}>{i + 1}. {r}</Paragraph>)}
                            </div>
                          ),
                        }} />
                        <div style={{ marginTop: 16 }}>
                          <Input.TextArea rows={2} value={isFollowingUp === "test_cases" ? followupText : followupText} onChange={(e) => { setFollowupText(e.target.value); setIsFollowingUp("test_cases"); }} placeholder="追问：添加更多测试用例或修改现有用例..." />
                          <Button size="small" style={{ marginTop: 8 }} onClick={() => handleFollowup("test_cases")} loading={isFollowingUp === "test_cases"}>提交追问</Button>
                        </div>
                      </Space>
                    ),
                  },
                  {
                    key: "script",
                    label: "测试脚本",
                    children: (
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <Space wrap>
                          <Button onClick={() => handleGenerateTarget("test_script")} loading={isFollowingUp === "test_script"}>生成测试脚本</Button>
                        </Space>
                        {scriptContent}
                        <div style={{ marginTop: 16 }}>
                          <Input.TextArea rows={2} value={isFollowingUp === "test_script" ? followupText : followupText} onChange={(e) => { setFollowupText(e.target.value); setIsFollowingUp("test_script"); }} placeholder="追问：修改或补充测试脚本..." />
                          <Button size="small" style={{ marginTop: 8 }} onClick={() => handleFollowup("test_script")} loading={isFollowingUp === "test_script"}>提交追问</Button>
                        </div>
                      </Space>
                    ),
                  },
                  {
                    key: "unknowns",
                    label: "待确认项",
                    children: (
                      <Space direction="vertical" size={8} style={{ width: "100%" }}>
                        {analysis.unknowns.map((item) => (
                          <Card key={item} size="small">{item}</Card>
                        ))}
                        {analysis.unknowns.length === 0 && <Paragraph type="secondary">暂无待确认项。</Paragraph>}
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Content>

      <Modal
        title="导出测试输出"
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        onOk={handleExport}
        confirmLoading={isExporting}
        okText="导出"
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <div>
            <Text strong>导出格式</Text>
            <Select value={exportFormat} onChange={setExportFormat} style={{ width: "100%", marginTop: 4 }}>
              {EXPORT_FORMATS.map((f) => ({ value: f, label: f.toUpperCase() })).map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <Text strong>选择模块</Text>
            <div style={{ marginTop: 4 }}>
              {allTargets.map((t) => (
                <Checkbox
                  key={t}
                  checked={exportTargets.includes(t)}
                  onChange={(e) => {
                    if (e.target.checked) setExportTargets([...exportTargets, t]);
                    else setExportTargets(exportTargets.filter((v) => v !== t));
                  }}
                  style={{ display: "block", marginBottom: 4 }}
                >
                  {{ analysis: "需求分析", test_strategy: "测试策略", test_plan: "测试计划", test_points: "测试点", test_cases: "测试用例", test_script: "测试脚本" }[t] || t}
                </Checkbox>
              ))}
            </div>
          </div>
        </Space>
      </Modal>
    </Layout>
  );
}

"use client";

import {
  Button,
  Card,
  Col,
  Collapse,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Tabs,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  CloudUploadOutlined,
  ExportOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import ExportModal from "@/components/workspace/ExportModal";
import FollowupBox from "@/components/workspace/FollowupBox";
import {
  AnalysisView,
  PlanView,
  ScriptsView,
  StrategyView,
  UnknownsView,
} from "@/components/workspace/ModuleViews";
import { TestCasesTable, TestPointsTable } from "@/components/workspace/AssetTables";
import {
  PIPELINE_TARGETS,
  TARGET_LABELS,
  useWorkspace,
} from "@/hooks/useWorkspace";

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

const SYSTEM_TYPES = ["Web", "App", "API", "小程序", "后台系统"];
const TEST_TYPE_OPTIONS = ["功能测试", "接口测试", "UI测试", "性能测试", "安全测试"];
const SCRIPT_LANGUAGES = ["Python", "Java"];

const STEP_ORDER = ["analysis", ...PIPELINE_TARGETS];

export default function WorkspacePage() {
  const ws = useWorkspace();
  const [activeTab, setActiveTab] = useState("analysis");
  const [exportOpen, setExportOpen] = useState(false);

  // 从历史页打开项目（sessionStorage 传递，避免 SSR 查询参数问题）
  useEffect(() => {
    const openId = sessionStorage.getItem("testpilot:openProjectId");
    if (!openId) return;
    sessionStorage.removeItem("testpilot:openProjectId");
    const target = ws.projects.find((p) => p.id === openId);
    if (target) ws.openProject(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.projects]);

  const stepStatus = (target: string) => {
    const status = ws.moduleStatus(target);
    return status === "done" ? "finish" : status === "busy" ? "process" : "wait";
  };

  const tabToolbar = (target: string) => (
    <Space style={{ marginBottom: 16 }}>
      <Button
        type="primary"
        icon={<PlayCircleOutlined />}
        loading={ws.isBusy(`gen:${target}`)}
        onClick={() => ws.runGenerate(target)}
      >
        {ws.moduleStatus(target) === "done" ? "重新生成" : "生成"}
      </Button>
      {ws.moduleStatus(target) === "done" && <Tag color="success">已生成</Tag>}
    </Space>
  );

  const tabItems = [
    {
      key: "analysis",
      label: TARGET_LABELS.analysis,
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              loading={ws.isBusy("analyze")}
              onClick={ws.runAnalyze}
            >
              {ws.analysis ? "重新分析" : "分析需求"}
            </Button>
            {ws.analysis && <Tag color="success">已分析</Tag>}
          </Space>
          <AnalysisView analysis={ws.analysis} />
        </div>
      ),
    },
    {
      key: "test_strategy",
      label: TARGET_LABELS.test_strategy,
      children: (
        <div>
          {tabToolbar("test_strategy")}
          <StrategyView strategy={ws.testStrategy} />
          <FollowupBox
            targetLabel={TARGET_LABELS.test_strategy}
            loading={ws.isBusy("follow:test_strategy")}
            disabled={!ws.testStrategy}
            onSubmit={(text) => ws.runFollowup("test_strategy", text)}
          />
        </div>
      ),
    },
    {
      key: "test_plan",
      label: TARGET_LABELS.test_plan,
      children: (
        <div>
          {tabToolbar("test_plan")}
          <PlanView plan={ws.testPlan} />
          <FollowupBox
            targetLabel={TARGET_LABELS.test_plan}
            loading={ws.isBusy("follow:test_plan")}
            disabled={!ws.testPlan}
            onSubmit={(text) => ws.runFollowup("test_plan", text)}
          />
        </div>
      ),
    },
    {
      key: "test_points",
      label: TARGET_LABELS.test_points,
      children: (
        <div>
          {tabToolbar("test_points")}
          <TestPointsTable rows={ws.testPoints} />
          <FollowupBox
            targetLabel={TARGET_LABELS.test_points}
            loading={ws.isBusy("follow:test_points")}
            disabled={ws.testPoints.length === 0}
            onSubmit={(text) => ws.runFollowup("test_points", text)}
          />
        </div>
      ),
    },
    {
      key: "test_cases",
      label: TARGET_LABELS.test_cases,
      children: (
        <div>
          {tabToolbar("test_cases")}
          <TestCasesTable rows={ws.testCases} />
          <FollowupBox
            targetLabel={TARGET_LABELS.test_cases}
            loading={ws.isBusy("follow:test_cases")}
            disabled={ws.testCases.length === 0}
            onSubmit={(text) => ws.runFollowup("test_cases", text)}
          />
        </div>
      ),
    },
    {
      key: "test_script",
      label: TARGET_LABELS.test_script,
      children: (
        <div>
          {tabToolbar("test_script")}
          <ScriptsView scripts={ws.testScripts} />
          <FollowupBox
            targetLabel={TARGET_LABELS.test_script}
            loading={ws.isBusy("follow:test_script")}
            disabled={!ws.testScripts}
            onSubmit={(text) => ws.runFollowup("test_script", text)}
          />
        </div>
      ),
    },
    {
      key: "unknowns",
      label: "待确认项",
      children: <UnknownsView analysis={ws.analysis} />,
    },
  ];

  return (
    <AppShell>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {/* 页头 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              测试工作台
            </Title>
            <Text type="secondary">
              上传或粘贴需求，AI 帮你生成测试策略、测试点、用例与脚本，支持追问调整和一键导出。
            </Text>
          </div>
          <Space>
            {ws.projectName.trim() && (
              <Tag color="blue" style={{ marginTop: 6 }}>
                {ws.projectName}
              </Tag>
            )}
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                ws.startNewProject();
                setActiveTab("analysis");
              }}
            >
              新建项目
            </Button>
            <Button
              type="primary"
              ghost
              icon={<ExportOutlined />}
              onClick={() => setExportOpen(true)}
            >
              导出
            </Button>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          {/* 左栏：输入区 */}
          <Col xs={24} lg={8}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Card title="项目设置" size="small">
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  <Input
                    value={ws.projectName}
                    onChange={(e) => ws.setProjectName(e.target.value)}
                    placeholder="项目名称，例如：电商下单测试"
                  />
                  <Row gutter={8}>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>系统类型</Text>
                      <Select
                        value={ws.systemType}
                        onChange={ws.setSystemType}
                        options={SYSTEM_TYPES.map((v) => ({ value: v, label: v }))}
                        style={{ width: "100%", marginTop: 2 }}
                      />
                    </Col>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>脚本语言</Text>
                      <Select
                        value={ws.scriptLanguage}
                        onChange={ws.setScriptLanguage}
                        options={SCRIPT_LANGUAGES.map((v) => ({ value: v, label: v }))}
                        style={{ width: "100%", marginTop: 2 }}
                      />
                    </Col>
                  </Row>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>测试类型</Text>
                    <Select
                      mode="multiple"
                      value={ws.testTypes}
                      onChange={ws.setTestTypes}
                      options={TEST_TYPE_OPTIONS.map((v) => ({ value: v, label: v }))}
                      style={{ width: "100%", marginTop: 2 }}
                      placeholder="测试类型"
                    />
                  </div>
                </Space>
              </Card>

              <Card title="需求输入" size="small">
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  <Upload.Dragger
                    accept=".txt,.pdf,.docx"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      ws.runUpload(file);
                      return false;
                    }}
                    style={{ background: "#fafafa" }}
                  >
                    <p className="ant-upload-drag-icon">
                      <CloudUploadOutlined style={{ color: "#1677ff" }} />
                    </p>
                    <p className="ant-upload-text" style={{ fontSize: 13 }}>
                      点击或拖拽上传需求文档
                    </p>
                    <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                      支持 TXT / PDF / DOCX，上传后自动提取文本
                    </p>
                  </Upload.Dragger>
                  <TextArea
                    rows={8}
                    value={ws.requirementText}
                    onChange={(e) => ws.setRequirementText(e.target.value)}
                    placeholder="或直接粘贴需求描述…"
                  />
                  <Collapse
                    ghost
                    size="small"
                    items={[
                      {
                        key: "context",
                        label: <Text type="secondary">补充上下文（可选）</Text>,
                        children: (
                          <Space direction="vertical" size={8} style={{ width: "100%" }}>
                            <Input
                              value={ws.businessFlow}
                              onChange={(e) => ws.setBusinessFlow(e.target.value)}
                              placeholder="核心业务流程，如：登录-浏览商品-下单-支付"
                            />
                            <Input
                              value={ws.rolesText}
                              onChange={(e) => ws.setRolesText(e.target.value)}
                              placeholder="用户角色，逗号分隔"
                            />
                            <Input
                              value={ws.nonFunctionalText}
                              onChange={(e) => ws.setNonFunctionalText(e.target.value)}
                              placeholder="非功能要求，逗号分隔"
                            />
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Space>
              </Card>

              {ws.projectId && (
                <Card title="需求文档" size="small">
                  {ws.documents.length === 0 ? (
                    <Paragraph type="secondary" style={{ textAlign: "center", margin: "8px 0" }}>
                      <FileTextOutlined style={{ marginRight: 6 }} />
                      暂无上传文档
                    </Paragraph>
                  ) : (
                    ws.documents.map((doc) => (
                      <div
                        key={doc.document_id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 0",
                          borderBottom: "1px solid #f5f5f5",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <Text strong ellipsis style={{ maxWidth: 200 }}>
                            {doc.filename}
                          </Text>
                          <div>
                            <Tag style={{ fontSize: 11 }}>{doc.file_format.toUpperCase()}</Tag>
                            {doc.page_count > 0 && (
                              <Tag color="blue" style={{ fontSize: 11 }}>
                                {doc.page_count} 页
                              </Tag>
                            )}
                          </div>
                        </div>
                        <Popconfirm
                          title={`删除「${doc.filename}」？`}
                          onConfirm={() => ws.runDeleteDocument(doc)}
                        >
                          <Button type="text" danger size="small">
                            删除
                          </Button>
                        </Popconfirm>
                      </div>
                    ))
                  )}
                </Card>
              )}
            </Space>
          </Col>

          {/* 右栏：流水线 + 结果 */}
          <Col xs={24} lg={16}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Card
                title={
                  <Space>
                    <ThunderboltOutlined style={{ color: "#1677ff" }} />
                    生成流水线
                  </Space>
                }
                size="small"
                extra={
                  <Button
                    type="primary"
                    icon={<RocketOutlined />}
                    loading={ws.isBusy("gen:all")}
                    onClick={ws.runGenerateAll}
                  >
                    一键生成全部
                  </Button>
                }
              >
                <Steps
                  size="small"
                  onChange={(index) => setActiveTab(STEP_ORDER[index] ?? "analysis")}
                  current={STEP_ORDER.findIndex((t) => stepStatus(t) === "process")}
                  items={STEP_ORDER.map((target) => ({
                    key: target,
                    title: TARGET_LABELS[target],
                    status: stepStatus(target) as "finish" | "process" | "wait",
                  }))}
                />
                <Row gutter={16} style={{ marginTop: 20 }}>
                  <Col span={6}>
                    <Statistic title="测试点" value={ws.testPoints.length} valueStyle={{ fontSize: 20 }} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="测试用例" value={ws.testCases.length} valueStyle={{ fontSize: 20 }} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="风险提示" value={ws.analysis?.risks.length ?? 0} valueStyle={{ fontSize: 20 }} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="待确认项" value={ws.analysis?.unknowns.length ?? 0} valueStyle={{ fontSize: 20 }} />
                  </Col>
                </Row>
              </Card>

              <Card size="small" styles={{ body: { paddingTop: 4 } }}>
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={tabItems}
                  destroyInactiveTabPane={false}
                />
              </Card>
            </Space>
          </Col>
        </Row>
      </Space>

      <ExportModal
        open={exportOpen}
        exporting={ws.isBusy("export")}
        onClose={() => setExportOpen(false)}
        onExport={async (format, targets) => {
          const ok = await ws.runExport(format, targets);
          if (ok) setExportOpen(false);
        }}
      />
    </AppShell>
  );
}

"use client";

import {
  Button,
  Card,
  Col,
  Collapse,
  Layout,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Tabs,
  Tooltip,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  BulbOutlined,
  CloudUploadOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  EditOutlined,
  ExpandOutlined,
  ExportOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import ExportModal from "@/components/workspace/ExportModal";
import FollowupPanel, { type FollowupRecord } from "@/components/workspace/FollowupPanel";
import {
  AnalysisView,
  PlanView,
  StrategyView,
  UnknownsView,
} from "@/components/workspace/ModuleViews";
import { TestCasesTable, TestPointsTable } from "@/components/workspace/AssetTables";
import TaskPanel from "@/components/workspace/TaskPanel";
import {
  PIPELINE_TARGETS,
  TARGET_LABELS,
} from "@/hooks/useWorkspace";
import { useWorkspaceContext } from "@/components/WorkspaceProvider";

const { TextArea } = Input;
const { Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

// mind-elixir 依赖浏览器 DOM，仅在客户端加载画布
const MindmapView = dynamic(() => import("@/components/workspace/MindmapView"), {
  ssr: false,
  loading: () => <Paragraph type="secondary" style={{ padding: 24 }}>加载画布…</Paragraph>,
});

const SYSTEM_TYPES = ["Web", "App", "API", "小程序", "后台系统"];
const TEST_TYPE_OPTIONS = ["功能测试", "接口测试", "UI测试", "性能测试", "安全测试"];

const STEP_ORDER = ["analysis", ...PIPELINE_TARGETS];

export default function WorkspacePage() {
  const ws = useWorkspaceContext();
  const [activeTab, setActiveTab] = useState("analysis");
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const [fullscreenTab, setFullscreenTab] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // 从历史页打开项目（sessionStorage 传递，避免 SSR 查询参数问题）。
  // 注意：项目列表异步加载，找到目标后才清除标记，否则列表未就绪时打开会丢失。
  useEffect(() => {
    const openId = sessionStorage.getItem("testpilot:openProjectId");
    if (!openId) return;
    if (ws.projects.length === 0) return; // 列表未加载完，等待下次触发
    const target = ws.projects.find((p) => p.id === openId);
    if (target) {
      sessionStorage.removeItem("testpilot:openProjectId");
      ws.openProject(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.projects]);

  const stepStatus = (target: string) => {
    const status = ws.moduleStatus(target);
    return status === "done" ? "finish" : status === "busy" ? "process" : "wait";
  };

  const moduleHeader = (target: string, fullscreen: boolean) => {
    const rounds = ws.followups[target]?.filter((r) => r.status === "done").length ?? 0;
    const runningAll = ws.isBusy("gen:all");
    const status = ws.moduleStatus(target);
    return (
      <Space style={{ marginBottom: 16 }} wrap>
        {target === "analysis" ? (
          <Button
            type="primary"
            loading={ws.isBusy("analyze") || runningAll}
            disabled={runningAll}
            onClick={ws.runAnalyze}
          >
            {ws.analysis ? "重新分析" : "分析需求"}
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={ws.isBusy(`gen:${target}`) || runningAll}
            disabled={runningAll}
            onClick={() => ws.runGenerate(target)}
          >
            {status === "done" ? "重新生成" : "生成"}
          </Button>
        )}
        {status === "done" && <Tag color="success">{target === "analysis" ? "已分析" : "已生成"}</Tag>}
        {rounds > 0 && (
          <Tag color="orange" icon={<EditOutlined />}>
            已修订 {rounds} 轮
          </Tag>
        )}
        {!fullscreen && (
          <Button icon={<ExpandOutlined />} onClick={() => setFullscreenTab(target)}>
            全屏查看
          </Button>
        )}
      </Space>
    );
  };

  const moduleBody = (target: string) => {
    switch (target) {
      case "analysis":
        return <AnalysisView analysis={ws.analysis} />;
      case "test_strategy":
        return <StrategyView strategy={ws.testStrategy} />;
      case "test_plan":
        return <PlanView plan={ws.testPlan} />;
      case "test_points":
        return <TestPointsTable rows={ws.testPoints} />;
      case "test_cases":
        return <TestCasesTable rows={ws.testCases} />;
      case "test_design":
        return <MindmapView markdown={ws.testDesign} />;
      default:
        return null;
    }
  };

  const followupFor = (target: string) => {
    const disabledMap: Record<string, boolean> = {
      test_strategy: !ws.testStrategy,
      test_plan: !ws.testPlan,
      test_points: ws.testPoints.length === 0,
      test_cases: ws.testCases.length === 0,
      test_design: !ws.testDesign,
    };
    if (!(target in disabledMap)) return null;
    return (
      <FollowupPanel
        targetLabel={TARGET_LABELS[target]}
        records={(ws.followups[target] ?? []) as FollowupRecord[]}
        loading={ws.isBusy(`follow:${target}`)}
        disabled={disabledMap[target]}
        onSubmit={(text) => ws.runFollowup(target, text)}
      />
    );
  };

  const tabItems = ["analysis", ...PIPELINE_TARGETS].map((target) => ({
    key: target,
    label: TARGET_LABELS[target],
    children: (
      <div>
        {moduleHeader(target, false)}
        {moduleBody(target)}
        {followupFor(target)}
      </div>
    ),
  })).concat([
    {
      key: "unknowns",
      label: "待确认项",
      children: (
        <div>
          <Space style={{ marginBottom: 16 }} wrap>
            <Button icon={<ExpandOutlined />} onClick={() => setFullscreenTab("unknowns")}>
              全屏查看
            </Button>
          </Space>
          <UnknownsView analysis={ws.analysis} />
        </div>
      ),
    },
  ]);

  const fullscreenTabBody = (target: string) => {
    if (target === "unknowns") return <UnknownsView analysis={ws.analysis} />;
    return (
      <div>
        {moduleHeader(target, true)}
        {moduleBody(target)}
        {followupFor(target)}
      </div>
    );
  };

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
        {/* 页头 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
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

        <Layout style={{ background: "transparent", flex: 1, minHeight: 0 }}>
          {/* 左侧输入面板：可折叠 */}
          <Sider
            width={400}
            collapsedWidth={64}
            collapsed={siderCollapsed}
            theme="light"
            trigger={null}
            style={{
              background: "transparent",
              borderRight: "1px solid #eef1f5",
              paddingRight: siderCollapsed ? 0 : 8,
              overflow: "hidden",
            }}
          >
            <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              {siderCollapsed ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, paddingTop: 12 }}>
                  <Tooltip title="项目设置 / 需求输入（点击展开）" placement="right">
                    <Button type="text" icon={<CloudUploadOutlined />} onClick={() => setSiderCollapsed(false)} />
                  </Tooltip>
                  <Tooltip title={`测试点 ${ws.testPoints.length} · 用例 ${ws.testCases.length}`} placement="right">
                    <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 700, color: "#1677ff", fontSize: 14 }}>{ws.testPoints.length}</div>
                      测试点
                      <div style={{ fontWeight: 700, color: "#1677ff", fontSize: 14, marginTop: 8 }}>{ws.testCases.length}</div>
                      测试用例
                    </div>
                  </Tooltip>
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: "auto", paddingRight: 8, display: "flex", flexDirection: "column" }}>
                  <Space direction="vertical" size={16} style={{ width: "100%", flex: 1 }}>
                    <Card title="项目设置" size="small">
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  <Input
                    value={ws.projectName}
                    onChange={(e) => ws.setProjectName(e.target.value)}
                    placeholder="项目名称，例如：电商下单测试"
                  />
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>系统类型</Text>
                    <Select
                      value={ws.systemType}
                      onChange={ws.setSystemType}
                      options={SYSTEM_TYPES.map((v) => ({ value: v, label: v }))}
                      style={{ width: "100%", marginTop: 2 }}
                    />
                  </div>
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
                    accept=".txt,.md,.pdf,.docx"
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
                      支持 TXT / MD / PDF / DOCX，上传后自动提取文本
                    </p>
                  </Upload.Dragger>
                  <TextArea
                    rows={8}
                    autoSize={{ minRows: 8, maxRows: 24 }}
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

              <div style={{ marginTop: "auto" }}>
                <Card
                  size="small"
                  style={{ background: "linear-gradient(135deg, #e6f4ff 0%, #f5f9ff 100%)", border: "1px solid #d6e8ff" }}
                  title={
                    <Space>
                      <BulbOutlined style={{ color: "#fa8c16" }} />
                      小贴士
                    </Space>
                  }
                >
                  <div style={{ fontSize: 12, lineHeight: 1.9, color: "#475569" }}>
                    · 需求越具体，AI 拆解越精准；补充上下文可提升覆盖度
                    <br />· 生成后可在各模块底部追问修订，每次修订都有记录
                    <br />· 全部完成后用「导出」下载 Markdown / Excel 测试资产
                  </div>
                </Card>
              </div>
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
              </div>
              )}
              <Button
                block
                type="text"
                size="small"
                icon={siderCollapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
                onClick={() => setSiderCollapsed(!siderCollapsed)}
                style={{ borderTop: "1px solid #eef1f5", borderRadius: 0 }}
              >
                {siderCollapsed ? "" : "收起面板"}
              </Button>
            </div>
          </Sider>

          {/* 右栏：流水线 + 结果 */}
          <Content style={{ paddingLeft: 16, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
              <div style={{ flexShrink: 0 }}>
                <TaskPanel task={ws.task} />
              </div>
              <Card
                title={
                  <Space>
                    <ThunderboltOutlined style={{ color: "#1677ff" }} />
                    生成流水线
                  </Space>
                }
                size="small"
                style={{ flexShrink: 0 }}
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

              <Card
                size="small"
                style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
                styles={{ body: { paddingTop: 4, height: "100%", overflowY: "auto" } }}
              >
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={tabItems}
                  destroyInactiveTabPane={false}
                />
              </Card>
            </div>
          </Content>
        </Layout>
      </div>

      <Modal
        title={
          <Space>
            <ExpandOutlined style={{ color: "#1668dc" }} />
            {TARGET_LABELS[fullscreenTab ?? ""] ?? "全屏"} · 全屏查看
          </Space>
        }
        open={Boolean(fullscreenTab)}
        onCancel={() => setFullscreenTab(null)}
        footer={null}
        width="calc(100vw - 64px)"
        style={{ top: 24, paddingBottom: 0 }}
        styles={{ body: { maxHeight: "calc(100vh - 170px)", overflowY: "auto", paddingRight: 8 } }}
      >
        {fullscreenTab && fullscreenTabBody(fullscreenTab)}
      </Modal>
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

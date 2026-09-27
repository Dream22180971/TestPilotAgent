"use client";

import {
  Badge,
  Button,
  Card,
  Collapse,
  Input,
  Layout,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import {
  BulbOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  EditOutlined,
  ExpandOutlined,
  ExportOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import { useWorkspaceContext } from "@/components/WorkspaceProvider";
import { TestCasesTable, TestPointsTable } from "@/components/workspace/AssetTables";
import ExportModal from "@/components/workspace/ExportModal";
import FollowupPanel from "@/components/workspace/FollowupPanel";
import { AnalysisView, PlanView, StrategyView, UnknownsView } from "@/components/workspace/ModuleViews";
import PipelineBoard from "@/components/workspace/PipelineBoard";
import TaskPanel from "@/components/workspace/TaskPanel";
import { STEP_ORDER, TARGET_LABELS } from "@/hooks/useWorkspace";

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

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
    {children}
  </Text>
);

export default function WorkspacePage() {
  const ws = useWorkspaceContext();
  const [activeTab, setActiveTab] = useState("analysis");
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const [fullscreenTab, setFullscreenTab] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // 生成中自动切到正在生成的模块，结果一出来就能看到
  useEffect(() => {
    if (ws.task?.active && ws.task.current) setActiveTab(ws.task.current);
  }, [ws.task?.active, ws.task?.current]);

  const countOf = (target: string): number | null => {
    switch (target) {
      case "analysis":
        return ws.analysis ? ws.analysis.modules.length : null;
      case "test_points":
        return ws.testPoints.length;
      case "test_cases":
        return ws.testCases.length;
      case "test_plan":
        return ws.testPlan ? ws.testPlan.phases.length : null;
      default:
        return null;
    }
  };

  const moduleToolbar = (target: string, fullscreen: boolean) => {
    const rounds = ws.followups[target]?.filter((r) => r.status === "applied").length ?? 0;
    const status = ws.moduleStatus(target);
    const done = ws.hasContent(target);
    const busy = status === "busy" || status === "queued";
    return (
      <div className="module-toolbar">
        <Space size={8} wrap>
          <Tooltip title={ws.taskRunning && !busy ? "有生成任务在进行" : undefined}>
            <Button
              type="primary"
              icon={done ? <ReloadOutlined /> : <PlayCircleOutlined />}
              loading={busy}
              disabled={ws.taskRunning && !busy}
              onClick={() => ws.runGenerate(target)}
            >
              {target === "analysis" ? (done ? "重新分析" : "分析需求") : done ? "重新生成" : `生成${TARGET_LABELS[target]}`}
            </Button>
          </Tooltip>
          {status === "busy" && <Tag color="processing">生成中</Tag>}
          {status === "queued" && <Tag>排队中</Tag>}
          {status === "done" && (
            <Tag color="success" bordered={false}>
              {target === "analysis" ? "已分析" : "已生成"}
            </Tag>
          )}
          {rounds > 0 && (
            <Tag color="cyan" bordered={false} icon={<EditOutlined />}>
              已修订 {rounds} 轮
            </Tag>
          )}
        </Space>
        {!fullscreen && done && (
          <Button type="text" icon={<ExpandOutlined />} onClick={() => setFullscreenTab(target)} style={{ color: "var(--ink-3)" }}>
            全屏
          </Button>
        )}
      </div>
    );
  };

  const moduleBody = (target: string) => {
    const status = ws.moduleStatus(target);
    if (!ws.hasContent(target) && (status === "busy" || status === "queued")) {
      return (
        <div style={{ padding: "8px 4px" }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 16, fontSize: 13 }}>
            {status === "busy"
              ? `AI 正在生成${TARGET_LABELS[target]}，完成后自动显示在这里…`
              : `排队中，前序模块完成后开始生成${TARGET_LABELS[target]}。`}
          </Text>
          <Skeleton active={status === "busy"} paragraph={{ rows: 6 }} />
        </div>
      );
    }
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
    if (target === "analysis") return null;
    return (
      <FollowupPanel
        targetLabel={TARGET_LABELS[target]}
        records={ws.followups[target] ?? []}
        loading={ws.isBusy(`follow:${target}`)}
        disabled={!ws.hasContent(target) || ws.taskRunning}
        isApplying={(id) => ws.isBusy(`apply:${id}`)}
        onSubmit={(text) => ws.runFollowup(target, text)}
        onApply={ws.applyFollowupRecord}
        onDiscard={ws.discardFollowupRecord}
      />
    );
  };

  const modulePane = (target: string, fullscreen: boolean) => (
    <div>
      {moduleToolbar(target, fullscreen)}
      {moduleBody(target)}
      {followupFor(target)}
    </div>
  );

  const tabLabel = (target: string) => {
    const status = ws.moduleStatus(target);
    return (
      <span>
        {TARGET_LABELS[target]}
        {status === "done" && <span className="tab-dot" />}
        {status === "busy" && <span className="tab-dot is-busy" />}
      </span>
    );
  };

  const unknownCount = ws.analysis?.unknowns.length ?? 0;
  const tabItems = [
    ...STEP_ORDER.map((target) => ({ key: target, label: tabLabel(target), children: modulePane(target, false) })),
    {
      key: "unknowns",
      label: (
        <span>
          待确认项
          {unknownCount > 0 && <Badge count={unknownCount} size="small" color="#D97706" style={{ marginLeft: 6 }} />}
        </span>
      ),
      children: <UnknownsView analysis={ws.analysis} />,
    },
  ];

  const contextFilled = [ws.businessFlow, ws.rolesText, ws.nonFunctionalText].filter((v) => v.trim()).length;

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
        {/* 页头 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <Space size={10} align="center">
              <Title level={3} className="page-title">
                测试工作台
              </Title>
              {ws.projectId && (
                <Tag icon={<FolderOpenOutlined />} color="cyan" bordered={false} style={{ fontSize: 13, padding: "2px 10px" }}>
                  {ws.projectName.trim() || "未命名项目"}
                </Tag>
              )}
            </Space>
            <Text type="secondary" style={{ display: "block", fontSize: 13, marginTop: 2 }}>
              粘贴或上传需求，AI 生成测试策略、计划、测试点、用例与测试设计导图，支持追问修订与一键导出。
            </Text>
          </div>
          <Space>
            <Popconfirm
              title="开始新项目？"
              description="当前页面内容会清空，已生成的结果仍可在「项目历史」中找回。"
              okText="新建"
              cancelText="取消"
              disabled={!ws.requirementText.trim() && !ws.projectId}
              onConfirm={() => {
                ws.startNewProject();
                setActiveTab("analysis");
              }}
            >
              <Button
                icon={<PlusOutlined />}
                onClick={() => {
                  if (!ws.requirementText.trim() && !ws.projectId) {
                    ws.startNewProject();
                    setActiveTab("analysis");
                  }
                }}
              >
                新建项目
              </Button>
            </Popconfirm>
            <Button type="primary" icon={<ExportOutlined />} onClick={() => setExportOpen(true)}>
              导出
            </Button>
          </Space>
        </div>

        <Layout style={{ background: "transparent", flex: 1, minHeight: 0 }}>
          {/* 左侧输入面板：可折叠 */}
          <Sider
            width={380}
            collapsedWidth={56}
            collapsed={siderCollapsed}
            theme="light"
            trigger={null}
            style={{ background: "transparent", overflow: "hidden" }}
          >
            <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              {siderCollapsed ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, paddingTop: 8 }}>
                  <Tooltip title="展开需求输入" placement="right">
                    <Button shape="circle" icon={<FileTextOutlined />} onClick={() => setSiderCollapsed(false)} />
                  </Tooltip>
                  <div className="tabular" style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700, color: "var(--brand)", fontSize: 15 }}>{ws.testPoints.length}</div>
                    测试点
                    <div style={{ fontWeight: 700, color: "var(--brand)", fontSize: 15, marginTop: 10 }}>{ws.testCases.length}</div>
                    用例
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: "auto", paddingRight: 12, display: "flex", flexDirection: "column", gap: 14 }}>
                  <Card title="项目设置" size="small">
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <div>
                        <FieldLabel>项目名称</FieldLabel>
                        <Input
                          value={ws.projectName}
                          onChange={(e) => ws.setProjectName(e.target.value)}
                          placeholder="例如：电商下单 V2.3"
                          maxLength={60}
                        />
                      </div>
                      <div>
                        <FieldLabel>系统类型</FieldLabel>
                        <Select
                          mode="multiple"
                          value={ws.systemTypes}
                          onChange={ws.setSystemTypes}
                          options={SYSTEM_TYPES.map((v) => ({ value: v, label: v }))}
                          style={{ width: "100%" }}
                          placeholder="可多选"
                          maxTagCount="responsive"
                        />
                      </div>
                      <div>
                        <FieldLabel>测试类型</FieldLabel>
                        <Select
                          mode="multiple"
                          value={ws.testTypes}
                          onChange={ws.setTestTypes}
                          options={TEST_TYPE_OPTIONS.map((v) => ({ value: v, label: v }))}
                          style={{ width: "100%" }}
                          placeholder="可多选"
                          maxTagCount="responsive"
                        />
                      </div>
                    </Space>
                  </Card>

                  <Card
                    title="需求输入"
                    size="small"
                    extra={
                      ws.requirementText ? (
                        <Space size={4}>
                          <Text type="secondary" className="tabular" style={{ fontSize: 12 }}>
                            {ws.requirementText.length.toLocaleString()} 字
                          </Text>
                          <Popconfirm title="清空需求正文？" okText="清空" cancelText="取消" onConfirm={() => ws.setRequirementText("")}>
                            <Button type="text" size="small" icon={<DeleteOutlined />} aria-label="清空需求" style={{ color: "var(--ink-4)" }} />
                          </Popconfirm>
                        </Space>
                      ) : null
                    }
                  >
                    <Space direction="vertical" size={10} style={{ width: "100%" }}>
                      <Upload.Dragger
                        className="upload-compact"
                        accept=".txt,.md,.markdown,.pdf,.docx"
                        showUploadList={false}
                        disabled={ws.uploading}
                        beforeUpload={(file) => {
                          ws.runUpload(file);
                          return false;
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                          <span className="icon-tile">
                            {ws.uploading ? <LoadingOutlined /> : <CloudUploadOutlined />}
                          </span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
                              {ws.uploading ? "正在解析文档…" : "点击或拖拽上传需求文档"}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>TXT / MD / PDF / DOCX，≤ 10MB，文本自动追加到下方</div>
                          </div>
                        </div>
                      </Upload.Dragger>

                      {ws.documents.map((doc) => (
                        <div key={doc.document_id} className="doc-chip">
                          <FileTextOutlined style={{ color: "var(--brand)" }} />
                          <Text ellipsis style={{ flex: 1, minWidth: 0, fontSize: 12.5 }} title={doc.filename}>
                            {doc.filename}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {doc.file_format.toUpperCase()}
                            {doc.page_count > 0 ? ` · ${doc.page_count} 页` : ""}
                          </Text>
                          <Popconfirm title={`删除「${doc.filename}」？`} okText="删除" cancelText="取消" onConfirm={() => ws.runDeleteDocument(doc)}>
                            <Button type="text" size="small" icon={<DeleteOutlined />} aria-label={`删除 ${doc.filename}`} style={{ color: "var(--ink-4)" }} />
                          </Popconfirm>
                        </div>
                      ))}

                      <TextArea
                        autoSize={{ minRows: 8, maxRows: 18 }}
                        value={ws.requirementText}
                        onChange={(e) => ws.setRequirementText(e.target.value)}
                        placeholder={"或直接粘贴需求描述，例如：\n用户可在商品详情页加入购物车，结算时支持优惠券抵扣，库存不足时提示…"}
                      />
                      <Collapse
                        ghost
                        size="small"
                        items={[
                          {
                            key: "context",
                            label: (
                              <Text type="secondary" style={{ fontSize: 13 }}>
                                补充上下文（可选）
                                {contextFilled > 0 && (
                                  <Tag bordered={false} color="cyan" style={{ marginLeft: 8, fontSize: 11 }}>
                                    已填 {contextFilled}
                                  </Tag>
                                )}
                              </Text>
                            ),
                            children: (
                              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                                <div>
                                  <FieldLabel>核心业务流程</FieldLabel>
                                  <Input value={ws.businessFlow} onChange={(e) => ws.setBusinessFlow(e.target.value)} placeholder="登录 → 浏览商品 → 下单 → 支付" />
                                </div>
                                <div>
                                  <FieldLabel>用户角色（逗号分隔）</FieldLabel>
                                  <Input value={ws.rolesText} onChange={(e) => ws.setRolesText(e.target.value)} placeholder="买家, 商家, 运营" />
                                </div>
                                <div>
                                  <FieldLabel>非功能要求（逗号分隔）</FieldLabel>
                                  <Input value={ws.nonFunctionalText} onChange={(e) => ws.setNonFunctionalText(e.target.value)} placeholder="下单接口 P95 < 300ms, 支持 1000 并发" />
                                </div>
                              </Space>
                            ),
                          },
                        ]}
                      />
                    </Space>
                  </Card>

                  <div style={{ marginTop: "auto", padding: "4px 6px 8px", fontSize: 12, lineHeight: 1.9, color: "var(--ink-3)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                      <span className="icon-tile icon-tile-sm is-accent">
                        <BulbOutlined />
                      </span>
                      小贴士
                    </div>
                    需求越具体，拆解越精准；补充上下文能提升覆盖度。生成后可在各模块底部追问修订，完成后「导出」Excel / Markdown。
                  </div>
                </div>
              )}
              <Button
                block
                type="text"
                size="small"
                icon={siderCollapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
                onClick={() => setSiderCollapsed(!siderCollapsed)}
                style={{ color: "var(--ink-3)", marginTop: 6 }}
              >
                {siderCollapsed ? "" : "收起面板"}
              </Button>
            </div>
          </Sider>

          {/* 右栏：任务 + 流水线 + 结果 */}
          <Content style={{ paddingLeft: 16, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
              {ws.task && (
                <div style={{ flexShrink: 0 }}>
                  <TaskPanel task={ws.task} onStop={ws.stopTask} />
                </div>
              )}
              <div style={{ flexShrink: 0 }}>
                <PipelineBoard
                  statusOf={ws.moduleStatus}
                  countOf={countOf}
                  selected={activeTab}
                  onSelect={setActiveTab}
                  running={ws.taskRunning}
                  onRunAll={ws.runGenerateAll}
                  onStop={ws.stopTask}
                  riskCount={ws.analysis?.risks.length ?? 0}
                  unknownCount={unknownCount}
                  onShowUnknowns={() => setActiveTab("unknowns")}
                />
              </div>

              <Card
                size="small"
                className="results-card"
                style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
                styles={{ body: { height: "100%", overflowY: "auto" } }}
              >
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
              </Card>
            </div>
          </Content>
        </Layout>
      </div>

      <Modal
        title={
          <Space>
            <ExpandOutlined style={{ color: "var(--brand)" }} />
            {TARGET_LABELS[fullscreenTab ?? ""] ?? "全屏"}
          </Space>
        }
        open={Boolean(fullscreenTab)}
        onCancel={() => setFullscreenTab(null)}
        footer={null}
        width="calc(100vw - 64px)"
        style={{ top: 24, paddingBottom: 0 }}
        styles={{ body: { maxHeight: "calc(100vh - 140px)", overflowY: "auto", paddingRight: 8 } }}
        destroyOnClose
      >
        {fullscreenTab && modulePane(fullscreenTab, true)}
      </Modal>
      <ExportModal
        open={exportOpen}
        exporting={ws.isBusy("export")}
        available={STEP_ORDER.filter((t) => ws.hasContent(t))}
        onClose={() => setExportOpen(false)}
        onExport={async (format, targets) => {
          const ok = await ws.runExport(format, targets);
          if (ok) setExportOpen(false);
        }}
      />
    </AppShell>
  );
}

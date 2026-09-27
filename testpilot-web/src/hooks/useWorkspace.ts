"use client";

import { App as AntdApp } from "antd";
import { createContext, useCallback, useEffect, useRef, useState } from "react";

import {
  deleteDocument,
  exportOutput,
  applyFollowup,
  discardFollowup,
  streamFollowup,
  type FollowupRecord,
  listDocuments,
  saveRequirement,
  streamGenerate,
  uploadDocument,
} from "@/services/generation";
import { createProject, getProject, getProjectSnapshot, listProjects } from "@/services/project";
import type { Project } from "@/types/project";
import type { DocumentRow, TestCaseRow, TestPlan, TestPointRow, TestStrategy } from "@/types/output";
import type { RequirementAnalysis } from "@/types/requirement";

/** 生成流水线的目标模块（不含分析） */
export const PIPELINE_TARGETS = [
  "test_strategy",
  "test_plan",
  "test_points",
  "test_cases",
  "test_design",
] as const;

export type PipelineTarget = (typeof PIPELINE_TARGETS)[number];

/** 完整流水线顺序：分析在前，后续模块依赖它 */
export const STEP_ORDER = ["analysis", ...PIPELINE_TARGETS] as string[];

export const TARGET_LABELS: Record<string, string> = {
  analysis: "需求分析",
  test_strategy: "测试策略",
  test_plan: "测试计划",
  test_points: "测试点",
  test_cases: "测试用例",
  test_design: "测试设计",
};

/** empty 未生成 · queued 本次任务待生成 · busy 生成中 · done 已生成 */
export type ModuleStatus = "empty" | "queued" | "busy" | "done";

export interface TaskState {
  active: boolean;
  /** start | llm | rule | fallback | done | error | stopped */
  stage: string;
  message: string;
  /** 本次任务计划生成的模块 */
  targets: string[];
  /** 正在生成的模块 */
  current: string | null;
  /** 本次任务已完成的模块 */
  finished: string[];
  /** 模型思考过程，按模块分段累积 */
  reasoning: Record<string, string>;
  startedAt: number;
  elapsedMs?: number;
}

export type { FollowupRecord };

type Obj = Record<string, unknown>;
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** 旧数据或模型漏字段时补齐数组，避免视图 .map 崩溃 */
function normalizeAnalysis(raw: unknown): RequirementAnalysis {
  const a = (raw ?? {}) as Obj;
  return {
    project_id: str(a.project_id),
    requirement_id: str(a.requirement_id),
    business_goal: str(a.business_goal),
    system_type: str(a.system_type),
    roles: list(a.roles),
    modules: list<unknown>(a.modules).map((m) =>
      typeof m === "string" ? { name: m, description: "" } : { name: str((m as Obj).name), description: str((m as Obj).description) },
    ),
    core_flows: list(a.core_flows),
    business_rules: list(a.business_rules),
    constraints: list(a.constraints),
    risks: list(a.risks),
    unknowns: list(a.unknowns),
    test_focus: list(a.test_focus),
  };
}

function normalizeStrategy(raw: unknown): TestStrategy {
  const s = (raw ?? {}) as Obj;
  return {
    overview: str(s.overview),
    scope: list(s.scope),
    out_of_scope: list(s.out_of_scope),
    test_levels: list(s.test_levels),
    test_types: list(s.test_types),
    tools_and_env: str(s.tools_and_env),
    risks_and_mitigation: list(s.risks_and_mitigation),
    entry_criteria: list(s.entry_criteria),
    exit_criteria: list(s.exit_criteria),
  };
}

function normalizePlan(raw: unknown): TestPlan {
  const p = (raw ?? {}) as Obj;
  return {
    overview: str(p.overview),
    phases: list<Obj>(p.phases).map((ph) => ({
      name: str(ph.name),
      tasks: list(ph.tasks),
      estimated_days: String(ph.estimated_days ?? ""),
      deliverables: list(ph.deliverables),
    })),
    resource_estimate: str(p.resource_estimate),
    schedule_summary: str(p.schedule_summary),
    dependencies: list(p.dependencies),
  };
}

const splitList = (text: string) => text.split(/[,，]/).map((s) => s.trim()).filter(Boolean);

/**
 * 工作台状态机：项目/需求/文档 + 六个生成模块的内容与任务状态。
 * 所有生成结果统一经 applyOutput 写入对应 state。
 */
export function useWorkspace() {
  const { message } = AntdApp.useApp();

  const [projectName, setProjectName] = useState("");
  const [systemTypes, setSystemTypes] = useState<string[]>(["Web"]);
  const [testTypes, setTestTypes] = useState<string[]>(["功能测试"]);
  const [scriptLanguage, setScriptLanguage] = useState("Python");

  const [requirementText, setRequirementText] = useState("");
  const [businessFlow, setBusinessFlow] = useState("");
  const [rolesText, setRolesText] = useState("");
  const [nonFunctionalText, setNonFunctionalText] = useState("");

  const [projectId, setProjectId] = useState<string | null>(null);
  const [requirementId, setRequirementId] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [uploading, setUploading] = useState(false);

  const [analysis, setAnalysis] = useState<RequirementAnalysis | null>(null);
  const [testStrategy, setTestStrategy] = useState<TestStrategy | null>(null);
  const [testPlan, setTestPlan] = useState<TestPlan | null>(null);
  const [testPoints, setTestPoints] = useState<TestPointRow[]>([]);
  const [testCases, setTestCases] = useState<TestCaseRow[]>([]);
  const [testDesign, setTestDesign] = useState<string | null>(null);

  /** loading 字典：follow:<target> | export */
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  /** 每个模块的追问修订记录 */
  /** 追问 / 修订记录（服务端持久化），按模块分组 */
  const [followups, setFollowups] = useState<Record<string, FollowupRecord[]>>({});

  /** 插入或更新一条追问记录（按 id 合并，保留前端累积的思考过程） */
  const upsertFollowup = useCallback((record: FollowupRecord) => {
    setFollowups((prev) => {
      const list = prev[record.target] ?? [];
      const index = list.findIndex((r) => r.id === record.id);
      const next = index >= 0
        ? list.map((r, i) => (i === index ? { ...r, ...record, reasoning: r.reasoning } : r))
        : [...list, record];
      return { ...prev, [record.target]: next };
    });
  }, []);

  const [task, setTask] = useState<TaskState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setBusyKey = useCallback((key: string, value: boolean) => {
    setBusy((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isBusy = useCallback((key: string) => Boolean(busy[key]), [busy]);
  const taskRunning = Boolean(task?.active);

  const loadProjects = useCallback(async () => {
    try {
      const { items } = await listProjects();
      setProjects(items ?? []);
    } catch {
      // 后端未启动时静默，页面用空态引导
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const refreshDocuments = useCallback(async (pid: string) => {
    try {
      setDocuments(await listDocuments(pid));
    } catch {
      setDocuments([]);
    }
  }, []);

  // 已保存需求的签名：正文或上下文变了就重新保存，保证生成始终用最新内容
  const savedSignatureRef = useRef<string | null>(null);
  const signature = (text: string, flow: string, roles: string, nf: string) =>
    JSON.stringify([text, flow, roles, nf]);

  async function ensureProject(): Promise<string> {
    // 自愈：内存里的项目可能已被删除（如清理数据库后未刷新页面）
    if (projectId) {
      try {
        await getProject(projectId);
        return projectId;
      } catch {
        setRequirementId(null);
        savedSignatureRef.current = null;
      }
    }
    const project = await createProject({
      name: projectName.trim() || "未命名项目",
      system_type: systemTypes.join(","),
      test_types: testTypes,
      script_language: scriptLanguage,
      output_language: "中文",
    });
    setProjectId(project.id);
    setRequirementId(null);
    savedSignatureRef.current = null;
    return project.id;
  }

  async function ensureProjectAndRequirement(): Promise<{ pid: string; rid: string }> {
    const pid = await ensureProject();
    const sig = signature(requirementText, businessFlow, rolesText, nonFunctionalText);
    if (requirementId && pid === projectId && savedSignatureRef.current === sig) {
      return { pid, rid: requirementId };
    }
    const saved = await saveRequirement(pid, {
      raw_input: requirementText,
      extra_context: {
        business_flow: businessFlow,
        roles: splitList(rolesText),
        non_functional: splitList(nonFunctionalText),
      },
    });
    setRequirementId(saved.requirement_id);
    savedSignatureRef.current = sig;
    return { pid, rid: saved.requirement_id };
  }

  /** 把某个模块的内容写入对应 state（流式 module_done、追问、历史恢复共用） */
  function applyOutput(target: string, content: unknown) {
    const c = (content ?? {}) as Obj;
    switch (target) {
      case "analysis":
        setAnalysis(normalizeAnalysis(c));
        break;
      case "test_strategy":
        setTestStrategy(normalizeStrategy(c));
        break;
      case "test_plan":
        setTestPlan(normalizePlan(c));
        break;
      case "test_points":
        setTestPoints(list(c.rows));
        break;
      case "test_cases":
        setTestCases(list(c.cases));
        break;
      case "test_design":
        setTestDesign(str(c.markdown) || null);
        break;
    }
  }

  /** 统一的流式生成任务：target 为单个模块或 "all" */
  async function runTask(target: string): Promise<boolean> {
    if (!requirementText.trim()) {
      message.warning("请先填写或上传需求内容。没有需求依据会让 AI 凭空编造测试资产。");
      return false;
    }
    if (taskRunning) {
      message.warning("已有生成任务在进行，请等待完成或先停止。");
      return false;
    }

    const label = target === "all" ? "全部模块" : TARGET_LABELS[target] ?? target;
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = Date.now();
    setTask({
      active: true,
      stage: "start",
      message: "正在准备任务…",
      targets: target === "all" ? STEP_ORDER : [target],
      current: null,
      finished: [],
      reasoning: {},
      startedAt,
    });

    let failure = null as string | null;
    let elapsedMs: number | undefined;
    try {
      const { pid, rid } = await ensureProjectAndRequirement();
      await streamGenerate(
        pid,
        rid,
        target,
        {
          onStatus: (st) =>
            setTask((t) =>
              t && {
                ...t,
                stage: st.stage,
                message: st.message ?? t.message,
                current: st.target ?? t.current,
                targets: st.targets ?? t.targets,
              },
            ),
          onReasoning: (delta, tg) =>
            setTask((t) => t && { ...t, reasoning: { ...t.reasoning, [tg]: (t.reasoning[tg] ?? "") + delta } }),
          onModuleDone: (tg, content) => {
            applyOutput(tg, content);
            setTask((t) =>
              t && {
                ...t,
                finished: [...t.finished, tg],
                // 单模块任务可能先补生成上游（分析 / 测试点），一并计入
                targets: t.targets.includes(tg) ? t.targets : [tg, ...t.targets],
              },
            );
          },
          onDone: (result) => {
            elapsedMs = result.elapsed_ms;
          },
          onError: (msg) => {
            failure = msg;
          },
        },
        controller.signal,
      );
      if (failure) throw new Error(failure);

      const seconds = ((elapsedMs ?? Date.now() - startedAt) / 1000).toFixed(1);
      setTask((t) => t && { ...t, active: false, stage: "done", current: null, message: `${label}已完成 · 用时 ${seconds}s`, elapsedMs });
      message.success(`${label}已生成。`);
      loadProjects();
      refreshDocuments(pid);
      return true;
    } catch (error) {
      if (controller.signal.aborted) {
        setTask((t) => t && { ...t, active: false, stage: "stopped", current: null, message: "已手动停止，已完成的模块已保留", elapsedMs: Date.now() - startedAt });
        message.info("已停止生成。");
        return false;
      }
      const msg = error instanceof Error ? error.message : `生成${label}失败，请确认 API 服务已启动。`;
      message.error(msg);
      setTask((t) => t && { ...t, active: false, stage: "error", current: null, message: msg, elapsedMs: Date.now() - startedAt });
      return false;
    } finally {
      abortRef.current = null;
    }
  }

  const runAnalyze = () => runTask("analysis");
  const runGenerate = (target: string) => runTask(target);
  const runGenerateAll = () => runTask("all");
  const stopTask = () => abortRef.current?.abort();

  /**
   * 追问：AI 先回答 / 给出修订方案（流式显示思考过程），不直接改内容。
   * 有修订方案时由用户在记录里「应用」或「放弃」；每一轮都存为修订记录。
   */
  async function runFollowup(target: string, instruction: string): Promise<boolean> {
    if (!instruction.trim()) {
      message.warning("请先输入追问内容。");
      return false;
    }
    if (!projectId) {
      message.warning("请先生成内容，再进行追问。");
      return false;
    }
    setBusyKey(`follow:${target}`, true);
    let currentId: string | null = null;
    let failure = null as string | null;
    try {
      await streamFollowup(projectId, target, instruction, {
        onRecord: (record) => {
          currentId = record.id;
          upsertFollowup(record);
        },
        onReasoning: (delta) => {
          const id = currentId;
          if (!id) return;
          setFollowups((prev) => ({
            ...prev,
            [target]: (prev[target] ?? []).map((r) => (r.id === id ? { ...r, reasoning: (r.reasoning ?? "") + delta } : r)),
          }));
        },
        onError: (msg) => {
          failure = msg;
        },
      });
      if (failure) throw new Error(failure);
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "追问处理失败。");
      return false;
    } finally {
      setBusyKey(`follow:${target}`, false);
    }
  }

  /** 应用某条追问给出的修订方案 */
  async function applyFollowupRecord(record: FollowupRecord): Promise<void> {
    if (!projectId) return;
    setBusyKey(`apply:${record.id}`, true);
    try {
      const result = await applyFollowup(projectId, record.id);
      applyOutput(record.target, result.content);
      upsertFollowup(result.record);
      message.success(`修订已应用到${TARGET_LABELS[record.target] ?? ""}。`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "应用修订失败。");
    } finally {
      setBusyKey(`apply:${record.id}`, false);
    }
  }

  async function discardFollowupRecord(record: FollowupRecord): Promise<void> {
    if (!projectId) return;
    try {
      upsertFollowup((await discardFollowup(projectId, record.id)).record);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "操作失败。");
    }
  }

  async function runUpload(file: File): Promise<boolean> {
    setUploading(true);
    try {
      const pid = await ensureProject();
      const result = await uploadDocument(pid, file);
      const text = result.text || result.text_preview;
      // 追加而不是覆盖：保留用户已经输入的需求
      if (text) setRequirementText((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${text}` : text));
      await refreshDocuments(pid);
      message.success(`文档「${result.filename}」已上传，文本已追加到需求输入。`);
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传失败。");
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function runDeleteDocument(doc: DocumentRow): Promise<void> {
    if (!projectId) return;
    try {
      await deleteDocument(projectId, doc.document_id);
      await refreshDocuments(projectId);
      message.success(`文档「${doc.filename}」已删除。`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败。");
    }
  }

  async function runExport(format: string, targets: string[]): Promise<boolean> {
    if (!projectId) {
      message.warning("请先创建项目并生成内容。");
      return false;
    }
    if (targets.length === 0) {
      message.warning("请选择要导出的模块。");
      return false;
    }
    setBusyKey("export", true);
    try {
      await exportOutput(projectId, format, targets);
      message.success("导出完成，文件已下载。");
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败。");
      return false;
    } finally {
      setBusyKey("export", false);
    }
  }

  /** 从历史记录打开项目：恢复配置、最近一次需求、文档与已保存的生成结果 */
  async function openProject(project: Project): Promise<void> {
    if (taskRunning) {
      message.warning("当前有生成任务在进行，请完成或停止后再切换项目。");
      return;
    }
    startNewProject();
    setProjectName(project.name);
    setSystemTypes(project.system_type ? String(project.system_type).split(",").map((v) => v.trim()).filter(Boolean) : ["Web"]);
    setTestTypes(project.test_types?.length ? project.test_types : ["功能测试"]);
    setScriptLanguage(project.script_language ?? "Python");
    setProjectId(project.id);
    await refreshDocuments(project.id);

    try {
      const snapshot = await getProjectSnapshot(project.id);
      const req = snapshot.requirement;
      if (req) {
        const ctx = req.extra_context ?? {};
        const flow = ctx.business_flow ?? "";
        const roles = (ctx.roles ?? []).join(", ");
        const nf = (ctx.non_functional ?? []).join(", ");
        setRequirementText(req.raw_input);
        setBusinessFlow(flow);
        setRolesText(roles);
        setNonFunctionalText(nf);
        setRequirementId(req.id);
        savedSignatureRef.current = signature(req.raw_input, flow, roles, nf);
      }
      Object.entries(snapshot.outputs).forEach(([target, content]) => applyOutput(target, content));
      const grouped: Record<string, FollowupRecord[]> = {};
      (snapshot.followups ?? []).forEach((r) => {
        grouped[r.target] = [...(grouped[r.target] ?? []), r];
      });
      setFollowups(grouped);
      const restored = Object.keys(snapshot.outputs).filter((t) => t in TARGET_LABELS).length;
      message.success(
        restored ? `已打开「${project.name}」，恢复了 ${restored} 个模块的生成结果。` : `已打开「${project.name}」。`,
      );
    } catch {
      message.info(`已打开「${project.name}」，未能读取历史生成结果。`);
    }
  }

  /** 开启新工作会话：清空当前项目的所有会话内状态 */
  function startNewProject(): void {
    setProjectId(null);
    setRequirementId(null);
    savedSignatureRef.current = null;
    setProjectName("");
    setRequirementText("");
    setBusinessFlow("");
    setRolesText("");
    setNonFunctionalText("");
    setDocuments([]);
    setAnalysis(null);
    setTestStrategy(null);
    setTestPlan(null);
    setTestPoints([]);
    setTestCases([]);
    setTestDesign(null);
    setFollowups({});
    if (!taskRunning) setTask(null);
  }

  function hasContent(target: string): boolean {
    switch (target) {
      case "analysis":
        return Boolean(analysis);
      case "test_strategy":
        return Boolean(testStrategy);
      case "test_plan":
        return Boolean(testPlan);
      case "test_points":
        return testPoints.length > 0;
      case "test_cases":
        return testCases.length > 0;
      case "test_design":
        return Boolean(testDesign);
      default:
        return false;
    }
  }

  /** 模块状态：驱动流水线看板与按钮 */
  function moduleStatus(target: string): ModuleStatus {
    if (task?.active) {
      if (task.current === target && !task.finished.includes(target)) return "busy";
      if (task.targets.includes(target) && !task.finished.includes(target)) return "queued";
    }
    return hasContent(target) ? "done" : "empty";
  }

  return {
    // 配置表单
    projectName, setProjectName,
    systemTypes, setSystemTypes,
    testTypes, setTestTypes,
    scriptLanguage, setScriptLanguage,
    // 需求输入
    requirementText, setRequirementText,
    businessFlow, setBusinessFlow,
    rolesText, setRolesText,
    nonFunctionalText, setNonFunctionalText,
    // 会话与数据
    projectId,
    requirementId,
    projects,
    documents,
    uploading,
    analysis,
    testStrategy,
    testPlan,
    testPoints,
    testCases,
    testDesign,
    // 动作
    runAnalyze,
    runGenerate,
    runGenerateAll,
    stopTask,
    runFollowup,
    applyFollowupRecord,
    discardFollowupRecord,
    runUpload,
    runDeleteDocument,
    runExport,
    openProject,
    startNewProject,
    // 状态
    isBusy,
    taskRunning,
    moduleStatus,
    hasContent,
    task,
    followups,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;

export const WorkspaceContext = createContext<Workspace | null>(null);

"use client";

import { App as AntdApp } from "antd";
import { createContext, useCallback, useEffect, useRef, useState } from "react";

import {
  analyzeRequirement,
  deleteDocument,
  exportOutput,
  followup,
  generateOutput,
  listDocuments,
  saveRequirement,
  streamGenerate,
  uploadDocument,
} from "@/services/generation";
import { createProject, getProject, listProjects } from "@/services/project";
import type { Project } from "@/types/project";
import type {
  DocumentRow,
  GenerateOutputResponse,
  TestCaseRow,
  TestPlan,
  TestPointRow,
  TestStrategy,
} from "@/types/output";
import type { RequirementAnalysis } from "@/types/requirement";

/** 生成流水线的目标模块（不含分析，分析单独走 analyze 接口） */
export const PIPELINE_TARGETS = [
  "test_strategy",
  "test_plan",
  "test_points",
  "test_cases",
  "test_design",
] as const;

export type PipelineTarget = (typeof PIPELINE_TARGETS)[number];

export const TARGET_LABELS: Record<string, string> = {
  analysis: "需求分析",
  test_strategy: "测试策略",
  test_plan: "测试计划",
  test_points: "测试点",
  test_cases: "测试用例",
  test_design: "测试设计",
};

export type ModuleStatus = "empty" | "busy" | "done";

/**
 * 工作台状态机：项目/需求/文档 + 六个生成模块的内容与加载状态。
 * 生成结果的分发统一走 applyGenerated，避免调用点各自拆包。
 */
export function useWorkspace() {
  const { message } = AntdApp.useApp();

  const [projectName, setProjectName] = useState("");
  const [systemType, setSystemType] = useState("Web");
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

  const [analysis, setAnalysis] = useState<RequirementAnalysis | null>(null);
  const [testStrategy, setTestStrategy] = useState<TestStrategy | null>(null);
  const [testPlan, setTestPlan] = useState<TestPlan | null>(null);
  const [testPoints, setTestPoints] = useState<TestPointRow[]>([]);
  const [testCases, setTestCases] = useState<TestCaseRow[]>([]);
  const [testDesign, setTestDesign] = useState<string | null>(null);

  /** 统一 loading 字典：analyze | gen:<target> | follow:<target> | export */
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  /**
   * 当前生成任务：实时阶段消息 + 模型思考过程（流式累积）。
   * reasoning 按 target 分段保存，生成完成后保留供回看。
   */
  const [task, setTask] = useState<{
    active: boolean;
    stage: string;
    message: string;
    reasoning: Record<string, string>;
    elapsedMs?: number;
  } | null>(null);

  const setBusyKey = useCallback((key: string, value: boolean) => {
    setBusy((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isBusy = useCallback((key: string) => Boolean(busy[key]), [busy]);

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

  // 已保存需求时的正文快照：文本变了就重新保存，保证分析/生成始终用最新内容
  const savedTextRef = useRef<string | null>(null);

  async function ensureProjectAndRequirement(): Promise<{
    nextProjectId: string;
    nextRequirementId: string;
  }> {
    let nextProjectId = projectId;
    let nextRequirementId = requirementId;

    // 自愈：内存里的项目可能已被删除（如清理数据库后未刷新页面）
    if (nextProjectId) {
      try {
        await getProject(nextProjectId);
      } catch {
        nextProjectId = null;
        nextRequirementId = null;
        setProjectId(null);
        setRequirementId(null);
        savedTextRef.current = null;
      }
    }

    if (!nextProjectId) {
      const project = await createProject({
        name: projectName.trim() || "未命名项目",
        system_type: systemType,
        test_types: testTypes,
        script_language: scriptLanguage,
        output_language: "中文",
      });
      nextProjectId = project.id;
      setProjectId(project.id);
      savedTextRef.current = null;
    }

    // 需求正文/上下文有变化（或首次）时重新保存，替换旧的需求记录
    const contextSignature = JSON.stringify([businessFlow, rolesText, nonFunctionalText]);
    if (!nextRequirementId || savedTextRef.current !== `${requirementText}\u0000${contextSignature}`) {
      const saved = await saveRequirement(nextProjectId, {
        raw_input: requirementText,
        extra_context: {
          business_flow: businessFlow,
          roles: rolesText.split(",").map((s) => s.trim()).filter(Boolean),
          non_functional: nonFunctionalText.split(",").map((s) => s.trim()).filter(Boolean),
        },
      });
      nextRequirementId = saved.requirement_id;
      setRequirementId(saved.requirement_id);
      savedTextRef.current = `${requirementText}\u0000${contextSignature}`;
    }

    return { nextProjectId, nextRequirementId };
  }

  /** 把某个 target 的生成结果写入对应 state。
   *  兼容两种包装：全量响应 content.{target} = 模块内容；单模块事件 content 即模块内容。 */
  function applyGenerated(response: GenerateOutputResponse) {
    const content = response.content;
    const unwrap = <T,>(v: T | undefined, fallback: T): T => v ?? fallback;

    switch (response.target) {
      case "analysis": {
        const a = unwrap(content.analysis, content as unknown as RequirementAnalysis);
        if (a) setAnalysis(a);
        break;
      }
      case "test_strategy":
        setTestStrategy(unwrap(content.test_strategy, content as unknown as TestStrategy));
        break;
      case "test_plan":
        setTestPlan(unwrap(content.test_plan, content as unknown as TestPlan));
        break;
      case "test_points": {
        const pts = content.test_points ?? content;
        setTestPoints(pts.rows ?? content.rows ?? []);
        break;
      }
      case "test_cases": {
        const cs = content.test_cases ?? content;
        setTestCases(cs.cases ?? content.cases ?? []);
        break;
      }
      case "test_design": {
        const md = content.test_design ?? content;
        setTestDesign(md.markdown ?? content.markdown ?? null);
        break;
      }
    }
  }

  async function runAnalyze(): Promise<boolean> {
    if (!requirementText.trim()) {
      message.warning("请先填写或上传需求内容。");
      return false;
    }
    setBusyKey("analyze", true);
    setTask({ active: true, stage: "start", message: "任务开始", reasoning: {} });
    try {
      const { nextProjectId, nextRequirementId } = await ensureProjectAndRequirement();
      await streamGenerate(nextProjectId, nextRequirementId, "analysis", {
        onStatus: (st) => setTask((t) => (t ? { ...t, stage: st.stage, message: st.message ?? t.message } : t)),
        onReasoning: (delta, target) =>
          setTask((t) => {
            if (!t) return t;
            const merged = (t.reasoning[target] ?? "") + delta;
            return { ...t, reasoning: { ...t.reasoning, [target]: merged } };
          }),
        onModuleDone: (target, content) => {
          if (target === "analysis") setAnalysis(content as RequirementAnalysis);
        },
        onDone: () => setTask((t) => (t ? { ...t, active: false, stage: "done", message: "需求分析完成" } : t)),
        onError: (msg) => {
          message.error(msg);
          setTask((t) => (t ? { ...t, active: false, stage: "error", message: msg } : t));
        },
      });
      await refreshDocuments(nextProjectId);
      await loadProjects();
      message.success("需求分析完成。");
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "需求分析失败，请确认 API 服务已启动。");
      setTask((t) => (t ? { ...t, active: false, stage: "error", message: "需求分析失败" } : t));
      return false;
    } finally {
      setBusyKey("analyze", false);
    }
  }

  async function runGenerate(target: string): Promise<boolean> {
    if (target === "analysis") return runAnalyze();
    if (!requirementText.trim()) {
      message.warning("请先填写或上传需求内容，再生成。没有需求依据会让 AI 凭空编造测试资产。");
      return false;
    }
    setBusyKey(`gen:${target}`, true);
    setTask({ active: true, stage: "start", message: "任务开始", reasoning: {} });
    try {
      const { nextProjectId, nextRequirementId } = await ensureProjectAndRequirement();
      await streamGenerate(nextProjectId, nextRequirementId, target, {
        onStatus: (st) => setTask((t) => (t ? { ...t, stage: st.stage, message: st.message ?? t.message } : t)),
        onReasoning: (delta, tg) =>
          setTask((t) => {
            if (!t) return t;
            const merged = (t.reasoning[tg] ?? "") + delta;
            return { ...t, reasoning: { ...t.reasoning, [tg]: merged } };
          }),
        onModuleDone: (tg, content) =>
          applyGenerated({ project_id: nextProjectId, target: tg, requirement_id: nextRequirementId, status: "completed", content: content as never }),
        onDone: (result) =>
          setTask((t) => (t ? { ...t, active: false, stage: "done", message: `生成完成，用时 ${(result.elapsed_ms ?? 0) / 1000}s`, elapsedMs: result.elapsed_ms } : t)),
        onError: (msg) => {
          message.error(msg);
          setTask((t) => (t ? { ...t, active: false, stage: "error", message: msg } : t));
        },
      });
      message.success(`${TARGET_LABELS[target] ?? target} 已生成。`);
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : `生成 ${TARGET_LABELS[target] ?? target} 失败。`);
      setTask((t) => (t ? { ...t, active: false, stage: "error", message: "生成失败" } : t));
      return false;
    } finally {
      setBusyKey(`gen:${target}`, false);
    }
  }

  async function runGenerateAll(): Promise<boolean> {
    if (!requirementText.trim()) {
      message.warning("请先填写或上传需求内容，再生成。没有需求依据会让 AI 凭空编造测试资产。");
      return false;
    }
    setBusyKey("gen:all", true);
    setTask({ active: true, stage: "start", message: "任务开始", reasoning: {} });
    try {
      const { nextProjectId, nextRequirementId } = await ensureProjectAndRequirement();
      await streamGenerate(nextProjectId, nextRequirementId, "all", {
        onStatus: (st) => setTask((t) => (t ? { ...t, stage: st.stage, message: st.message ?? t.message } : t)),
        onReasoning: (delta, target) =>
          setTask((t) => {
            if (!t) return t;
            const merged = (t.reasoning[target] ?? "") + delta;
            return { ...t, reasoning: { ...t.reasoning, [target]: merged } };
          }),
        onModuleDone: (target, content) =>
          applyGenerated({ project_id: nextProjectId, target, requirement_id: nextRequirementId, status: "completed", content: content as never }),
        onDone: (result) =>
          setTask((t) => (t ? { ...t, active: false, stage: "done", message: `全部完成，用时 ${(result.elapsed_ms ?? 0) / 1000}s`, elapsedMs: result.elapsed_ms } : t)),
        onError: (msg) => {
          message.error(msg);
          setTask((t) => (t ? { ...t, active: false, stage: "error", message: msg } : t));
        },
      });
      await refreshDocuments(nextProjectId);
      await loadProjects();
      message.success("全部模块已生成。");
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "一键生成失败。");
      setTask((t) => (t ? { ...t, active: false, stage: "error", message: "一键生成失败" } : t));
      return false;
    } finally {
      setBusyKey("gen:all", false);
    }
  }

  /** 追问：instruction 由各模块自己的输入框提供（模块间互不串扰） */
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
    try {
      const response = await followup(projectId, target, instruction);
      if (response.status === "not_found") {
        message.warning(`尚未生成「${TARGET_LABELS[target] ?? target}」，请先生成。`);
        return false;
      }
      applyGenerated(response);
      message.success("已按追问更新输出。");
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "追问处理失败。");
      return false;
    } finally {
      setBusyKey(`follow:${target}`, false);
    }
  }

  async function runUpload(file: File): Promise<boolean> {
    try {
      const { nextProjectId } = await ensureProjectAndRequirement();
      const result = await uploadDocument(nextProjectId, file);
      if (result.text) setRequirementText(result.text);
      else if (result.text_preview) setRequirementText(result.text_preview);
      await refreshDocuments(nextProjectId);
      message.success(`文档「${result.filename}」已上传并提取文本。`);
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传失败。");
      return false;
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

  /** 从历史记录打开项目：恢复配置与文档（生成结果不可回读，需重新生成） */
  async function openProject(project: Project): Promise<void> {
    startNewProject();
    savedTextRef.current = null;
    setProjectName(project.name);
    setSystemType(project.system_type);
    setTestTypes(project.test_types?.length ? project.test_types : ["功能测试"]);
    setScriptLanguage(project.script_language ?? "Python");
    setProjectId(project.id);
    await refreshDocuments(project.id);
    message.info(`已打开项目「${project.name}」。历史生成结果需重新生成。`);
  }

  /** 开启新工作会话：清空当前项目的所有会话内状态 */
  function startNewProject(): void {
    setProjectId(null);
    setRequirementId(null);
    savedTextRef.current = null;
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
  }

  /** 模块状态：驱动 Steps 流水线 */
  function moduleStatus(target: string): ModuleStatus {
    if (isBusy(`gen:${target}`) || isBusy("gen:all")) return "busy";
    switch (target) {
      case "analysis":
        return analysis ? "done" : "empty";
      case "test_strategy":
        return testStrategy ? "done" : "empty";
      case "test_plan":
        return testPlan ? "done" : "empty";
      case "test_points":
        return testPoints.length > 0 ? "done" : "empty";
      case "test_cases":
        return testCases.length > 0 ? "done" : "empty";
      case "test_design":
        return testDesign ? "done" : "empty";
      default:
        return "empty";
    }
  }

  return {
    // 配置表单
    projectName, setProjectName,
    systemType, setSystemType,
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
    runFollowup,
    runUpload,
    runDeleteDocument,
    runExport,
    openProject,
    startNewProject,
    // 状态
    isBusy,
    moduleStatus,
    task,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;

export const WorkspaceContext = createContext<Workspace | null>(null);

"use client";

import { useContext } from "react";

import { WorkspaceContext, useWorkspace, type Workspace } from "@/hooks/useWorkspace";

/**
 * 全局工作台 Provider：挂在根布局（layout 跨页面导航不卸载），
 * 让生成任务（SSE 流、进度、结果）在切换到项目历史等页面后继续存活。
 */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const value = useWorkspace();
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** 页面消费入口：必须在 WorkspaceProvider 内使用 */
export function useWorkspaceContext(): Workspace {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
  return ctx;
}

import type { RequirementAnalysis } from "@/types/requirement";

export interface TestPointRow {
  id: string;
  module: string;
  scenario: string;
  point: string;
  type: string;
  priority: string;
}

export interface TestCaseRow {
  id: string;
  module: string;
  scenario: string;
  title: string;
  preconditions: string[];
  steps: string[];
  expected_results: string[];
  priority: string;
}

export interface TestStrategy {
  overview: string;
  scope: string[];
  out_of_scope: string[];
  test_levels: string[];
  test_types: string[];
  tools_and_env: string;
  risks_and_mitigation: { risk: string; mitigation: string }[];
  entry_criteria: string[];
  exit_criteria: string[];
}

export interface TestPhase {
  name: string;
  tasks: string[];
  estimated_days: string;
  deliverables: string[];
}

export interface TestPlan {
  overview: string;
  phases: TestPhase[];
  resource_estimate: string;
  schedule_summary: string;
  dependencies: string[];
}

export interface GenerateOutputResponse {
  project_id: string;
  target: string;
  requirement_id: string;
  status: string;
  content: {
    rows?: TestPointRow[];
    cases?: TestCaseRow[];
    analysis?: RequirementAnalysis;
    test_points?: { rows?: TestPointRow[] };
    test_cases?: { cases?: TestCaseRow[] };
    test_strategy?: TestStrategy;
    test_plan?: TestPlan;
    test_design?: { markdown?: string };
    markdown?: string;
  };
}

export interface UploadDocumentResponse {
  project_id: string;
  document_id: string;
  filename: string;
  file_format: string;
  text_preview: string;
  /** 提取的完整文本（text_preview 是前 500 字预览） */
  text?: string;
  page_count: number;
  status: string;
}

export interface DocumentRow {
  document_id: string;
  filename: string;
  file_format: string;
  text_preview: string;
  page_count: number;
  status: string;
}

export interface ExportResponse {
  project_id: string;
  format: string;
  status: string;
  data?: unknown;
}

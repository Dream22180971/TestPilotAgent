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

export interface ScriptFile {
  filename: string;
  language: string;
  code: string;
}

export interface TestScripts {
  language: string;
  framework: string;
  files: ScriptFile[];
  setup_instructions: string;
}

export interface GenerateOutputResponse {
  project_id: string;
  target: string;
  requirement_id: string;
  status: string;
  content: {
    rows?: TestPointRow[];
    cases?: TestCaseRow[];
    analysis?: Record<string, unknown>;
    test_points?: Record<string, unknown>;
    test_cases?: Record<string, unknown>;
    test_strategy?: TestStrategy;
    test_plan?: TestPlan;
    test_script?: TestScripts;
  };
}

export interface UploadDocumentResponse {
  project_id: string;
  document_id: string;
  filename: string;
  file_format: string;
  text_preview: string;
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

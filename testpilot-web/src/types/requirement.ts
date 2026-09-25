export interface RequirementAnalysis {
  project_id: string;
  requirement_id: string;
  business_goal: string;
  system_type: string;
  roles: string[];
  modules: Array<{ name: string; description: string }>;
  core_flows: string[];
  business_rules: string[];
  constraints: string[];
  risks: string[];
  unknowns: string[];
  test_focus: string[];
}

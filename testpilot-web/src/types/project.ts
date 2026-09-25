export type SystemType = "Web" | "App" | "API" | "小程序" | "后台系统";
export type ScriptLanguage = "Python" | "Java";

export interface Project {
  id: string;
  name: string;
  system_type: SystemType | string;
  test_types: string[];
  script_language: ScriptLanguage | string;
  output_language: string;
  created_at?: string;
  updated_at?: string;
  last_generated_module?: string | null;
}

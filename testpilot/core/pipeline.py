"""Generation pipeline orchestrator: requirement -> analysis -> strategy -> plan -> points -> cases -> scripts."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable
from sqlalchemy.orm import Session

from testpilot.core import rule_engine as rule
from testpilot.core.db_store import DatabaseStore
from testpilot.core.document_parser import parse_document
from testpilot.core.llm_generation import analyze_with_llm, generate_with_llm

TARGETS = ["analysis", "test_strategy", "test_plan", "test_points", "test_cases", "test_script"]
TARGET_LABELS = {
    "analysis": "需求分析",
    "test_strategy": "测试策略",
    "test_plan": "测试计划",
    "test_points": "测试点",
    "test_cases": "测试用例",
    "test_script": "测试脚本",
}

StageCallback = Callable[[str, str, "dict | None"], None]


class Pipeline:

    def __init__(self, session: Session, on_stage: StageCallback | None = None):
        self.db = session
        self.store = DatabaseStore()
        self.on_stage = on_stage

    def _emit(self, target: str, status: str, content: dict | None = None) -> None:
        if self.on_stage:
            self.on_stage(target, status, content)

    def run(
        self,
        name: str,
        requirement_text: str,
        documents: list[tuple[str, bytes]] | None = None,
        system_type: str = "Web 应用",
        test_types: list[str] | None = None,
        script_language: str = "Python",
        output_language: str = "中文",
    ) -> dict:
        project = self.store.create_project(self.db, {
            "name": name,
            "system_type": system_type,
            "test_types": test_types or ["功能测试"],
            "script_language": script_language,
            "output_language": output_language,
        })
        project_id = project["id"]
        requirement = self.store.save_requirement(self.db, project_id, requirement_text, {})

        doc_context = self._ingest_documents(project_id, documents)

        engine = "rule"
        self._emit("analysis", "running")
        analysis = analyze_with_llm(project, requirement, doc_context)
        if analysis is not None:
            engine = "llm"
        else:
            analysis = rule.build_analysis(project, requirement)
        self.store.save_output(self.db, project_id, "analysis", analysis)
        self._emit("analysis", "done", analysis)

        outputs: dict[str, Any] = {"analysis": analysis}
        for target in TARGETS[1:]:
            self._emit(target, "running")
            prev = self.store.get_output(self.db, project_id, target)
            prev_content = prev["content"] if prev else None
            content = generate_with_llm(project, requirement, target, str(analysis), prev_content, doc_context)
            if content is None:
                content = self._rule_fallback(target, project, analysis, outputs)
            else:
                engine = "llm"
            self.store.save_output(self.db, project_id, target, content)
            outputs[target] = content
            self._emit(target, "done", content)

        return {
            "project": project,
            "requirement_id": requirement["id"],
            "outputs": outputs,
            "engine": engine,
        }

    def _ingest_documents(self, project_id: str, documents: list[tuple[str, bytes]] | None) -> dict | None:
        if not documents:
            return None
        filenames: list[str] = []
        texts: list[str] = []
        for filename, content_bytes in documents:
            ext = Path(filename).suffix or ".txt"
            parsed = parse_document(content_bytes, ext, filename)
            file_format = ext.lstrip(".").lower() or "txt"
            self.store.save_document(
                self.db, project_id, filename, file_format,
                parsed["text"], parsed["text"][:500], parsed["page_count"],
            )
            filenames.append(filename)
            texts.append(f"[File: {filename}] {parsed['text']}")
        return {
            "has_documents": True,
            "filenames": filenames,
            "combined_text": "\n\n---\n\n".join(texts),
        }

    def _rule_fallback(self, target: str, project: dict, analysis: dict, outputs: dict) -> dict:
        if target == "test_strategy":
            return rule.generate_test_strategy(project, analysis)
        if target == "test_plan":
            return rule.generate_test_plan(analysis)
        if target == "test_points":
            return rule.generate_test_points(analysis)
        if target == "test_cases":
            return rule.generate_test_cases(outputs.get("test_points", {"rows": []}))
        if target == "test_script":
            return rule.generate_test_script(project, analysis)
        return {}


def run_standalone(**kwargs) -> dict:
    from testpilot.core.database import SessionLocal, create_tables
    create_tables()
    on_stage = kwargs.pop("on_stage", None)
    with SessionLocal() as session:
        return Pipeline(session, on_stage=on_stage).run(**kwargs)

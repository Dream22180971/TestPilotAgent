"""TestPilot TUI — 测试人的终端工作台 (Textual)."""

from __future__ import annotations

from pathlib import Path

from textual import on
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical, VerticalScroll
from textual.widgets import (
    DataTable,
    Footer,
    Header,
    Input,
    ListItem,
    ListView,
    Label,
    Markdown,
    RichLog,
    Static,
    TabbedContent,
    TabPane,
)

from testpilot import __version__
from testpilot.core.config import llm_settings, load_env
from testpilot.core.database import SessionLocal, create_tables
from testpilot.core.db_store import DatabaseStore
from testpilot.core.exporter import TARGET_LABELS, export_to_files, render_markdown
from testpilot.core.pipeline import TARGETS

DOC_EXTS = {".txt", ".md", ".pdf", ".docx"}
PRIORITY_LABEL = {"高": "P0", "中": "P1", "低": "P2"}


class TestPilotApp(App):

    TITLE = "TestPilot"
    CSS = """
    Screen { background: #0d1117; }
    #main { height: 1fr; }
    #sidebar { width: 36; background: #0d1117; border-right: solid #21262d; padding: 0 1; }
    .panel-title { color: #3fb950; text-style: bold; background: #161b22; padding: 0 1; margin: 1 0 0 0; }
    #file-list { height: 1fr; border: round #30363d; background: #0d1117; }
    #project-list { height: 1fr; border: round #30363d; background: #0d1117; margin-bottom: 1; }
    #content { width: 1fr; padding: 0 1; }
    #stage-panel { height: auto; max-height: 60%; padding: 1 1 0 1; }
    .stage { color: #8b949e; width: 1fr; }
    .stage.running { color: #d29922; text-style: bold; }
    .stage.done { color: #3fb950; }
    #log { border: round #30363d; height: 1fr; }
    #ask-input { border: tall #3fb950; background: #0d1117; margin: 0 1; }
    #ask-input:focus { background: #161b22; }
    DataTable { background: #0d1117; }
    """

    BINDINGS = [
        Binding("q", "quit", "退出"),
        Binding("g", "generate", "生成"),
        Binding("r", "refresh", "刷新"),
        Binding("e", "export", "导出"),
        Binding("slash", "focus_ask", "追问"),
        Binding("1", "show_tab('tab-pipeline')", "流水线"),
        Binding("2", "show_tab('tab-cases')", "用例"),
        Binding("3", "show_tab('tab-detail')", "详情"),
        Binding("escape", "blur_ask", "返回"),
    ]

    def __init__(self) -> None:
        super().__init__()
        self.current_project: dict | None = None
        self.outputs: dict = {}
        self._file_paths: list[str] = []
        self._project_ids: list[str] = []

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal(id="main"):
            with Vertical(id="sidebar"):
                yield Label("需求文件  [dim](g 生成)[/]", classes="panel-title", markup=True)
                yield ListView(id="file-list")
                yield Label("历史项目  [dim](回车载入)[/]", classes="panel-title", markup=True)
                yield ListView(id="project-list")
            with Vertical(id="content"):
                with TabbedContent(initial="tab-pipeline"):
                    with TabPane("流水线", id="tab-pipeline"):
                        with VerticalScroll(id="stage-panel"):
                            for target in TARGETS:
                                yield Static(f"○ {TARGET_LABELS[target]}", id=f"stage-{target}", classes="stage", markup=False)
                        yield RichLog(id="log", markup=True, wrap=True)
                    with TabPane("测试用例", id="tab-cases"):
                        yield DataTable(id="case-table", cursor_type="row", zebra_stripes=True)
                    with TabPane("输出详情", id="tab-detail"):
                        yield Markdown(id="detail", markdown="*生成或载入项目后，这里展示完整测试资产*")
        yield Input(id="ask-input", placeholder="追问：补充短信验证码过期场景（回车发送 · esc 返回）")
        yield Footer()

    def on_mount(self) -> None:
        load_env()
        create_tables()
        settings = llm_settings()
        engine = f"LLM · {settings['model']}" if settings["available"] else "规则引擎（设 DASHSCOPE_API_KEY 启用大模型）"
        self.sub_title = f"测试人的 AI 工作台 · 引擎: {engine}"

        table = self.query_one("#case-table", DataTable)
        table.add_columns("用例", "优先级", "模块", "场景", "标题")

        log = self.query_one("#log", RichLog)
        log.write(f"[bold green]⚡ TestPilot v{__version__}[/] — 测试人的 AI 工作台")
        log.write(f"[dim]引擎: {engine}[/]")
        log.write("[dim]快捷键: g 生成 · e 导出 · / 追问 · 1/2/3 切换页签 · q 退出[/]")
        if not settings["available"]:
            log.write("[yellow]当前为规则引擎模式，生成的是基础骨架，配置 API Key 后由大模型深度生成[/]")

        self._scan_files()
        self._load_projects()

    def _scan_files(self) -> None:
        lv = self.query_one("#file-list", ListView)
        lv.clear()
        self._file_paths = []
        files = sorted(
            (p for p in Path.cwd().iterdir() if p.is_file() and p.suffix.lower() in DOC_EXTS),
            key=lambda p: p.name.lower(),
        )
        for f in files:
            self._file_paths.append(str(f))
            lv.append(ListItem(Label(f.name)))
        if not files:
            self._file_paths.append("")
            lv.append(ListItem(Label("（当前目录无需求文档）")))

    def _load_projects(self) -> None:
        lv = self.query_one("#project-list", ListView)
        lv.clear()
        self._project_ids = []
        with SessionLocal() as session:
            projects = DatabaseStore().list_projects(session)
        for p in projects[:50]:
            self._project_ids.append(p["id"])
            lv.append(ListItem(Label(p["name"])))
        if not projects:
            self._project_ids.append("")
            lv.append(ListItem(Label("（暂无历史）")))

    @on(ListView.Selected, "#file-list")
    def _file_selected(self, event: ListView.Selected) -> None:
        path = self._file_paths[event.index] if event.index < len(self._file_paths) else ""
        if path and Path(path).suffix.lower() in DOC_EXTS:
            self._log_line(f"[dim]已选中 {path} · 按 g 开始生成[/]")

    @on(ListView.Selected, "#project-list")
    def _project_selected(self, event: ListView.Selected) -> None:
        pid = self._project_ids[event.index] if event.index < len(self._project_ids) else ""
        if pid:
            self.load_project(pid)

    def load_project(self, project_id: str) -> None:
        store = DatabaseStore()
        with SessionLocal() as session:
            project = store.get_project(session, project_id)
            if not project:
                self._log_line(f"[red]项目 {project_id} 不存在[/]")
                return
            outputs = {t: rec["content"] for t, rec in store.list_outputs(session, project_id).items()}
        self.current_project = project
        self.outputs = outputs
        self._fill_cases(outputs)
        self._render_detail(project["name"], outputs)
        self._log_line(f"[green]✓[/] 已载入 [bold]{project['name']}[/]（{project_id}）")
        self.query_one(TabbedContent).active = "tab-cases"

    def _fill_cases(self, outputs: dict) -> None:
        table = self.query_one("#case-table", DataTable)
        table.clear()
        cases = outputs.get("test_cases", {}).get("cases", [])
        for c in cases:
            prio = PRIORITY_LABEL.get(str(c.get("priority", "中")), str(c.get("priority", "")))
            table.add_row(c.get("id", ""), prio, c.get("module", ""), c.get("scenario", ""), c.get("title", ""))

    def _render_detail(self, name: str, outputs: dict) -> None:
        self.query_one("#detail", Markdown).update(render_markdown(name, outputs))

    def _log_line(self, text: str) -> None:
        self.query_one("#log", RichLog).write(text)

    def action_generate(self) -> None:
        lv = self.query_one("#file-list", ListView)
        if lv.highlighted is None or lv.highlighted >= len(self._file_paths) or not self._file_paths[lv.highlighted]:
            self.notify("先在左侧选中一份需求文档", title="TestPilot", severity="warning")
            return
        path = Path(self._file_paths[lv.highlighted])
        for target in TARGETS:
            static = self.query_one(f"#stage-{target}", Static)
            static.update(f"○ {TARGET_LABELS[target]}")
            static.remove_classes(["running", "done"])
        self._log_line(f"[bold]▶ 开始生成 {path.name}[/]")
        self.query_one(TabbedContent).active = "tab-pipeline"
        self.run_worker(self._generate_worker(path), thread=True, exclusive=True)

    def _generate_worker(self, path: Path) -> None:
        from testpilot.core import pipeline as core_pipeline

        def on_stage(target: str, status: str, content=None) -> None:
            self.call_from_thread(self._on_stage_ui, target, status)

        raw = path.read_bytes()
        if path.suffix.lower() in {".pdf", ".docx"}:
            documents = [(path.name, raw)]
            requirement_text = ""
        else:
            documents = None
            requirement_text = raw.decode("utf-8", errors="replace")

        result = core_pipeline.run_standalone(
            name=path.stem,
            requirement_text=requirement_text,
            documents=documents,
            on_stage=on_stage,
        )
        self.call_from_thread(self._on_done_ui, result)

    def _on_stage_ui(self, target: str, status: str) -> None:
        static = self.query_one(f"#stage-{target}", Static)
        label = TARGET_LABELS.get(target, target)
        static.remove_classes(["running", "done"])
        if status == "running":
            static.update(f"● {label} …")
            static.add_class("running")
        else:
            static.update(f"✓ {label}")
            static.add_class("done")
            self._log_line(f"[green]✓[/] {label} 已生成")

    def _on_done_ui(self, result: dict) -> None:
        self.current_project = result["project"]
        self.outputs = result["outputs"]
        project = result["project"]
        n_cases = len(result["outputs"].get("test_cases", {}).get("cases", []))
        self._fill_cases(result["outputs"])
        self._render_detail(project["name"], result["outputs"])
        self._load_projects()
        self._log_line(
            f"[bold green]■ 完成[/] {project['name']}（{project['id']}）· 用例 {n_cases} 条 · 引擎 {result['engine']}"
        )
        self.notify(f"生成完成 · {n_cases} 条用例 · 引擎 {result['engine']}", title="TestPilot")
        self.query_one(TabbedContent).active = "tab-cases"

    def action_export(self) -> None:
        if not self.current_project or not self.outputs:
            self.notify("先生成或载入一个项目", title="TestPilot", severity="warning")
            return
        out_dir = Path("testpilot-output")
        written = export_to_files(self.current_project["name"], self.outputs, out_dir)
        for p in written:
            self._log_line(f"[cyan]→[/] 已导出 {p}")
        self.notify(f"已导出 {len(written)} 个文件到 {out_dir}\\", title="TestPilot")

    def action_refresh(self) -> None:
        self._scan_files()
        self._load_projects()
        self._log_line("[dim]已刷新文件与项目列表[/]")

    def action_focus_ask(self) -> None:
        self.query_one("#ask-input", Input).focus()

    def action_blur_ask(self) -> None:
        if isinstance(self.focused, Input):
            self.query_one("#file-list", ListView).focus()

    def action_show_tab(self, tab_id: str) -> None:
        self.query_one(TabbedContent).active = tab_id

    @on(Input.Submitted, "#ask-input")
    def _ask_submitted(self, event: Input.Submitted) -> None:
        text = event.value.strip()
        event.input.value = ""
        if not text:
            return
        if not self.current_project:
            self._log_line("[yellow]先生成或载入一个项目，再追问[/]")
            return
        self._log_line(f"[bold]›[/] {text}")
        self.run_worker(self._ask_worker(text), thread=True, exclusive=False)

    def _ask_worker(self, text: str) -> None:
        from testpilot.core.followup import process_followup

        if not llm_settings()["available"]:
            self.call_from_thread(self._log_line, "[yellow]追问需要大模型（未检测到 API Key）[/]")
            return

        project_id = self.current_project["id"] if self.current_project else ""
        with SessionLocal() as session:
            result = process_followup(session, project_id, "test_cases", text)
        self.call_from_thread(self._after_ask, result)

    def _after_ask(self, result: dict) -> None:
        if result.get("note"):
            self._log_line(f"[yellow]{result['note']}[/]")
            return
        content = result.get("content")
        if content and self.outputs is not None:
            self.outputs["test_cases"] = content
            self._fill_cases(self.outputs)
            self._log_line("[green]✓[/] 测试用例已按指令更新（e 导出 · 3 看详情）")


def run() -> None:
    TestPilotApp().run()


if __name__ == "__main__":
    run()

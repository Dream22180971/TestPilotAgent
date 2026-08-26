from __future__ import annotations

import pathlib
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

app = typer.Typer(add_completion=False, help="TestPilot — 测试人的 AI 工作台 (TUI + CLI)")
console = Console()


@app.callback(invoke_without_command=True)
def _root(ctx: typer.Context) -> None:
    if ctx.invoked_subcommand is None:
        from testpilot.tui.app import TestPilotApp
        TestPilotApp().run()


@app.command()
def gen(
    path: pathlib.Path = typer.Argument(..., exists=True, dir_okay=False, help="需求文档 (txt/md/pdf/docx)"),
    name: Optional[str] = typer.Option(None, help="项目名，默认取文件名"),
    out_dir: pathlib.Path = typer.Option(pathlib.Path("testpilot-output"), help="导出目录"),
) -> None:
    """从需求文档生成全套测试资产（无头模式，可进 CI）"""
    from testpilot.core import pipeline as core_pipeline
    from testpilot.core.config import llm_settings
    from testpilot.core.exporter import TARGET_LABELS, export_to_files

    settings = llm_settings()
    project_name = name or path.stem
    engine_label = f"LLM ({settings['model']})" if settings["available"] else "规则引擎"
    console.print(Panel.fit(f"[bold green]TestPilot[/] · [bold]{project_name}[/] · 引擎: {engine_label}"))

    def on_stage(target: str, status: str, content=None) -> None:
        label = TARGET_LABELS.get(target, target)
        if status == "running":
            console.print(f"  [dim]…[/] {label}")
        else:
            console.print(f"  [green]✓[/] {label}")

    raw = path.read_bytes()
    if path.suffix.lower() in {".pdf", ".docx"}:
        documents = [(path.name, raw)]
        requirement_text = ""
    else:
        documents = None
        requirement_text = raw.decode("utf-8", errors="replace")

    with console.status("生成中…"):
        result = core_pipeline.run_standalone(
            name=project_name,
            requirement_text=requirement_text,
            documents=documents,
            on_stage=on_stage,
        )

    written = export_to_files(project_name, result["outputs"], out_dir)
    n_cases = len(result["outputs"].get("test_cases", {}).get("cases", []))
    console.print(f"\n[bold green]完成[/] 项目 {result['project']['id']} · 测试用例 {n_cases} 条 · 引擎 {result['engine']}")
    for p in written:
        console.print(f"  [cyan]→[/] {p}")
    console.print("[dim]提示: tpa 进入终端工作台 · tpa history 看历史 · tpa ask 继续追问[/]")


@app.command()
def history() -> None:
    """查看项目生成历史"""
    from testpilot.core.database import SessionLocal, create_tables
    from testpilot.core.db_store import DatabaseStore

    create_tables()
    with SessionLocal() as session:
        projects = DatabaseStore().list_projects(session)

    table = Table(title="TestPilot 项目历史")
    for col in ["项目 ID", "名称", "系统类型", "最近生成", "更新时间"]:
        table.add_column(col)
    for p in projects:
        table.add_row(
            p["id"],
            p["name"],
            p.get("system_type", ""),
            p.get("last_generated_module") or "-",
            (p.get("updated_at") or "")[:19],
        )
    console.print(table)
    if not projects:
        console.print("[dim]暂无记录，先用 tpa gen <需求文档> 生成[/]")


@app.command()
def ask(
    instruction: str = typer.Argument(..., help="追问指令，如：补充短信验证码过期场景"),
    project: str = typer.Option(..., "-p", help="项目 ID（tpa history 查看）"),
    target: str = typer.Option("test_cases", "-t", help="目标模块"),
) -> None:
    """对已有输出追问调整（需要大模型）"""
    from testpilot.core.config import llm_settings
    from testpilot.core.database import SessionLocal, create_tables
    from testpilot.core.followup import process_followup

    settings = llm_settings()
    if not settings["available"]:
        console.print("[yellow]追问需要大模型，请先设置 DASHSCOPE_API_KEY[/]")
        raise typer.Exit(1)

    create_tables()
    with SessionLocal() as session:
        result = process_followup(session, project, target, instruction)

    if result.get("status") == "not_found":
        console.print(f"[red]{result['detail']}[/]")
        raise typer.Exit(1)
    console.print(f"[green]✓[/] 已按指令更新 [bold]{target}[/]（项目 {project}）")


@app.command()
def config() -> None:
    """查看配置与引擎状态"""
    from testpilot.core.config import llm_settings
    from testpilot.core.database import DATABASE_URL

    s = llm_settings()
    key = s["api_key"]
    masked = (key[:6] + "…" + key[-4:]) if len(key) > 12 else ("已设置" if key else "未设置")

    table = Table(title="TestPilot 配置")
    table.add_column("项")
    table.add_column("值")
    table.add_row("引擎", f"[green]LLM[/] ({s['model']})" if s["available"] else "[yellow]规则引擎[/]（未检测到 API Key）")
    table.add_row("API Key", masked)
    table.add_row("Base URL", s["base_url"])
    table.add_row("数据库", DATABASE_URL)
    console.print(table)
    console.print("[dim]配置来源: 环境变量 或 .env（当前目录 / ~/.testpilot/.env）[/]")


def main() -> None:
    import sys
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass
    app()


if __name__ == "__main__":
    main()

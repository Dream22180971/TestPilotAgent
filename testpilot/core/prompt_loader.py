"""Load and render prompt templates from the package prompts directory."""

from pathlib import Path

_PROMPT_DIR = Path(__file__).resolve().parent.parent / "prompts"


def load_prompt(name: str) -> str:
    path = _PROMPT_DIR / f"{name}.txt"
    return path.read_text(encoding="utf-8")


def render_prompt(name: str, **kwargs: str) -> str:
    template = load_prompt(name)
    return template.format(**kwargs)

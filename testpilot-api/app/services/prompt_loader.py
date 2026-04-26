"""Load and render prompt templates from the prompts directory."""

import os

_PROMPT_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")


def load_prompt(name: str) -> str:
    """Load a prompt template by filename (without .txt extension)."""
    path = os.path.join(_PROMPT_DIR, f"{name}.txt")
    with open(path, encoding="utf-8") as f:
        return f.read()


def render_prompt(name: str, **kwargs: str) -> str:
    """Load a prompt template and substitute {placeholders}."""
    template = load_prompt(name)
    return template.format(**kwargs)

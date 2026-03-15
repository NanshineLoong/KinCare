from __future__ import annotations

from app.ai.tools import draft_tools, read_tools, suggest_tools, write_tools


def register_tools(agent: object) -> None:
    read_tools.register(agent)
    write_tools.register(agent)
    draft_tools.register(agent)
    suggest_tools.register(agent)

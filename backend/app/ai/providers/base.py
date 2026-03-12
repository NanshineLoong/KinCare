from __future__ import annotations

from typing import Protocol


class AIProvider(Protocol):
    def generate_text(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        fallback_text: str,
    ) -> str: ...

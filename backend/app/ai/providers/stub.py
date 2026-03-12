from __future__ import annotations


class StubProvider:
    def generate_text(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        fallback_text: str,
    ) -> str:
        return fallback_text

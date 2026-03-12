from __future__ import annotations

from typing import Any

import httpx

from app.core.config import Settings


class OpenAICompatibleProvider:
    def __init__(self, settings: Settings) -> None:
        self._api_key = settings.ai_api_key
        self._base_url = settings.ai_base_url
        self._model = settings.ai_model

    def generate_text(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        fallback_text: str,
    ) -> str:
        if not self._api_key or not self._base_url:
            return fallback_text

        try:
            response = httpx.post(
                f"{self._base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.2,
                },
                timeout=15,
            )
            response.raise_for_status()
        except httpx.HTTPError:
            return fallback_text

        payload: dict[str, Any] = response.json()
        choices = payload.get("choices")
        if not isinstance(choices, list) or not choices:
            return fallback_text

        message = choices[0].get("message")
        if not isinstance(message, dict):
            return fallback_text
        content = message.get("content")
        return str(content).strip() or fallback_text

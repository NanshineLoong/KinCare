from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import importlib
import mimetypes
import os
from tempfile import NamedTemporaryFile
from typing import Any, Protocol

import httpx
from fastapi import HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.core.config import Settings


class TranscriptionConfigError(RuntimeError):
    pass


class TranscriptionProviderError(RuntimeError):
    pass


class TranscriptionProvider(Protocol):
    def transcribe_audio(
        self,
        content: bytes,
        *,
        filename: str | None,
        content_type: str | None,
    ) -> str: ...


@dataclass(frozen=True)
class OpenAITranscriptionProvider:
    base_url: str
    api_key: str
    model: str
    language: str | None = None
    prompt: str | None = None
    timeout_seconds: float = 30.0

    def transcribe_audio(
        self,
        content: bytes,
        *,
        filename: str | None,
        content_type: str | None,
    ) -> str:
        data = {"model": self.model}
        if self.language:
            data["language"] = self.language
        if self.prompt:
            data["prompt"] = self.prompt

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(
                    f"{self.base_url.rstrip('/')}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    data=data,
                    files={
                        "file": (
                            filename or "audio.wav",
                            content,
                            content_type or "application/octet-stream",
                        )
                    },
                )
                response.raise_for_status()
        except httpx.HTTPError as error:
            raise TranscriptionProviderError("Failed to transcribe audio with the configured OpenAI provider.") from error

        transcript = str(response.json().get("text", "")).strip()
        if not transcript:
            raise TranscriptionProviderError("The STT provider returned an empty transcription.")
        return transcript


@dataclass(frozen=True)
class LocalWhisperTranscriptionProvider:
    model_name: str
    device: str = "auto"
    compute_type: str = "default"
    prompt: str | None = None
    language: str | None = None
    download_root: str | None = None

    def transcribe_audio(
        self,
        content: bytes,
        *,
        filename: str | None,
        content_type: str | None,
    ) -> str:
        suffix = _guess_audio_suffix(filename=filename, content_type=content_type)
        whisper_model = _load_local_whisper_model(
            model_name=self.model_name,
            device=self.device,
            compute_type=self.compute_type,
            download_root=self.download_root,
        )
        temp_path: str | None = None
        try:
            with NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
                temp_file.write(content)
                temp_path = temp_file.name
            segments, _info = whisper_model.transcribe(
                temp_path,
                language=self.language,
                initial_prompt=self.prompt,
            )
        except OSError as error:
            raise TranscriptionProviderError("Failed to prepare audio for local Whisper transcription.") from error
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)

        transcript = "".join(segment.text for segment in segments).strip()
        if not transcript:
            raise TranscriptionProviderError("Local Whisper returned an empty transcription.")
        return transcript


def _guess_audio_suffix(*, filename: str | None, content_type: str | None) -> str:
    if filename:
        _, extension = os.path.splitext(filename)
        if extension:
            return extension
    guessed = mimetypes.guess_extension(content_type or "")
    return guessed or ".wav"


@lru_cache(maxsize=4)
def _load_local_whisper_model(
    *,
    model_name: str,
    device: str,
    compute_type: str,
    download_root: str | None,
) -> Any:
    try:
        faster_whisper = importlib.import_module("faster_whisper")
    except ModuleNotFoundError as error:
        raise TranscriptionConfigError(
            "Local Whisper provider requires `faster-whisper`. Install backend dependencies before enabling it."
        ) from error

    whisper_model = getattr(faster_whisper, "WhisperModel", None)
    if whisper_model is None:
        raise TranscriptionConfigError("`faster-whisper` is installed but WhisperModel is unavailable.")

    kwargs: dict[str, Any] = {"device": device, "compute_type": compute_type}
    if download_root:
        kwargs["download_root"] = download_root
    return whisper_model(model_name, **kwargs)


def _build_openai_provider(settings: Settings) -> OpenAITranscriptionProvider:
    if not settings.stt_base_url or not settings.stt_api_key:
        raise TranscriptionConfigError(
            "OpenAI STT provider requires KINCARE_STT_BASE_URL and KINCARE_STT_API_KEY (or AI fallbacks)."
        )
    return OpenAITranscriptionProvider(
        base_url=settings.stt_base_url,
        api_key=settings.stt_api_key,
        model=settings.stt_model,
        language=settings.stt_language,
        prompt=settings.stt_prompt,
        timeout_seconds=settings.stt_timeout_seconds,
    )


def _build_local_whisper_provider(settings: Settings) -> LocalWhisperTranscriptionProvider:
    return LocalWhisperTranscriptionProvider(
        model_name=settings.local_whisper_model,
        device=settings.local_whisper_device,
        compute_type=settings.local_whisper_compute_type,
        prompt=settings.stt_prompt,
        language=settings.stt_language,
        download_root=settings.local_whisper_download_root,
    )


_PROVIDER_BUILDERS: dict[str, Any] = {
    "openai": _build_openai_provider,
    "local_whisper": _build_local_whisper_provider,
}


def get_transcription_provider(settings: Settings) -> TranscriptionProvider:
    provider_name = settings.stt_provider.strip().lower()
    builder = _PROVIDER_BUILDERS.get(provider_name)
    if builder is None:
        supported = ", ".join(sorted(_PROVIDER_BUILDERS))
        raise TranscriptionConfigError(
            f"Unsupported STT provider `{settings.stt_provider}`. Supported providers: {supported}."
        )
    return builder(settings)


async def transcribe_audio(
    settings: Settings,
    *,
    content: bytes,
    filename: str | None = None,
    content_type: str | None = None,
) -> str:
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio file is empty.")

    try:
        provider = get_transcription_provider(settings)
        return await run_in_threadpool(
            provider.transcribe_audio,
            content,
            filename=filename,
            content_type=content_type,
        )
    except TranscriptionConfigError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except TranscriptionProviderError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

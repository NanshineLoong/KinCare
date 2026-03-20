from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any
import mimetypes
import os

from fastapi import HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.ai.transcription import transcribe_audio
from app.attachments.docling_adapter import (
    DoclingParseError,
    DoclingUnavailableError,
    parse_with_docling,
)
from app.attachments.textutil_adapter import (
    TextutilParseError,
    TextutilUnavailableError,
    parse_with_textutil,
)
from app.core.config import Settings


IMAGE_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".tif",
    ".tiff",
    ".bmp",
    ".webp",
}
DOCLING_SUFFIXES = {".pdf", ".docx", *IMAGE_SUFFIXES}
TEXTUTIL_SUFFIXES = {".doc"}
SUPPORTED_ATTACHMENT_SUFFIXES = DOCLING_SUFFIXES | TEXTUTIL_SUFFIXES
SUPPORTED_AUDIO_SUFFIXES = {
    ".aac",
    ".flac",
    ".m4a",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".oga",
    ".ogg",
    ".wav",
    ".webm",
}
TEXT_EXCERPT_LIMIT = 1600
MARKDOWN_EXCERPT_LIMIT = 2400


def _guess_suffix(filename: str | None, content_type: str | None) -> str:
    if filename:
        suffix = Path(filename).suffix.lower()
        if suffix:
            return suffix
    guessed = mimetypes.guess_extension(content_type or "")
    return (guessed or "").lower()


def _is_audio_file(filename: str | None, content_type: str | None) -> bool:
    suffix = _guess_suffix(filename, content_type)
    if content_type and content_type.startswith("audio/"):
        return True
    return suffix in SUPPORTED_AUDIO_SUFFIXES


def _ensure_supported_document(filename: str | None, content_type: str | None) -> str:
    suffix = _guess_suffix(filename, content_type)
    if suffix in SUPPORTED_ATTACHMENT_SUFFIXES:
        return suffix
    supported = ", ".join(sorted(SUPPORTED_ATTACHMENT_SUFFIXES))
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail=f"Unsupported attachment type. Supported document formats: {supported}. Audio files should use a supported audio format.",
    )


def _truncate(value: str, limit: int) -> str:
    cleaned = " ".join(value.split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 1].rstrip()}…"


def _build_attachment_payload(
    *,
    filename: str,
    media_type: str | None,
    source_type: str,
    ocr_used: bool,
    text: str,
    markdown: str,
) -> dict[str, Any]:
    excerpt = _truncate(text, TEXT_EXCERPT_LIMIT)
    markdown_excerpt = _truncate(markdown or text, MARKDOWN_EXCERPT_LIMIT)
    return {
        "filename": filename,
        "media_type": media_type or "application/octet-stream",
        "source_type": source_type,
        "ocr_used": ocr_used,
        "excerpt": excerpt,
        "markdown_excerpt": markdown_excerpt,
    }


def _parse_document_attachment(
    settings: Settings,
    *,
    content: bytes,
    filename: str | None,
    content_type: str | None,
) -> dict[str, Any]:
    suffix = _ensure_supported_document(filename, content_type)
    actual_filename = filename or f"attachment{suffix}"
    temp_path: str | None = None
    try:
        with NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        path = Path(temp_path)
        if suffix in TEXTUTIL_SUFFIXES:
            parsed = parse_with_textutil(path)
        else:
            parsed = parse_with_docling(
                path,
                artifacts_path=settings.docling_artifacts_path,
            )
    except HTTPException:
        raise
    except (DoclingUnavailableError, TextutilUnavailableError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except (DoclingParseError, TextutilParseError) as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

    attachment = _build_attachment_payload(
        filename=actual_filename,
        media_type=content_type,
        source_type=str(parsed["source_type"]),
        ocr_used=bool(parsed["ocr_used"]),
        text=str(parsed["text"]),
        markdown=str(parsed["markdown"]),
    )
    return {
        "attachment": attachment,
        "suggested_text": f"我上传了附件《{actual_filename}》，请结合其中内容继续分析。",
    }


async def handle_chat_attachment_upload(
    settings: Settings,
    *,
    content: bytes,
    filename: str | None = None,
    content_type: str | None = None,
) -> dict[str, Any]:
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attachment file is empty.")

    if _is_audio_file(filename, content_type):
        transcript = await transcribe_audio(
            settings,
            content=content,
            filename=filename,
            content_type=content_type,
        )
        return {
            "attachment": None,
            "suggested_text": transcript,
        }

    return await run_in_threadpool(
        _parse_document_attachment,
        settings,
        content=content,
        filename=filename,
        content_type=content_type,
    )

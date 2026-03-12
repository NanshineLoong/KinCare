from __future__ import annotations

from fastapi import HTTPException, status


def transcribe_audio(content: bytes) -> str:
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio file is empty.")

    transcript = content.decode("utf-8", errors="ignore").strip()
    if not transcript:
        return "已收到语音，暂无法解析具体内容。"
    return transcript

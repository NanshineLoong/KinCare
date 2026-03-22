from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse

from app.attachments.service import handle_chat_attachment_upload
from app.ai.orchestrator import ChatOrchestrator, format_sse_event
from app.ai.transcription import transcribe_audio
from app.core.config import Settings
from app.core.database import Database
from app.core.dependencies import CurrentUser, get_current_user, get_database, get_settings
from app.schemas.chat import (
    ChatAttachmentUploadResult,
    ChatDraftConfirmRequest,
    ChatDraftConfirmResult,
    ChatMessageCreate,
    ChatMessageRead,
    ChatSessionCreate,
    ChatSessionListItem,
    ChatSessionRead,
    ChatTranscriptionRead,
)
from app.services import chat_sessions


router = APIRouter(prefix="/api/chat", tags=["chat"])


def _public_chat_message(message: dict[str, Any]) -> dict[str, Any]:
    metadata = dict(message.get("metadata") or {})
    metadata.pop("message_history", None)
    return {
        "id": message["id"],
        "role": message["role"],
        "content": message["content"],
        "event_type": message.get("event_type"),
        "metadata": metadata or None,
        "created_at": message["created_at"],
    }


@router.post("/sessions", response_model=ChatSessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    request: ChatSessionCreate,
    app_request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str | None]:
    orchestrator: ChatOrchestrator = app_request.app.state.chat_orchestrator
    return orchestrator.create_session(
        current_user=current_user,
        member_id=request.member_id,
        page_context=request.page_context,
    )


@router.get("/sessions", response_model=list[ChatSessionListItem])
def list_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    with database.connection() as connection:
        sessions = chat_sessions.list_sessions(
            connection,
            user_id=current_user.id,
            family_space_id=current_user.family_space_id,
            limit=limit,
            offset=offset,
        )
    return [
        {
            "id": session["id"],
            "member_id": session["member_id"],
            "title": session["title"],
            "summary": session.get("summary"),
            "updated_at": session["updated_at"],
        }
        for session in sessions
    ]


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageRead])
def list_session_messages(
    session_id: str,
    app_request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    orchestrator: ChatOrchestrator = app_request.app.state.chat_orchestrator
    try:
        orchestrator.get_session(
            current_user=current_user,
            session_id=session_id,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    database: Database = app_request.app.state.database
    with database.connection() as connection:
        messages = chat_sessions.list_messages_for_session(connection, session_id)
    return [_public_chat_message(message) for message in messages]


@router.post("/transcriptions", response_model=ChatTranscriptionRead)
async def create_transcription(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    del current_user
    transcript = await transcribe_audio(
        settings,
        content=await file.read(),
        filename=file.filename,
        content_type=file.content_type,
    )
    return {"text": transcript}


@router.post("/attachments", response_model=ChatAttachmentUploadResult)
async def create_attachment(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    del current_user
    content = await file.read()
    suffix = Path(file.filename or "").suffix.lower()
    if (file.content_type or "").startswith("audio/") or suffix in {
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
    }:
        transcript = await transcribe_audio(
            settings,
            content=content,
            filename=file.filename,
            content_type=file.content_type,
        )
        return {
            "attachment": None,
            "suggested_text": transcript,
        }
    return await handle_chat_attachment_upload(
        settings,
        content=content,
        filename=file.filename,
        content_type=file.content_type,
    )


@router.post("/sessions/{session_id}/messages")
async def create_message(
    session_id: str,
    request: ChatMessageCreate,
    app_request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    orchestrator: ChatOrchestrator = app_request.app.state.chat_orchestrator
    try:
        orchestrator.validate_message_request(
            current_user=current_user,
            session_id=session_id,
            member_id=request.member_id,
            member_selection_mode=request.member_selection_mode,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    async def event_stream() -> AsyncIterator[str]:
        async for event in orchestrator.stream_chat(
            current_user=current_user,
            session_id=session_id,
            content=request.content,
            member_id=request.member_id,
            member_selection_mode=request.member_selection_mode,
            page_context=request.page_context,
            language=request.language,
            attachments=tuple(request.attachments),
        ):
            yield format_sse_event(event)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/{session_id}/confirm-draft", response_model=ChatDraftConfirmResult)
async def confirm_chat_draft(
    session_id: str,
    request: ChatDraftConfirmRequest,
    app_request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    orchestrator: ChatOrchestrator = app_request.app.state.chat_orchestrator
    try:
        result = await orchestrator.confirm_draft(
            session_id=session_id,
            current_user=current_user,
            approvals=request.approvals,
            edits={tool_call_id: draft.model_dump() for tool_call_id, draft in request.edits.items()},
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return result

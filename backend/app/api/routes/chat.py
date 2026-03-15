from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse

from app.ai.orchestrator import ChatOrchestrator, format_sse_event
from app.ai.transcription import transcribe_audio
from app.core.dependencies import CurrentUser, get_current_user
from app.schemas.chat import (
    ChatDraftConfirmRequest,
    ChatDraftConfirmResult,
    ChatMessageCreate,
    ChatSessionCreate,
    ChatSessionRead,
    ChatTranscriptionRead,
)


router = APIRouter(prefix="/api/chat", tags=["chat"])


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


@router.post("/transcriptions", response_model=ChatTranscriptionRead)
async def create_transcription(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    del current_user
    transcript = transcribe_audio(await file.read())
    return {"text": transcript}


@router.post("/sessions/{session_id}/messages")
async def create_message(
    session_id: str,
    request: ChatMessageCreate,
    app_request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    orchestrator: ChatOrchestrator = app_request.app.state.chat_orchestrator
    try:
        orchestrator.resolve_session(
            current_user=current_user,
            session_id=session_id,
            member_id=request.member_id,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    async def event_stream() -> AsyncIterator[str]:
        async for event in orchestrator.stream_chat(
            current_user=current_user,
            session_id=session_id,
            content=request.content,
            member_id=request.member_id,
            page_context=request.page_context,
            document_ids=request.document_ids,
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

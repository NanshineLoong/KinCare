from __future__ import annotations

from collections.abc import Iterator

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse

from app.ai.orchestrator import ChatOrchestrator, format_sse_event
from app.ai.extraction import apply_draft_to_member
from app.ai.transcription import transcribe_audio
from app.core.database import Database
from app.core.dependencies import CurrentUser, get_current_user, get_database
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
def create_message(
    session_id: str,
    request: ChatMessageCreate,
    app_request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    orchestrator: ChatOrchestrator = app_request.app.state.chat_orchestrator
    try:
        events = orchestrator.handle_message(
            current_user=current_user,
            session_id=session_id,
            content=request.content,
            member_id=request.member_id,
            page_context=request.page_context,
            document_ids=request.document_ids,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    def event_stream() -> Iterator[str]:
        for event in events:
            yield format_sse_event(event)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/confirm", response_model=ChatDraftConfirmResult)
def confirm_chat_draft(
    request: ChatDraftConfirmRequest,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_database),
) -> dict[str, dict[str, int]]:
    counts = apply_draft_to_member(
        database=database,
        current_user=current_user,
        member_id=request.member_id,
        draft=request.draft.model_dump(),
        source="manual",
    )
    return {"created_counts": counts}

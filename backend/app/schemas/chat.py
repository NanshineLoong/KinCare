from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.health import HealthRecordDraft


class ChatSessionCreate(BaseModel):
    member_id: str | None = None
    page_context: str | None = None


class ChatSessionRead(BaseModel):
    id: str
    user_id: str
    family_space_id: str
    member_id: str | None = None
    title: str | None = None
    summary: str | None = None
    page_context: str | None = None
    created_at: str
    updated_at: str


class ChatSessionListItem(BaseModel):
    id: str
    member_id: str | None = None
    title: str | None = None
    summary: str | None = None
    updated_at: str


class ChatMessageCreate(BaseModel):
    content: str
    member_id: str | None = None
    member_selection_mode: Literal["explicit", "auto"] = "explicit"
    page_context: str | None = None
    language: Literal["zh", "en"] = "en"
    attachments: list["ChatAttachmentContext"] = Field(default_factory=list)

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message content is required.")
        return cleaned


class ChatTranscriptionRead(BaseModel):
    text: str


class ChatAttachmentContext(BaseModel):
    filename: str
    media_type: str
    source_type: str
    ocr_used: bool = False
    excerpt: str
    markdown_excerpt: str | None = None


class ChatAttachmentUploadResult(BaseModel):
    attachment: ChatAttachmentContext | None = None
    suggested_text: str


class ChatMessageRead(BaseModel):
    id: str
    role: str
    content: str
    event_type: str | None = None
    metadata: dict[str, Any] | None = None
    created_at: str


class ChatDraftConfirmRequest(BaseModel):
    approvals: dict[str, bool] = Field(default_factory=dict)
    edits: dict[str, HealthRecordDraft] = Field(default_factory=dict)


class ChatDraftConfirmResult(BaseModel):
    created_counts: dict[str, int]
    assistant_message: str


class ChatToolResult(BaseModel):
    tool_name: str
    content: str
    requires_confirmation: bool = False
    draft: HealthRecordDraft | None = None
    meta: dict[str, Any] = Field(default_factory=dict)

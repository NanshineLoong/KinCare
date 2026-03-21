from __future__ import annotations

from dataclasses import dataclass

from app.ai.scheduler import KinCareScheduler
from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.schemas.chat import ChatAttachmentContext


@dataclass
class AIDeps:
    database: Database
    current_user: CurrentUser
    family_space_id: str
    focus_member_id: str | None
    focus_member_name: str | None
    previous_focus_member_id: str | None
    previous_focus_member_name: str | None
    focus_resolution_source: str
    focus_changed: bool
    visible_members: tuple[dict[str, str], ...]
    scheduler: KinCareScheduler
    session_id: str
    page_context: str | None
    attachments: tuple[ChatAttachmentContext, ...] = ()

from __future__ import annotations

from dataclasses import dataclass

from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.schemas.chat import ChatAttachmentContext
from app.services.health_records import list_visible_members_with_permission


@dataclass(frozen=True)
class ResolvedChatFocus:
    member_id: str | None
    member_name: str | None
    previous_member_id: str | None
    previous_member_name: str | None
    focus_changed: bool
    resolution_source: str
    visible_members: tuple[dict[str, str], ...]


def resolve_chat_focus(
    *,
    database: Database,
    current_user: CurrentUser,
    previous_member_id: str | None,
    requested_member_id: str | None,
    member_selection_mode: str,
    content: str,
    attachments: tuple[ChatAttachmentContext, ...] = (),
) -> ResolvedChatFocus:
    visible_members = tuple(
        {
            "id": str(member["id"]),
            "name": str(member["name"]),
            "permission_level": str(member["permission_level"]),
        }
        for member in list_visible_members_with_permission(
            database,
            current_user,
            required_permission="read",
        )
    )
    visible_member_map = {member["id"]: member for member in visible_members}

    previous_member_name = None
    if previous_member_id is not None:
        previous_member_name = visible_member_map.get(previous_member_id, {}).get("name")

    if member_selection_mode == "explicit":
        resolved_member_id = requested_member_id
        resolution_source = "explicit"
    else:
        matched_member_ids = _match_member_ids(
            visible_members=visible_members,
            content=content,
            attachments=attachments,
        )
        if len(matched_member_ids) == 1:
            resolved_member_id = next(iter(matched_member_ids))
            resolution_source = "inferred"
        elif len(matched_member_ids) > 1:
            resolved_member_id = None
            resolution_source = "unresolved"
        elif previous_member_id is not None and previous_member_id in visible_member_map:
            resolved_member_id = previous_member_id
            resolution_source = "carried"
        else:
            resolved_member_id = None
            resolution_source = "unresolved"

    member_name = None
    if resolved_member_id is not None:
        member_name = visible_member_map.get(resolved_member_id, {}).get("name")

    return ResolvedChatFocus(
        member_id=resolved_member_id,
        member_name=member_name,
        previous_member_id=previous_member_id,
        previous_member_name=previous_member_name,
        focus_changed=resolved_member_id != previous_member_id,
        resolution_source=resolution_source,
        visible_members=visible_members,
    )


def _match_member_ids(
    *,
    visible_members: tuple[dict[str, str], ...],
    content: str,
    attachments: tuple[ChatAttachmentContext, ...],
) -> set[str]:
    haystacks = [_normalize_text(content)]
    for attachment in attachments:
        haystacks.extend(
            [
                _normalize_text(attachment.filename),
                _normalize_text(attachment.excerpt),
                _normalize_text(attachment.markdown_excerpt or ""),
            ]
        )

    matched_member_ids: set[str] = set()
    for member in visible_members:
        member_name = _normalize_text(member["name"])
        if not member_name:
            continue
        if any(member_name in haystack for haystack in haystacks):
            matched_member_ids.add(member["id"])
    return matched_member_ids


def _normalize_text(value: str) -> str:
    return "".join((value or "").lower().split())

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.schemas.chat import DocumentExtractionDraft
from app.services import health_repository
from app.services.health_records import ensure_member_access


def normalize_extraction_draft(payload: dict[str, Any] | None) -> dict[str, Any]:
    model = DocumentExtractionDraft.model_validate(payload or {})
    return model.model_dump()


def extract_document(content: bytes, *, file_name: str, mime_type: str) -> dict[str, Any]:
    if not content:
        return normalize_extraction_draft(
            {
                "summary": f"{file_name} 内容为空，暂未抽取到结构化信息。",
            }
        )

    if mime_type == "application/json" or file_name.endswith(".json"):
        try:
            payload = json.loads(content.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid extraction draft file.") from error
        return normalize_extraction_draft(payload)

    text = content.decode("utf-8", errors="ignore").strip()
    summary = text or f"{Path(file_name).name} 已上传，等待进一步识别。"
    return normalize_extraction_draft({"summary": summary})


def apply_draft_to_member(
    *,
    database: Database,
    current_user: CurrentUser,
    member_id: str,
    draft: dict[str, Any],
    source: str,
    source_ref: str | None,
) -> dict[str, int]:
    ensure_member_access(database, current_user, member_id, require_write=True)
    normalized = normalize_extraction_draft(draft)
    counts = {
        "observations": 0,
        "conditions": 0,
        "medications": 0,
        "encounters": 0,
        "care_plans": 0,
    }

    with database.connection() as connection:
        for item in normalized["observations"]:
            health_repository.create_resource(
                connection,
                "observations",
                member_id=member_id,
                values={
                    **item,
                    "source": source,
                    "source_ref": source_ref,
                },
            )
            counts["observations"] += 1

        for item in normalized["conditions"]:
            health_repository.create_resource(
                connection,
                "conditions",
                member_id=member_id,
                values={
                    **item,
                    "source": source,
                    "source_ref": source_ref,
                },
            )
            counts["conditions"] += 1

        for item in normalized["medications"]:
            health_repository.create_resource(
                connection,
                "medications",
                member_id=member_id,
                values={
                    **item,
                    "source": source,
                    "source_ref": source_ref,
                },
            )
            counts["medications"] += 1

        for item in normalized["encounters"]:
            health_repository.create_resource(
                connection,
                "encounters",
                member_id=member_id,
                values={
                    **item,
                    "source": source,
                    "source_ref": source_ref,
                },
            )
            counts["encounters"] += 1

        for item in normalized["care_plans"]:
            health_repository.create_resource(
                connection,
                "care-plans",
                member_id=member_id,
                values=item,
            )
            counts["care_plans"] += 1

    return counts

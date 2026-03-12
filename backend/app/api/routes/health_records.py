from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel

from app.ai.extraction import apply_draft_to_member, extract_document, normalize_extraction_draft
from app.core.database import Database
from app.core.dependencies import CurrentUser, get_current_user, get_database, get_settings
from app.core.config import Settings
from app.schemas.chat import DocumentConfirmResult, DocumentExtractionDraft, DocumentExtractionRead
from app.schemas.health import (
    CarePlanCreate,
    CarePlanRead,
    CarePlanUpdate,
    ConditionCreate,
    ConditionRead,
    ConditionUpdate,
    DashboardRead,
    DocumentReferenceCreate,
    DocumentReferenceRead,
    DocumentReferenceUpdate,
    DocumentType,
    EncounterCreate,
    EncounterRead,
    EncounterUpdate,
    MedicationCreate,
    MedicationRead,
    MedicationUpdate,
    ObservationCreate,
    ObservationRead,
    ObservationTrendRead,
    ObservationUpdate,
)
from app.services import health_repository
from app.services.repository import now_iso
from app.services.health_records import (
    create_resource,
    delete_resource,
    ensure_member_access,
    get_dashboard,
    get_observation_trend,
    get_resource,
    list_resource,
    update_resource,
)


def build_member_resource_router(
    *,
    resource: str,
    create_model: type[BaseModel],
    update_model: type[BaseModel],
    read_model: type[BaseModel],
) -> APIRouter:
    router = APIRouter(prefix=f"/api/members/{{member_id}}/{resource}", tags=["health-records"])

    @router.get("", response_model=list[read_model], name=f"list_{resource}")
    def read_collection(
        member_id: str,
        database: Database = Depends(get_database),
        current_user: CurrentUser = Depends(get_current_user),
    ) -> list[dict[str, Any]]:
        return list_resource(resource, member_id, database, current_user)

    @router.post("", response_model=read_model, status_code=status.HTTP_201_CREATED, name=f"create_{resource}")
    def create_collection_item(
        member_id: str,
        request: create_model,
        database: Database = Depends(get_database),
        current_user: CurrentUser = Depends(get_current_user),
    ) -> dict[str, Any]:
        return create_resource(
            resource,
            member_id,
            request.model_dump(),
            database,
            current_user,
        )

    @router.get("/{resource_id}", response_model=read_model, name=f"get_{resource}")
    def read_item(
        member_id: str,
        resource_id: str,
        database: Database = Depends(get_database),
        current_user: CurrentUser = Depends(get_current_user),
    ) -> dict[str, Any]:
        return get_resource(resource, member_id, resource_id, database, current_user)

    @router.put("/{resource_id}", response_model=read_model, name=f"update_{resource}")
    def edit_item(
        member_id: str,
        resource_id: str,
        request: update_model,
        database: Database = Depends(get_database),
        current_user: CurrentUser = Depends(get_current_user),
    ) -> dict[str, Any]:
        return update_resource(
            resource,
            member_id,
            resource_id,
            request.model_dump(exclude_none=True),
            database,
            current_user,
        )

    @router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT, name=f"delete_{resource}")
    def remove_item(
        member_id: str,
        resource_id: str,
        database: Database = Depends(get_database),
        current_user: CurrentUser = Depends(get_current_user),
    ) -> Response:
        delete_resource(resource, member_id, resource_id, database, current_user)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return router


dashboard_router = APIRouter(tags=["dashboard"])


@dashboard_router.get("/api/dashboard", response_model=DashboardRead)
def read_dashboard(
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return get_dashboard(database, current_user)


observations_router = APIRouter(prefix="/api/members/{member_id}/observations", tags=["health-records"])


@observations_router.get("", response_model=list[ObservationRead])
def read_observations(
    member_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_resource("observations", member_id, database, current_user)


@observations_router.post("", response_model=ObservationRead, status_code=status.HTTP_201_CREATED)
def create_observation(
    member_id: str,
    request: ObservationCreate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return create_resource(
        "observations",
        member_id,
        request.model_dump(),
        database,
        current_user,
    )


@observations_router.get("/trend", response_model=ObservationTrendRead)
def read_observation_trend(
    member_id: str,
    code: str = Query(..., min_length=1),
    from_at: str | None = Query(default=None, alias="from"),
    to_at: str | None = Query(default=None, alias="to"),
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return get_observation_trend(
        member_id,
        code=code,
        from_at=from_at,
        to_at=to_at,
        database=database,
        current_user=current_user,
    )


@observations_router.get("/{resource_id}", response_model=ObservationRead)
def read_observation(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return get_resource("observations", member_id, resource_id, database, current_user)


@observations_router.put("/{resource_id}", response_model=ObservationRead)
def edit_observation(
    member_id: str,
    resource_id: str,
    request: ObservationUpdate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return update_resource(
        "observations",
        member_id,
        resource_id,
        request.model_dump(exclude_none=True),
        database,
        current_user,
    )


@observations_router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_observation(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    delete_resource("observations", member_id, resource_id, database, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


conditions_router = build_member_resource_router(
    resource="conditions",
    create_model=ConditionCreate,
    update_model=ConditionUpdate,
    read_model=ConditionRead,
)
medications_router = build_member_resource_router(
    resource="medications",
    create_model=MedicationCreate,
    update_model=MedicationUpdate,
    read_model=MedicationRead,
)
encounters_router = build_member_resource_router(
    resource="encounters",
    create_model=EncounterCreate,
    update_model=EncounterUpdate,
    read_model=EncounterRead,
)
documents_router = build_member_resource_router(
    resource="documents",
    create_model=DocumentReferenceCreate,
    update_model=DocumentReferenceUpdate,
    read_model=DocumentReferenceRead,
)
care_plans_router = build_member_resource_router(
    resource="care-plans",
    create_model=CarePlanCreate,
    update_model=CarePlanUpdate,
    read_model=CarePlanRead,
)

document_workflow_router = APIRouter(tags=["document-extraction"])


def _write_uploaded_file(settings: Settings, member_id: str, file_name: str, content: bytes) -> str:
    upload_root = Path(settings.upload_dir)
    member_dir = upload_root / member_id
    member_dir.mkdir(parents=True, exist_ok=True)
    file_path = member_dir / file_name
    file_path.write_bytes(content)
    return str(file_path)


def _process_document_reference(
    *,
    database: Database,
    document_id: str,
) -> None:
    with database.connection() as connection:
        document = health_repository.get_resource_by_id(connection, "documents", document_id)
        if document is None:
            return
        health_repository.update_resource(
            connection,
            "documents",
            document_id,
            {"extraction_status": "processing"},
        )
        file_path = Path(document["file_path"])
        content = file_path.read_bytes() if file_path.exists() else b""
        extraction = extract_document(
            content,
            file_name=document["file_name"],
            mime_type=document["mime_type"],
        )
        health_repository.update_resource(
            connection,
            "documents",
            document_id,
            {
                "extraction_status": "completed",
                "extracted_at": now_iso(),
                "raw_extraction": extraction,
            },
        )


@document_workflow_router.post(
    "/api/members/{member_id}/documents/upload",
    response_model=DocumentReferenceRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    member_id: str,
    background_tasks: BackgroundTasks,
    doc_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    ensure_member_access(database, current_user, member_id, require_write=True)
    content = await file.read()
    file_path = _write_uploaded_file(settings, member_id, file.filename or "upload.bin", content)

    with database.connection() as connection:
        created = health_repository.create_resource(
            connection,
            "documents",
            member_id=member_id,
            values={
                "uploaded_by": current_user.id,
                "doc_type": doc_type,
                "file_path": file_path,
                "file_name": file.filename or "upload.bin",
                "mime_type": file.content_type or "application/octet-stream",
                "extraction_status": "pending",
                "raw_extraction": None,
            },
        )

    del background_tasks
    _process_document_reference(database=database, document_id=created["id"])
    with database.connection() as connection:
        processed = health_repository.get_resource_by_id(connection, "documents", created["id"])
    if processed is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document processing failed.")
    return processed


@document_workflow_router.get("/api/documents/{document_id}/extraction", response_model=DocumentExtractionRead)
def read_document_extraction(
    document_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    with database.connection() as connection:
        document = health_repository.get_resource_by_id(connection, "documents", document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    ensure_member_access(database, current_user, document["member_id"], require_write=False)
    return {
        "id": document["id"],
        "member_id": document["member_id"],
        "file_name": document["file_name"],
        "doc_type": document["doc_type"],
        "extraction_status": document["extraction_status"],
        "raw_extraction": normalize_extraction_draft(document["raw_extraction"]),
        "extracted_at": document["extracted_at"],
    }


@document_workflow_router.post("/api/documents/{document_id}/confirm", response_model=DocumentConfirmResult)
def confirm_document_extraction(
    document_id: str,
    request: DocumentExtractionDraft,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    with database.connection() as connection:
        document = health_repository.get_resource_by_id(connection, "documents", document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    counts = apply_draft_to_member(
        database=database,
        current_user=current_user,
        member_id=document["member_id"],
        draft=request.model_dump(),
        source="document-extract",
        source_ref=document_id,
    )
    return {
        "document_id": document_id,
        "created_counts": counts,
    }

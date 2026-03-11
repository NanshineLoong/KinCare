from typing import Any

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel

from app.core.database import Database
from app.core.dependencies import CurrentUser, get_current_user, get_database
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
from app.services.health_records import (
    create_resource,
    delete_resource,
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

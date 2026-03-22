from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response, status

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
    DailyGenerationRefreshRequest,
    DailyGenerationRefreshResult,
    EncounterCreate,
    EncounterRead,
    EncounterUpdate,
    HealthSummaryCreate,
    HealthSummaryRead,
    HealthSummaryUpdate,
    MedicationCreate,
    MedicationRead,
    MedicationUpdate,
    ObservationCreate,
    ObservationRead,
    ObservationTrendRead,
    ObservationUpdate,
    SleepRecordCreate,
    SleepRecordRead,
    SleepRecordUpdate,
    WorkoutRecordCreate,
    WorkoutRecordRead,
    WorkoutRecordUpdate,
)
from app.services.health_records import (
    create_resource,
    delete_resource,
    get_dashboard,
    get_observation_trend,
    get_resource,
    list_visible_members_with_permission,
    list_resource,
    update_resource,
    ensure_member_access,
)


dashboard_router = APIRouter(tags=["dashboard"])
observations_router = APIRouter(prefix="/api/members/{member_id}/observations", tags=["health-records"])
conditions_router = APIRouter(prefix="/api/members/{member_id}/conditions", tags=["health-records"])
medications_router = APIRouter(prefix="/api/members/{member_id}/medications", tags=["health-records"])
encounters_router = APIRouter(prefix="/api/members/{member_id}/encounters", tags=["health-records"])
sleep_records_router = APIRouter(prefix="/api/members/{member_id}/sleep-records", tags=["health-records"])
workout_records_router = APIRouter(prefix="/api/members/{member_id}/workout-records", tags=["health-records"])
health_summaries_router = APIRouter(prefix="/api/members/{member_id}/health-summaries", tags=["health-records"])
care_plans_router = APIRouter(prefix="/api/members/{member_id}/care-plans", tags=["health-records"])


@dashboard_router.get("/api/dashboard", response_model=DashboardRead)
def read_dashboard(
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return get_dashboard(database, current_user)


@dashboard_router.post("/api/dashboard/today-reminders/refresh", response_model=DailyGenerationRefreshResult)
def refresh_dashboard_today_reminders(
    request: Request,
    payload: DailyGenerationRefreshRequest | None = None,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    members = list_visible_members_with_permission(
        database,
        current_user,
        required_permission="write",
    )
    scheduler = request.app.state.scheduler
    return scheduler.refresh_daily_care_plans_for_member_ids(
        [member["id"] for member in members],
        output_language=(payload.language if payload is not None else None),
    )


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
    return create_resource("observations", member_id, request.model_dump(), database, current_user)


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


@conditions_router.get("", response_model=list[ConditionRead])
def read_conditions(
    member_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_resource("conditions", member_id, database, current_user)


@conditions_router.post("", response_model=ConditionRead, status_code=status.HTTP_201_CREATED)
def create_condition(
    member_id: str,
    request: ConditionCreate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return create_resource("conditions", member_id, request.model_dump(), database, current_user)


@conditions_router.get("/{resource_id}", response_model=ConditionRead)
def read_condition(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return get_resource("conditions", member_id, resource_id, database, current_user)


@conditions_router.put("/{resource_id}", response_model=ConditionRead)
def edit_condition(
    member_id: str,
    resource_id: str,
    request: ConditionUpdate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return update_resource(
        "conditions",
        member_id,
        resource_id,
        request.model_dump(exclude_none=True),
        database,
        current_user,
    )


@conditions_router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_condition(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    delete_resource("conditions", member_id, resource_id, database, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@medications_router.get("", response_model=list[MedicationRead])
def read_medications(
    member_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_resource("medications", member_id, database, current_user)


@medications_router.post("", response_model=MedicationRead, status_code=status.HTTP_201_CREATED)
def create_medication(
    member_id: str,
    request: MedicationCreate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return create_resource("medications", member_id, request.model_dump(), database, current_user)


@medications_router.get("/{resource_id}", response_model=MedicationRead)
def read_medication(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return get_resource("medications", member_id, resource_id, database, current_user)


@medications_router.put("/{resource_id}", response_model=MedicationRead)
def edit_medication(
    member_id: str,
    resource_id: str,
    request: MedicationUpdate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return update_resource(
        "medications",
        member_id,
        resource_id,
        request.model_dump(exclude_none=True),
        database,
        current_user,
    )


@medications_router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_medication(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    delete_resource("medications", member_id, resource_id, database, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@encounters_router.get("", response_model=list[EncounterRead])
def read_encounters(
    member_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_resource("encounters", member_id, database, current_user)


@encounters_router.post("", response_model=EncounterRead, status_code=status.HTTP_201_CREATED)
def create_encounter(
    member_id: str,
    request: EncounterCreate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return create_resource("encounters", member_id, request.model_dump(), database, current_user)


@encounters_router.get("/{resource_id}", response_model=EncounterRead)
def read_encounter(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return get_resource("encounters", member_id, resource_id, database, current_user)


@encounters_router.put("/{resource_id}", response_model=EncounterRead)
def edit_encounter(
    member_id: str,
    resource_id: str,
    request: EncounterUpdate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return update_resource(
        "encounters",
        member_id,
        resource_id,
        request.model_dump(exclude_none=True),
        database,
        current_user,
    )


@encounters_router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_encounter(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    delete_resource("encounters", member_id, resource_id, database, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@sleep_records_router.get("", response_model=list[SleepRecordRead])
def read_sleep_records(
    member_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_resource("sleep-records", member_id, database, current_user)


@sleep_records_router.post("", response_model=SleepRecordRead, status_code=status.HTTP_201_CREATED)
def create_sleep_record(
    member_id: str,
    request: SleepRecordCreate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return create_resource("sleep-records", member_id, request.model_dump(), database, current_user)


@sleep_records_router.get("/{resource_id}", response_model=SleepRecordRead)
def read_sleep_record(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return get_resource("sleep-records", member_id, resource_id, database, current_user)


@sleep_records_router.put("/{resource_id}", response_model=SleepRecordRead)
def edit_sleep_record(
    member_id: str,
    resource_id: str,
    request: SleepRecordUpdate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return update_resource(
        "sleep-records",
        member_id,
        resource_id,
        request.model_dump(exclude_none=True),
        database,
        current_user,
    )


@sleep_records_router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_sleep_record(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    delete_resource("sleep-records", member_id, resource_id, database, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@workout_records_router.get("", response_model=list[WorkoutRecordRead])
def read_workout_records(
    member_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_resource("workout-records", member_id, database, current_user)


@workout_records_router.post("", response_model=WorkoutRecordRead, status_code=status.HTTP_201_CREATED)
def create_workout_record(
    member_id: str,
    request: WorkoutRecordCreate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return create_resource("workout-records", member_id, request.model_dump(), database, current_user)


@workout_records_router.get("/{resource_id}", response_model=WorkoutRecordRead)
def read_workout_record(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return get_resource("workout-records", member_id, resource_id, database, current_user)


@workout_records_router.put("/{resource_id}", response_model=WorkoutRecordRead)
def edit_workout_record(
    member_id: str,
    resource_id: str,
    request: WorkoutRecordUpdate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return update_resource(
        "workout-records",
        member_id,
        resource_id,
        request.model_dump(exclude_none=True),
        database,
        current_user,
    )


@workout_records_router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_workout_record(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    delete_resource("workout-records", member_id, resource_id, database, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@health_summaries_router.get("", response_model=list[HealthSummaryRead])
def read_health_summaries(
    member_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_resource("health-summaries", member_id, database, current_user)


@health_summaries_router.post("/refresh", response_model=DailyGenerationRefreshResult)
def refresh_health_summaries_for_member(
    member_id: str,
    request: Request,
    payload: DailyGenerationRefreshRequest | None = None,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    ensure_member_access(database, current_user, member_id, required_permission="write")
    scheduler = request.app.state.scheduler
    return scheduler.refresh_health_summaries_for_member_ids(
        [member_id],
        output_language=(payload.language if payload is not None else None),
    )


@health_summaries_router.post("", response_model=HealthSummaryRead, status_code=status.HTTP_201_CREATED)
def create_health_summary(
    member_id: str,
    request: HealthSummaryCreate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return create_resource("health-summaries", member_id, request.model_dump(), database, current_user)


@health_summaries_router.get("/{resource_id}", response_model=HealthSummaryRead)
def read_health_summary(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return get_resource("health-summaries", member_id, resource_id, database, current_user)


@health_summaries_router.put("/{resource_id}", response_model=HealthSummaryRead)
def edit_health_summary(
    member_id: str,
    resource_id: str,
    request: HealthSummaryUpdate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return update_resource(
        "health-summaries",
        member_id,
        resource_id,
        request.model_dump(exclude_none=True),
        database,
        current_user,
    )


@health_summaries_router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_health_summary(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    delete_resource("health-summaries", member_id, resource_id, database, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@care_plans_router.get("", response_model=list[CarePlanRead])
def read_care_plans(
    member_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_resource("care-plans", member_id, database, current_user)


@care_plans_router.post("", response_model=CarePlanRead, status_code=status.HTTP_201_CREATED)
def create_care_plan(
    member_id: str,
    request: CarePlanCreate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return create_resource("care-plans", member_id, request.model_dump(), database, current_user)


@care_plans_router.get("/{resource_id}", response_model=CarePlanRead)
def read_care_plan(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return get_resource("care-plans", member_id, resource_id, database, current_user)


@care_plans_router.put("/{resource_id}", response_model=CarePlanRead)
def edit_care_plan(
    member_id: str,
    resource_id: str,
    request: CarePlanUpdate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return update_resource(
        "care-plans",
        member_id,
        resource_id,
        request.model_dump(exclude_none=True),
        database,
        current_user,
    )


@care_plans_router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_care_plan(
    member_id: str,
    resource_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    delete_resource("care-plans", member_id, resource_id, database, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

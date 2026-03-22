from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

SQLITE_BUSY_TIMEOUT_MS = 5_000


SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS family_space (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_account (
    id TEXT PRIMARY KEY,
    family_space_id TEXT NOT NULL REFERENCES family_space(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    preferred_language TEXT CHECK (preferred_language IN ('zh', 'en')),
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS family_member (
    id TEXT PRIMARY KEY,
    family_space_id TEXT NOT NULL REFERENCES family_space(id) ON DELETE CASCADE,
    user_account_id TEXT UNIQUE REFERENCES user_account(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'unknown' CHECK (gender IN ('male', 'female', 'other', 'unknown')),
    birth_date TEXT,
    height_cm REAL,
    blood_type TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_account_family_space_id
ON user_account(family_space_id);

CREATE INDEX IF NOT EXISTS idx_family_member_family_space_id
ON family_member(family_space_id);

CREATE TABLE IF NOT EXISTS member_access_grant (
    id TEXT PRIMARY KEY,
    member_id TEXT REFERENCES family_member(id) ON DELETE CASCADE,
    user_account_id TEXT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    permission_level TEXT NOT NULL DEFAULT 'read'
        CHECK (permission_level IN ('read', 'write', 'manage')),
    target_scope TEXT NOT NULL DEFAULT 'specific'
        CHECK (target_scope IN ('specific', 'all')),
    created_at TEXT NOT NULL,
    CHECK (
        (target_scope = 'specific' AND member_id IS NOT NULL)
        OR (target_scope = 'all' AND member_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_member_access_grant_user_account_id
ON member_access_grant(user_account_id);

CREATE INDEX IF NOT EXISTS idx_member_access_grant_member_id
ON member_access_grant(member_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_access_grant_specific_unique
ON member_access_grant(member_id, user_account_id)
WHERE target_scope = 'specific';

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_access_grant_all_unique
ON member_access_grant(user_account_id)
WHERE target_scope = 'all';

CREATE TABLE IF NOT EXISTS observation (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('chronic-vitals', 'lifestyle', 'body-vitals')),
    code TEXT NOT NULL,
    display_name TEXT NOT NULL,
    value REAL,
    value_string TEXT,
    unit TEXT,
    context TEXT,
    effective_at TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('device', 'manual', 'ai-extract')),
    device_name TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_observation_member_id_effective_at
ON observation(member_id, effective_at DESC);

CREATE INDEX IF NOT EXISTS idx_observation_member_id_code_effective_at
ON observation(member_id, code, effective_at DESC);

CREATE TABLE IF NOT EXISTS condition (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('chronic', 'diagnosis', 'allergy', 'family-history')),
    display_name TEXT NOT NULL,
    clinical_status TEXT NOT NULL CHECK (clinical_status IN ('active', 'inactive', 'resolved')),
    onset_date TEXT,
    source TEXT NOT NULL CHECK (source IN ('manual', 'ai-extract')),
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_condition_member_id_created_at
ON condition(member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS medication (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    indication TEXT,
    dosage_description TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'stopped')),
    start_date TEXT,
    end_date TEXT,
    source TEXT NOT NULL CHECK (source IN ('manual', 'ai-extract')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_medication_member_id_created_at
ON medication(member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS encounter (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('outpatient', 'inpatient', 'checkup', 'emergency')),
    facility TEXT,
    department TEXT,
    attending_physician TEXT,
    date TEXT NOT NULL,
    summary TEXT,
    source TEXT NOT NULL CHECK (source IN ('manual', 'ai-extract')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_encounter_member_id_date
ON encounter(member_id, date DESC);

CREATE TABLE IF NOT EXISTS sleep_record (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    total_minutes INTEGER NOT NULL,
    deep_minutes INTEGER,
    rem_minutes INTEGER,
    light_minutes INTEGER,
    awake_minutes INTEGER,
    efficiency_score REAL,
    is_nap INTEGER NOT NULL DEFAULT 0 CHECK (is_nap IN (0, 1)),
    source TEXT NOT NULL CHECK (source IN ('device', 'manual')),
    device_name TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sleep_record_member_id_start_at
ON sleep_record(member_id, start_at DESC);

CREATE TABLE IF NOT EXISTS workout_record (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    energy_burned REAL,
    distance_meters REAL,
    avg_heart_rate INTEGER,
    source TEXT NOT NULL CHECK (source IN ('device', 'manual')),
    device_name TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_record_member_id_start_at
ON workout_record(member_id, start_at DESC);

CREATE TABLE IF NOT EXISTS health_summary (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('good', 'warning', 'alert')),
    generated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_summary_member_id
ON health_summary(member_id);

CREATE TABLE IF NOT EXISTS care_plan (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    assignee_member_id TEXT REFERENCES family_member(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('medication-reminder', 'activity-reminder', 'checkup-reminder', 'health-advice', 'daily-tip')),
    icon_key TEXT CHECK (icon_key IN ('medication', 'exercise', 'checkup', 'meal', 'rest', 'social', 'general')),
    time_slot TEXT CHECK (time_slot IN ('清晨', '上午', '午后', '晚间', '睡前')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
    scheduled_at TEXT,
    completed_at TEXT,
    generated_by TEXT NOT NULL CHECK (generated_by IN ('ai', 'manual')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_care_plan_member_id_scheduled_at
ON care_plan(member_id, scheduled_at DESC);

CREATE TABLE IF NOT EXISTS chat_session (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    family_space_id TEXT NOT NULL REFERENCES family_space(id) ON DELETE CASCADE,
    member_id TEXT REFERENCES family_member(id) ON DELETE SET NULL,
    title TEXT,
    summary TEXT,
    page_context TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_session_user_id_created_at
ON chat_session(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_message (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
    content TEXT NOT NULL,
    event_type TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_message_session_id_created_at
ON chat_message(session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS scheduled_task (
    id TEXT PRIMARY KEY,
    family_space_id TEXT NOT NULL REFERENCES family_space(id) ON DELETE CASCADE,
    member_id TEXT REFERENCES family_member(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'daily', 'weekly')),
    schedule_config TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    next_run_at TEXT,
    last_run_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_task_family_space_enabled
ON scheduled_task(family_space_id, enabled, next_run_at);

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""
LEGACY_TABLES = (
    "document_reference",
    "medication_statement",
)


def _table_sql(connection: sqlite3.Connection, table_name: str) -> str:
    row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    if row is None or row[0] is None:
        return ""
    return str(row[0])


def _table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
    rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {str(row[1]) for row in rows}


def _ensure_user_account_schema_is_compatible(connection: sqlite3.Connection, database_path: Path) -> None:
    columns = _table_columns(connection, "user_account")
    if not columns or "username" in columns:
        return

    raise RuntimeError(
        "Legacy user_account schema detected after the username-first auth switch. "
        "Please delete and recreate the SQLite database before restarting. "
        f"Current database: {database_path}. "
        "Use backend/data/kincare.db for local development or /data/kincare.db in the "
        "kincare-data Docker volume."
    )


def _ensure_user_account_preferred_language_column(connection: sqlite3.Connection) -> None:
    columns = _table_columns(connection, "user_account")
    if columns and "preferred_language" not in columns:
        connection.execute(
            """
            ALTER TABLE user_account
            ADD COLUMN preferred_language TEXT CHECK (preferred_language IN ('zh', 'en'))
            """
        )


def _migrate_member_access_grant(connection: sqlite3.Connection) -> None:
    columns = _table_columns(connection, "member_access_grant")
    if not columns or "can_write" not in columns:
        return

    connection.executescript(
        """
        DROP INDEX IF EXISTS idx_member_access_grant_user_account_id;
        ALTER TABLE member_access_grant RENAME TO member_access_grant_legacy;

        CREATE TABLE member_access_grant (
            id TEXT PRIMARY KEY,
            member_id TEXT REFERENCES family_member(id) ON DELETE CASCADE,
            user_account_id TEXT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
            permission_level TEXT NOT NULL DEFAULT 'read'
                CHECK (permission_level IN ('read', 'write', 'manage')),
            target_scope TEXT NOT NULL DEFAULT 'specific'
                CHECK (target_scope IN ('specific', 'all')),
            created_at TEXT NOT NULL,
            CHECK (
                (target_scope = 'specific' AND member_id IS NOT NULL)
                OR (target_scope = 'all' AND member_id IS NULL)
            )
        );

        INSERT INTO member_access_grant (
            id,
            member_id,
            user_account_id,
            permission_level,
            target_scope,
            created_at
        )
        SELECT
            id,
            member_id,
            user_account_id,
            CASE WHEN can_write = 1 THEN 'write' ELSE 'read' END,
            'specific',
            created_at
        FROM member_access_grant_legacy;

        DROP TABLE member_access_grant_legacy;

        CREATE INDEX idx_member_access_grant_user_account_id
        ON member_access_grant(user_account_id);

        CREATE INDEX idx_member_access_grant_member_id
        ON member_access_grant(member_id);

        CREATE UNIQUE INDEX idx_member_access_grant_specific_unique
        ON member_access_grant(member_id, user_account_id)
        WHERE target_scope = 'specific';

        CREATE UNIQUE INDEX idx_member_access_grant_all_unique
        ON member_access_grant(user_account_id)
        WHERE target_scope = 'all';
        """
    )


def _migrate_health_summary_schema(connection: sqlite3.Connection) -> None:
    sql = _table_sql(connection, "health_summary")
    if "neutral" not in sql and "category IN (" not in sql:
        return

    connection.executescript(
        """
        CREATE TABLE health_summary__new (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            label TEXT NOT NULL,
            value TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('good', 'warning', 'alert')),
            generated_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        INSERT INTO health_summary__new (id, member_id, category, label, value, status, generated_at, created_at)
        SELECT
            id,
            member_id,
            category,
            label,
            value,
            CASE status
                WHEN 'neutral' THEN 'warning'
                ELSE status
            END,
            generated_at,
            created_at
        FROM health_summary;

        DROP TABLE health_summary;
        ALTER TABLE health_summary__new RENAME TO health_summary;
        CREATE INDEX idx_health_summary_member_id
        ON health_summary(member_id);
        """
    )


def _migrate_care_plan_schema(connection: sqlite3.Connection) -> None:
    sql = _table_sql(connection, "care_plan")
    columns = _table_columns(connection, "care_plan")
    if not columns:
        return

    required_columns = {"assignee_member_id", "icon_key", "time_slot", "notes"}
    if required_columns.issubset(columns) and "icon_key TEXT CHECK" in sql and "time_slot TEXT CHECK" in sql:
        return

    connection.executescript(
        """
        CREATE TABLE care_plan__new (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
            assignee_member_id TEXT REFERENCES family_member(id) ON DELETE SET NULL,
            category TEXT NOT NULL CHECK (category IN ('medication-reminder', 'activity-reminder', 'checkup-reminder', 'health-advice', 'daily-tip')),
            icon_key TEXT CHECK (icon_key IN ('medication', 'exercise', 'checkup', 'meal', 'rest', 'social', 'general')),
            time_slot TEXT CHECK (time_slot IN ('清晨', '上午', '午后', '晚间', '睡前')),
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            notes TEXT,
            status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
            scheduled_at TEXT,
            completed_at TEXT,
            generated_by TEXT NOT NULL CHECK (generated_by IN ('ai', 'manual')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        INSERT INTO care_plan__new (
            id,
            member_id,
            assignee_member_id,
            category,
            icon_key,
            time_slot,
            title,
            description,
            notes,
            status,
            scheduled_at,
            completed_at,
            generated_by,
            created_at,
            updated_at
        )
        SELECT
            id,
            member_id,
            member_id,
            category,
            CASE category
                WHEN 'medication-reminder' THEN 'medication'
                WHEN 'activity-reminder' THEN 'exercise'
                WHEN 'checkup-reminder' THEN 'checkup'
                ELSE 'general'
            END,
            NULL,
            title,
            description,
            NULL,
            status,
            scheduled_at,
            completed_at,
            generated_by,
            created_at,
            updated_at
        FROM care_plan;

        DROP TABLE care_plan;
        ALTER TABLE care_plan__new RENAME TO care_plan;
        CREATE INDEX idx_care_plan_member_id_scheduled_at
        ON care_plan(member_id, scheduled_at DESC);
        """
    )


def _ensure_chat_session_summary_column(connection: sqlite3.Connection) -> None:
    columns = _table_columns(connection, "chat_session")
    if columns and "summary" not in columns:
        connection.execute("ALTER TABLE chat_session ADD COLUMN summary TEXT")


class Database:
    def __init__(self, database_path: str) -> None:
        self.database_path = Path(database_path)

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.database_path) as connection:
            for table_name in LEGACY_TABLES:
                connection.execute(f"DROP TABLE IF EXISTS {table_name}")
            _ensure_user_account_schema_is_compatible(connection, self.database_path)
            _migrate_member_access_grant(connection)
            _migrate_health_summary_schema(connection)
            _migrate_care_plan_schema(connection)
            _ensure_chat_session_summary_column(connection)
            connection.executescript(SCHEMA_SQL)
            _ensure_user_account_preferred_language_column(connection)
            connection.commit()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(
            self.database_path,
            check_same_thread=False,
            timeout=SQLITE_BUSY_TIMEOUT_MS / 1000,
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(f"PRAGMA busy_timeout = {SQLITE_BUSY_TIMEOUT_MS}")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

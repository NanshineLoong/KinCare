from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


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
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
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
    blood_type TEXT,
    allergies TEXT NOT NULL DEFAULT '[]',
    medical_history TEXT NOT NULL DEFAULT '[]',
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
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    user_account_id TEXT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    can_write INTEGER NOT NULL DEFAULT 0 CHECK (can_write IN (0, 1)),
    created_at TEXT NOT NULL,
    UNIQUE(member_id, user_account_id)
);

CREATE INDEX IF NOT EXISTS idx_member_access_grant_user_account_id
ON member_access_grant(user_account_id);

CREATE TABLE IF NOT EXISTS observation (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('vital-signs', 'laboratory', 'activity', 'sleep', 'other')),
    code TEXT NOT NULL,
    display_name TEXT NOT NULL,
    value REAL,
    value_string TEXT,
    unit TEXT,
    effective_at TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('manual', 'document-extract', 'device')),
    source_ref TEXT,
    notes TEXT,
    encounter_id TEXT REFERENCES encounter(id) ON DELETE SET NULL,
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
    category TEXT NOT NULL CHECK (category IN ('diagnosis', 'chronic', 'allergy', 'symptom')),
    code TEXT NOT NULL,
    display_name TEXT NOT NULL,
    clinical_status TEXT NOT NULL CHECK (clinical_status IN ('active', 'recurrence', 'inactive', 'resolved')),
    onset_date TEXT,
    abatement_date TEXT,
    severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
    source TEXT NOT NULL CHECK (source IN ('manual', 'document-extract', 'device')),
    source_ref TEXT,
    notes TEXT,
    encounter_id TEXT REFERENCES encounter(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_condition_member_id_created_at
ON condition(member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS medication_statement (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    medication_name TEXT NOT NULL,
    dosage TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'stopped')),
    start_date TEXT,
    end_date TEXT,
    reason TEXT,
    prescribed_by TEXT,
    source TEXT NOT NULL CHECK (source IN ('manual', 'document-extract', 'device')),
    source_ref TEXT,
    notes TEXT,
    encounter_id TEXT REFERENCES encounter(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_medication_statement_member_id_created_at
ON medication_statement(member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS encounter (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('outpatient', 'inpatient', 'checkup', 'emergency')),
    facility TEXT,
    department TEXT,
    date TEXT NOT NULL,
    summary TEXT,
    source TEXT NOT NULL CHECK (source IN ('manual', 'document-extract', 'device')),
    source_ref TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_encounter_member_id_date
ON encounter(member_id, date DESC);

CREATE TABLE IF NOT EXISTS document_reference (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    uploaded_by TEXT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('checkup-report', 'lab-result', 'prescription', 'discharge-summary', 'other')),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    extraction_status TEXT NOT NULL CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
    extracted_at TEXT,
    raw_extraction TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_document_reference_member_id_created_at
ON document_reference(member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS care_plan (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('medication-reminder', 'followup-reminder', 'health-advice', 'daily-tip')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
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
"""


class Database:
    def __init__(self, database_path: str) -> None:
        self.database_path = Path(database_path)

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.database_path) as connection:
            connection.executescript(SCHEMA_SQL)
            connection.commit()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.database_path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

from __future__ import annotations

import sqlite3
import pytest

from app.core.database import Database


def test_initialize_drops_legacy_tables(tmp_path) -> None:
    database_path = tmp_path / "kincare.db"

    with sqlite3.connect(database_path) as connection:
        connection.executescript(
            """
            CREATE TABLE document_reference (
                id TEXT PRIMARY KEY
            );

            CREATE TABLE medication_statement (
                id TEXT PRIMARY KEY
            );
            """
        )
        connection.commit()

    database = Database(str(database_path))
    database.initialize()

    with sqlite3.connect(database_path) as connection:
        table_names = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }

    assert "document_reference" not in table_names
    assert "medication_statement" not in table_names
    assert "observation" in table_names
    assert "condition" in table_names
    assert "encounter" in table_names


def test_initialize_creates_username_first_user_account_schema(tmp_path) -> None:
    database_path = tmp_path / "kincare.db"

    database = Database(str(database_path))
    database.initialize()

    with sqlite3.connect(database_path) as connection:
        columns = {
            row[1]: row[2]
            for row in connection.execute("PRAGMA table_info(user_account)").fetchall()
        }
        indexes = {
            row[1]: row[-1]
            for row in connection.execute("PRAGMA index_list(user_account)").fetchall()
        }

    assert columns["username"] == "TEXT"
    assert columns["email"] == "TEXT"
    assert "name" not in columns
    assert "sqlite_autoindex_user_account_2" in indexes


def test_initialize_rejects_legacy_user_account_schema_without_username(tmp_path) -> None:
    database_path = tmp_path / "kincare.db"

    with sqlite3.connect(database_path) as connection:
        connection.executescript(
            """
            CREATE TABLE family_space (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE user_account (
                id TEXT PRIMARY KEY,
                family_space_id TEXT NOT NULL REFERENCES family_space(id) ON DELETE CASCADE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
                created_at TEXT NOT NULL
            );
            """
        )
        connection.commit()

    database = Database(str(database_path))

    with pytest.raises(RuntimeError, match="delete and recreate the SQLite database"):
        database.initialize()

from __future__ import annotations

import sqlite3

from app.core.database import Database


def test_initialize_drops_legacy_tables(tmp_path) -> None:
    database_path = tmp_path / "homevital.db"

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

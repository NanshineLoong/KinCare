from __future__ import annotations

import sqlite3

from app.cli.seed_demo import main as seed_demo_main
from app.core.database import Database
from app.core.security import verify_password
from app.services import repository
from app.services.demo_seed import DEMO_PASSWORD, seed_demo_family


def test_seed_demo_family_replaces_existing_family_data_and_preserves_system_config(tmp_path) -> None:
    database_path = tmp_path / "kincare.db"
    database = Database(str(database_path))
    database.initialize()

    with database.connection() as connection:
        connection.execute(
            """
            INSERT INTO system_config (key, value, updated_at)
            VALUES (?, ?, ?)
            """,
            ("ui.language", "en", "2026-03-20T09:00:00+08:00"),
        )
        family_space = repository.create_family_space(connection, name="Legacy Family")
        user = repository.create_user(
            connection,
            family_space_id=family_space["id"],
            username="legacy_admin",
            email="legacy@example.com",
            password_hash="legacy-hash",
            role="admin",
        )
        repository.create_member(
            connection,
            family_space_id=family_space["id"],
            user_account_id=user["id"],
            name="Legacy Admin",
        )

    result = seed_demo_family(database)

    assert result["family_space"]["name"] == "Carter Family"
    assert result["password"] == DEMO_PASSWORD
    assert {account["username"] for account in result["accounts"]} == {
        "daniel_demo",
        "emily_demo",
        "evelyn_demo",
        "noah_demo",
    }

    with sqlite3.connect(database_path) as connection:
        connection.row_factory = sqlite3.Row

        counts = {
            table: connection.execute(f"SELECT COUNT(*) AS total FROM {table}").fetchone()["total"]
            for table in (
                "family_space",
                "user_account",
                "family_member",
                "member_access_grant",
                "observation",
                "condition",
                "medication",
                "encounter",
                "sleep_record",
                "workout_record",
                "health_summary",
                "care_plan",
                "chat_session",
                "chat_message",
                "system_config",
            )
        }

        assert counts == {
            "family_space": 1,
            "user_account": 4,
            "family_member": 5,
            "member_access_grant": 3,
            "observation": 27,
            "condition": 8,
            "medication": 6,
            "encounter": 5,
            "sleep_record": 6,
            "workout_record": 6,
            "health_summary": 10,
            "care_plan": 9,
            "chat_session": 3,
            "chat_message": 12,
            "system_config": 1,
        }

        family_space = connection.execute("SELECT * FROM family_space").fetchone()
        assert family_space["name"] == "Carter Family"

        daniel = connection.execute(
            "SELECT * FROM user_account WHERE username = ?",
            ("daniel_demo",),
        ).fetchone()
        assert daniel["role"] == "admin"
        assert verify_password(DEMO_PASSWORD, daniel["password_hash"])

        emily = connection.execute(
            "SELECT * FROM user_account WHERE username = ?",
            ("emily_demo",),
        ).fetchone()
        assert emily["role"] == "member"

        assert (
            connection.execute(
                "SELECT COUNT(*) AS total FROM user_account WHERE username = ?",
                ("legacy_admin",),
            ).fetchone()["total"]
            == 0
        )

        chloe = connection.execute(
            "SELECT * FROM family_member WHERE name = ?",
            ("Chloe Carter",),
        ).fetchone()
        assert chloe["user_account_id"] is None

        today_active_plans = connection.execute(
            """
            SELECT COUNT(*) AS total
            FROM care_plan
            WHERE status = 'active' AND substr(scheduled_at, 1, 10) = '2026-03-22'
            """
        ).fetchone()["total"]
        assert today_active_plans == 6

        ai_plans = connection.execute(
            """
            SELECT COUNT(*) AS total
            FROM care_plan
            WHERE generated_by = 'ai'
            """
        ).fetchone()["total"]
        assert ai_plans == 5

        session_titles = {
            row["title"]
            for row in connection.execute("SELECT title FROM chat_session").fetchall()
        }
        assert session_titles == {
            "Grandma's blood pressure this week",
            "Soccer recovery plan for Noah",
            "Weekly family check-in",
        }

        system_config = connection.execute("SELECT * FROM system_config").fetchone()
        assert dict(system_config) == {
            "key": "ui.language",
            "value": "en",
            "updated_at": "2026-03-20T09:00:00+08:00",
        }


def test_seed_demo_cli_main_seeds_database_and_prints_summary(
    monkeypatch,
    tmp_path,
    capsys,
) -> None:
    database_path = tmp_path / "kincare.db"
    monkeypatch.setenv("KINCARE_DB_PATH", str(database_path))
    monkeypatch.setenv("KINCARE_SKIP_DOTENV", "1")

    result = seed_demo_main()

    assert result == 0
    captured = capsys.readouterr()
    assert f"Seeded demo family into: {database_path}" in captured.out
    assert "Family space: Carter Family" in captured.out
    assert "daniel_demo (admin) -> Daniel Carter" in captured.out

    with sqlite3.connect(database_path) as connection:
        total = connection.execute("SELECT COUNT(*) FROM family_space").fetchone()[0]

    assert total == 1

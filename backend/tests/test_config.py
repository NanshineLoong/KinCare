from __future__ import annotations

from app.core import config as config_module


def test_get_settings_loads_ai_config_from_project_root_dotenv(
    monkeypatch,
    tmp_path,
) -> None:
    repo_root = tmp_path / "repo"
    config_file = repo_root / "backend" / "app" / "core" / "config.py"
    config_file.parent.mkdir(parents=True)
    (repo_root / ".env").write_text(
        "\n".join(
            [
                "KINCARE_AI_BASE_URL=https://example.invalid/v1",
                "KINCARE_AI_API_KEY=test-key",
                "KINCARE_AI_MODEL=test-model",
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.delenv("KINCARE_AI_BASE_URL", raising=False)
    monkeypatch.delenv("KINCARE_AI_API_KEY", raising=False)
    monkeypatch.delenv("KINCARE_AI_MODEL", raising=False)
    monkeypatch.setattr(config_module, "__file__", str(config_file))

    settings = config_module.get_settings()

    assert settings.ai_base_url == "https://example.invalid/v1"
    assert settings.ai_api_key == "test-key"
    assert settings.ai_model == "test-model"


def test_get_settings_uses_kincare_default_database_path(monkeypatch, tmp_path) -> None:
    repo_root = tmp_path / "repo"
    config_file = repo_root / "backend" / "app" / "core" / "config.py"
    config_file.parent.mkdir(parents=True)
    (repo_root / ".env").write_text("", encoding="utf-8")

    for env_name in (
        "KINCARE_DB_PATH",
        "KINCARE_SKIP_DOTENV",
    ):
        monkeypatch.delenv(env_name, raising=False)

    monkeypatch.setattr(config_module, "__file__", str(config_file))

    settings = config_module.get_settings()

    assert settings.database_path.endswith("/backend/data/kincare.db")


def test_get_settings_defaults_local_whisper_download_root_to_none(
    monkeypatch,
    tmp_path,
) -> None:
    repo_root = tmp_path / "repo"
    config_file = repo_root / "backend" / "app" / "core" / "config.py"
    config_file.parent.mkdir(parents=True)
    (repo_root / ".env").write_text("", encoding="utf-8")

    for env_name in (
        "KINCARE_LOCAL_WHISPER_DOWNLOAD_ROOT",
        "KINCARE_SKIP_DOTENV",
    ):
        monkeypatch.delenv(env_name, raising=False)

    monkeypatch.setattr(config_module, "__file__", str(config_file))

    settings = config_module.get_settings()

    assert settings.local_whisper_download_root is None

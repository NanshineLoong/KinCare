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
                "HOMEVITAL_AI_BASE_URL=https://example.invalid/v1",
                "HOMEVITAL_AI_API_KEY=test-key",
                "HOMEVITAL_AI_MODEL=test-model",
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.delenv("HOMEVITAL_AI_BASE_URL", raising=False)
    monkeypatch.delenv("HOMEVITAL_AI_API_KEY", raising=False)
    monkeypatch.delenv("HOMEVITAL_AI_MODEL", raising=False)
    monkeypatch.setattr(config_module, "__file__", str(config_file))

    settings = config_module.get_settings()

    assert settings.ai_base_url == "https://example.invalid/v1"
    assert settings.ai_api_key == "test-key"
    assert settings.ai_model == "test-model"

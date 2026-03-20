from __future__ import annotations

from pathlib import Path
import subprocess


class TextutilUnavailableError(RuntimeError):
    pass


class TextutilParseError(RuntimeError):
    pass


def parse_with_textutil(path: Path) -> dict[str, str | bool]:
    try:
        result = subprocess.run(
            ["textutil", "-convert", "txt", "-stdout", str(path)],
            capture_output=True,
            check=False,
            text=True,
        )
    except FileNotFoundError as error:
        raise TextutilUnavailableError(
            "Legacy .doc parsing requires the macOS `textutil` command, which is unavailable in this environment."
        ) from error

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        raise TextutilParseError(
            stderr or f"Failed to parse `{path.name}` with the system text converter."
        )

    text = result.stdout.strip()
    if not text:
        raise TextutilParseError(f"`{path.name}` did not produce readable text.")

    return {
        "text": text,
        "markdown": text,
        "source_type": "textutil",
        "ocr_used": False,
    }

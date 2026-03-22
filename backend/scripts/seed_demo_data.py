from __future__ import annotations

import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings
from app.core.database import Database
from app.services.demo_seed import seed_demo_family


def main() -> int:
    settings = get_settings()
    database = Database(settings.database_path)
    result = seed_demo_family(database)

    print(f"Seeded demo family into: {settings.database_path}")
    print(f"Family space: {result['family_space']['name']}")
    print(f"Shared password: {result['password']}")
    print("Accounts:")
    for account in result["accounts"]:
        print(
            f"  - {account['username']} ({account['role']}) -> {account['member_name']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

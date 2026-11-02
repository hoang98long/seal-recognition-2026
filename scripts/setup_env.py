"""Create a local .env once; never overwrite existing secrets."""

import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
target = root / "backend/.env"
if not target.exists():
    text = (root / "backend/.env.example").read_text(encoding="utf-8")
    text = text.replace(
        "REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS", secrets.token_urlsafe(48)
    )
    target.write_text(text, encoding="utf-8")
    print(
        "Created backend/.env. Set your local database password and OPENAI_API_KEY there."
    )
else:
    print("Existing backend/.env preserved.")

"""Remove only the random schema and temp directory named by this test run."""

import json
import re
import shutil
import tempfile
from pathlib import Path

from app.core.config import Settings
from sqlalchemy import create_engine

marker = Path(__file__).resolve().parents[1] / "frontend/.e2e-runtime.json"
if marker.is_file():
    state = json.loads(marker.read_text(encoding="utf-8"))
    schema = state["schema"]
    assert re.fullmatch(r"e2e_seal_[a-f0-9]{32}", schema)
    path = Path(state["storage"]).resolve()
    assert path.parent == Path(
        tempfile.gettempdir()
    ).resolve() and path.name.startswith("seal-e2e-")
    engine = create_engine(
        Settings().database_url.get_secret_value(), isolation_level="AUTOCOMMIT"
    )
    with engine.connect() as connection:
        connection.exec_driver_sql(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
    engine.dispose()
    shutil.rmtree(path, ignore_errors=True)
    marker.unlink()

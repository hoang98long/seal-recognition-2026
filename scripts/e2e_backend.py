"""Isolated database and real SDK/mock HTTP server, exclusively for browser tests."""

import json
import os
import secrets
import tempfile
import time
import uuid
from pathlib import Path

import httpx
from alembic import command
from alembic.config import Config
from app.core.config import Settings, get_settings
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url

root = Path(__file__).resolve().parents[1]
settings = Settings()
schema = "e2e_seal_" + uuid.uuid4().hex
url = make_url(settings.database_url.get_secret_value())
owner_engine = create_engine(url, isolation_level="AUTOCOMMIT")
with owner_engine.connect() as connection:
    connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
os.environ.update(
    {
        "DATABASE_URL": url.update_query_dict(
            {"options": f"-csearch_path={schema}"}
        ).render_as_string(hide_password=False),
        "STORAGE_ROOT": tempfile.mkdtemp(prefix="seal-e2e-"),
        "APP_ENV": "development",
        "OPENAI_API_KEY": "e2e-test-only-not-a-real-key",
        "OPENAI_MODEL": "gpt-4.1",
        "SESSION_SECRET_KEY": secrets.token_urlsafe(48),
        "FRONTEND_ORIGIN": "http://localhost:15174",
    }
)
get_settings.cache_clear()
marker = root / "frontend/.e2e-runtime.json"
marker.write_text(
    json.dumps({"schema": schema, "storage": os.environ["STORAGE_ROOT"]}),
    encoding="utf-8",
)

import openai
import uvicorn
from app.core.security import password_hasher
from app.db.models import User
from app.db.session import SessionLocal, engine
from app.main import app
from app.seed import seed


def mock_transport(request):
    payload = json.loads(request.content)
    context_text = payload["input"][1]["content"][0]["text"]
    context = json.loads(context_text[context_text.index("{") :])
    marker = context.get("reference_preprocessing", {}).get("brightness", 0)
    lookup_fixture = context.get("query_preprocessing", {}).get("gamma") == 1.77
    score = {11: 96, 22: 90, 33: 65, 44: 30}.get(marker, 40) if lookup_fixture else 80
    comparison = {
        "status": "success",
        "verdict": "visually_similar",
        "visual_similarity_score": score,
        "visual_confidence_label": "low",
        "same_design_plausible": None,
        "summary_vi": "DEMO — không phải AI thật. Hai ảnh thử nghiệm có vòng tròn và chữ DEMO.",
        "observations_q": ["Ảnh DEMO kiểm thử"],
        "observations_k": ["Ảnh DEMO kiểm thử"],
        "matching_features": [
            {
                "category": "outer_ring",
                "description": "DEMO: vòng ngoài tương đồng",
                "strength": "weak",
                "region_description": "Vòng ngoài",
            },
            {
                "category": "layout",
                "description": "DEMO: bố cục chữ tương đồng.",
                "strength": "moderate",
                "region_description": "Vùng chữ",
            },
        ],
        "differing_features": [
            {
                "category": "text",
                "description": "DEMO: khoảng cách chữ có khác biệt.",
                "strength": "moderate",
                "region_description": "Vùng chữ",
            }
        ],
        "uncertain_features": [],
        "text_recognition_q": ["DEMO"],
        "text_recognition_k": ["DEMO"],
        "limitations": ["DEMO: một phần chi tiết chưa rõ."],
        "recommendation_vi": "Không sử dụng dữ liệu kiểm thử làm kết luận.",
    }
    return httpx.Response(
        200,
        json={
            "id": "resp_e2e_demo",
            "object": "response",
            "created_at": int(time.time()),
            "model": "gpt-4.1",
            "status": "completed",
            "output": [
                {
                    "id": "msg_e2e",
                    "type": "message",
                    "role": "assistant",
                    "status": "completed",
                    "content": [
                        {
                            "type": "output_text",
                            "text": json.dumps(comparison),
                            "annotations": [],
                        }
                    ],
                }
            ],
            "usage": {"input_tokens": 10, "output_tokens": 20, "total_tokens": 30},
        },
    )


def test_client():
    return openai.AsyncOpenAI(
        api_key="e2e-test-only-not-a-real-key",
        max_retries=0,
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(mock_transport)),
    )


import app.matching.providers.openai_vision as vision

vision.configured_client = test_client
try:
    command.upgrade(Config(str(root / "backend/alembic.ini")), "head")
    with SessionLocal() as db:
        seed(db)
        db.add(
            User(
                username="demo_e2e",
                full_name="Phân tích viên DEMO E2E",
                role="analyst",
                password_hash=password_hasher.hash("Demo-e2e-password-2026"),
                must_change_password=False,
            )
        )
        db.commit()
    uvicorn.run(
        app, host="127.0.0.1", port=18081, access_log=False, log_level="warning"
    )
finally:
    engine.dispose()
    assert schema.startswith("e2e_seal_") and len(schema) == 41
    with owner_engine.connect() as connection:
        connection.exec_driver_sql(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
    owner_engine.dispose()
    import shutil

    shutil.rmtree(os.environ["STORAGE_ROOT"], ignore_errors=True)
    marker.unlink(missing_ok=True)

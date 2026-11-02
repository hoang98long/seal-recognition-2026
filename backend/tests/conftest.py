"""Use a unique PostgreSQL schema, never truncate the application's tables."""

import io
import os
import secrets
import tempfile
import uuid
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url

from alembic import command
from app.core.config import Settings, get_settings

original_settings = Settings()
test_schema = "test_seal_" + uuid.uuid4().hex
base_url = make_url(original_settings.database_url.get_secret_value())
admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")
with admin_engine.connect() as connection:
    connection.exec_driver_sql(f'CREATE SCHEMA "{test_schema}"')
test_url = base_url.update_query_dict({"options": f"-csearch_path={test_schema}"})
os.environ["DATABASE_URL"] = test_url.render_as_string(hide_password=False)
os.environ["STORAGE_ROOT"] = tempfile.mkdtemp(prefix="seal-tests-")
os.environ["OPENAI_API_KEY"] = ""
os.environ["APP_ENV"] = "development"
os.environ["SESSION_SECRET_KEY"] = secrets.token_urlsafe(48)
get_settings.cache_clear()

from app.core.security import limiter, password_hasher  # noqa: E402
from app.db.models import User  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def database():
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"))
    command.upgrade(config, "head")
    with SessionLocal() as db:
        seed(db)
        seed(db)
    yield
    engine.dispose()
    # The random schema created above is the only object removed.
    assert test_schema.startswith("test_seal_") and len(test_schema) == 42
    with admin_engine.connect() as connection:
        connection.exec_driver_sql(f'DROP SCHEMA "{test_schema}" CASCADE')
    admin_engine.dispose()
    import shutil

    shutil.rmtree(os.environ["STORAGE_ROOT"])


@pytest.fixture
def db(database):
    with SessionLocal() as session:
        yield session


@pytest.fixture
def anonymous(database):
    limiter.entries.clear()
    with TestClient(app) as client:
        yield client


def make_client(role="admin"):
    name = "user_" + uuid.uuid4().hex[:12]
    with SessionLocal() as db:
        user = User(
            username=name,
            full_name="Người dùng DEMO",
            password_hash=password_hasher.hash("Test-password-42"),
            role=role,
            must_change_password=False,
        )
        db.add(user)
        db.commit()
    client = TestClient(app)
    response = client.post("/api/v1/auth/login", json={"username": name, "password": "Test-password-42"})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return client


@pytest.fixture
def client(database):
    limiter.entries.clear()
    with make_client() as value:
        yield value


@pytest.fixture
def analyst(database):
    with make_client("analyst") as value:
        yield value


@pytest.fixture
def viewer(database):
    with make_client("viewer") as value:
        yield value


def demo_image(color="red", size=(240, 200)):
    image = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(image)
    draw.ellipse((35, 25, 195, 185), outline=color, width=4)
    draw.text((80, 95), "DEMO", fill=color)
    return image


@pytest.fixture
def image_bytes():
    stream = io.BytesIO()
    demo_image().save(stream, "PNG")
    return stream.getvalue()


def upload_image(client, data):
    response = client.post("/api/v1/assets/upload", files={"file": ("demo.png", data, "image/png")})
    assert response.status_code == 201, response.text
    return response.json()


def apply_image(client, asset, **parameters):
    response = client.post(
        "/api/v1/preprocessing/apply",
        json={
            "source_asset_id": asset["id"],
            "roi": {"x": 20, "y": 10, "width": 200, "height": 185},
            "roi_confirmed": True,
            "parameters": parameters,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def processed_pair(client, image_bytes):
    asset = upload_image(client, image_bytes)
    q = apply_image(client, asset)
    k = apply_image(client, asset, contrast=1.05)
    return q["asset"], k["asset"]


@pytest.fixture
def analysis(client, processed_pair):
    q, k = processed_pair
    response = client.post(
        "/api/v1/analyses",
        json={
            "title": "Phiên DEMO",
            "mode": "pairwise",
            "query_asset_id": q["id"],
            "candidates": [{"reference_asset_id": k["id"]}],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def comparison_data():
    return {
        "status": "success",
        "verdict": "visually_similar",
        "visual_similarity_score": 83.5,
        "visual_confidence_label": "medium",
        "same_design_plausible": True,
        "summary_vi": "Hai ảnh DEMO có bố cục tương đồng biểu kiến.",
        "observations_q": ["Vòng tròn đỏ"],
        "observations_k": ["Vòng tròn đỏ"],
        "matching_features": [
            {
                "category": "outer_ring",
                "description": "Đều có vòng tròn",
                "strength": "moderate",
                "region_description": "Vùng viền ngoài",
            }
        ],
        "differing_features": [],
        "uncertain_features": [],
        "text_recognition_q": ["DEMO"],
        "text_recognition_k": ["DEMO"],
        "limitations": ["Chỉ là ảnh DEMO thử nghiệm"],
        "recommendation_vi": "Kiểm tra ảnh gốc nếu cần thêm chi tiết.",
    }

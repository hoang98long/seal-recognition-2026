from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.security import password_hasher, verify_password
from app.db.models import User


def test_seed_login_and_required_password_change(anonymous, db):
    user = db.scalar(select(User).where(User.username == "admin"))
    assert user.password_hash != "admin"
    assert user.password_hash.startswith("$argon2")
    assert verify_password("admin", user.password_hash)
    assert db.scalar(select(func.count()).select_from(User).where(User.username == "admin")) == 1
    response = anonymous.post("/api/v1/auth/login", json={"username": "ADMIN", "password": "admin"})
    assert response.status_code == 200
    assert "HttpOnly" in response.headers.get_list("set-cookie")[0]
    assert "password_hash" not in response.text
    anonymous.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    assert anonymous.get("/api/v1/auth/me").json()["must_change_password"] is True
    assert anonymous.get("/api/v1/organizations").status_code == 403
    bad = anonymous.post(
        "/api/v1/auth/change-password", json={"old_password": "wrong", "new_password": "Changed-password-42"}
    )
    assert bad.status_code == 422
    changed = anonymous.post(
        "/api/v1/auth/change-password", json={"old_password": "admin", "new_password": "Changed-password-42"}
    )
    assert changed.status_code == 200
    assert changed.json()["user"]["must_change_password"] is False
    anonymous.headers["X-CSRF-Token"] = changed.json()["csrf_token"]
    assert anonymous.get("/api/v1/organizations").status_code == 200


def test_no_login_csrf_and_roles(anonymous, client, viewer, analyst):
    assert anonymous.get("/api/v1/auth/me").status_code == 401
    headers = client.headers.pop("X-CSRF-Token")
    assert client.post("/api/v1/organizations", json={"name": "CSRF DEMO"}).status_code == 403
    client.headers["X-CSRF-Token"] = headers
    assert (
        client.post(
            "/api/v1/organizations", json={"name": "DEMO"}, headers={"Origin": "https://untrusted.example"}
        ).status_code
        == 403
    )
    assert viewer.post("/api/v1/organizations", json={"name": "DEMO"}).status_code == 403
    assert analyst.get("/api/v1/users").status_code == 403
    assert viewer.post("/api/v1/settings/openai/test", json={}).status_code == 403


def test_login_rate_limit(anonymous):
    for _ in range(10):
        assert (
            anonymous.post(
                "/api/v1/auth/login", json={"username": "missing", "password": "wrong"}
            ).status_code
            == 401
        )
    assert (
        anonymous.post("/api/v1/auth/login", json={"username": "missing", "password": "wrong"}).status_code
        == 429
    )


def test_production_rejects_default_password(anonymous, db, monkeypatch):
    user = User(
        username="unsafe",
        full_name="DEMO",
        role="admin",
        password_hash=password_hasher.hash("admin"),
        must_change_password=False,
    )
    db.add(user)
    db.commit()
    monkeypatch.setattr(get_settings(), "app_env", "production")
    assert (
        anonymous.post("/api/v1/auth/login", json={"username": "unsafe", "password": "admin"}).status_code
        == 403
    )


def test_password_change_revokes_other_sessions(client):
    me = client.get("/api/v1/auth/me").json()
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as other:
        assert (
            other.post(
                "/api/v1/auth/login", json={"username": me["username"], "password": "Test-password-42"}
            ).status_code
            == 200
        )
        assert (
            client.post(
                "/api/v1/auth/change-password",
                json={"old_password": "Test-password-42", "new_password": "New-password-42"},
            ).status_code
            == 200
        )
        assert other.get("/api/v1/auth/me").status_code == 401

from app.schemas.common import ChangePassword, Login


def test_password_whitespace_is_preserved():
    assert Login(username="demo", password=" with spaces ").password == " with spaces "
    assert (
        ChangePassword(old_password=" with spaces ", new_password=" with more spaces ").new_password
        == " with more spaces "
    )


def test_all_product_routes_and_response_contract(client):
    schema = client.get("/openapi.json").json()
    for path in [
        "/auth/login",
        "/organizations",
        "/seal-designs",
        "/seal-devices",
        "/seal-impressions",
        "/documents",
        "/preprocessing/apply",
        "/analyses",
        "/settings/openai/test",
    ]:
        assert "/api/v1" + path in schema["paths"]
    dashboard = client.get("/api/v1/dashboard/summary").json()
    assert all(isinstance(dashboard[key], int) for key in ["documents", "designs", "impressions", "analyses"])


def test_fingerprint_path_traversal_is_denied(client, db, image_bytes):
    import uuid

    from conftest import upload_image

    from app.db.models import FileAsset

    asset = upload_image(client, image_bytes)
    stored = db.get(FileAsset, uuid.UUID(asset["id"]))
    original = stored.relative_storage_path
    stored.relative_storage_path = "../outside-test-file.png"
    db.commit()
    assert client.get(f"/api/v1/assets/{stored.id}/download").status_code == 403
    stored.relative_storage_path = original
    db.commit()

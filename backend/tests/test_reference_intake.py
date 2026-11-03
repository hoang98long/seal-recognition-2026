import uuid

from conftest import apply_image, upload_image


def test_intake_new_organization_and_reuse_design(analyst, viewer, image_bytes):
    prepared = apply_image(analyst, upload_image(analyst, image_bytes))
    ident = prepared["asset"]["id"]
    assert viewer.get(f"/api/v1/preprocessing/by-output/{ident}").status_code == 403
    result = analyst.post(
        "/api/v1/reference-intake",
        json={
            "organization_name": "Đơn vị thử " + uuid.uuid4().hex,
            "name": "Dấu thử",
            "image_asset_id": ident,
        },
    )
    assert result.status_code == 201, result.text
    reference = result.json()
    assert reference["is_reference"]
    assert reference["verification_status"] == "reference_only"
    assert reference["seal_device_id"] is None
    detail = viewer.get(f"/api/v1/seal-impressions/{reference['id']}").json()
    assert detail["organization_name"] == reference["organization_name"]
    assert detail["design_name"] == "Dấu thử"
    shared = viewer.get(f"/api/v1/preprocessing/by-output/{ident}")
    assert shared.status_code == 200
    assert shared.json()["run"]["id"] == prepared["run"]["id"]
    assert shared.json()["asset"]["id"] == ident
    second = analyst.post(
        "/api/v1/reference-intake",
        json={
            "organization_id": reference["organization_id"],
            "seal_design_id": reference["seal_design_id"],
            "name": "Ignored new name",
            "image_asset_id": ident,
        },
    )
    assert second.status_code == 201, second.text
    assert second.json()["seal_design_id"] == reference["seal_design_id"]
    designs = analyst.get(f"/api/v1/seal-designs?organization_id={reference['organization_id']}").json()
    assert designs["total"] == 1


def test_intake_requires_prepared_image_and_permissions(client, analyst, viewer, image_bytes):
    asset = upload_image(client, image_bytes)
    payload = {"organization_name": "Do not create", "name": "Dấu", "image_asset_id": asset["id"]}
    assert client.post("/api/v1/reference-intake", json=payload).status_code == 422
    assert analyst.post("/api/v1/reference-intake", json=payload).status_code == 403
    assert viewer.post("/api/v1/reference-intake", json=payload).status_code == 403
    assert client.get(f"/api/v1/preprocessing/by-output/{asset['id']}").json() is None
    assert analyst.get(f"/api/v1/preprocessing/by-output/{asset['id']}").status_code == 403


def test_intake_validates_organization_design(client, processed_pair):
    asset = processed_pair[0]
    a = client.post("/api/v1/organizations", json={"name": "A"}).json()
    b = client.post("/api/v1/organizations", json={"name": "B"}).json()
    design = client.post("/api/v1/seal-designs", json={"name": "Dấu A", "organization_id": a["id"]}).json()
    payload = {
        "organization_id": b["id"],
        "seal_design_id": design["id"],
        "name": "Dấu",
        "image_asset_id": asset["id"],
    }
    response = client.post("/api/v1/reference-intake", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "design_organization"
    assert client.get(f"/api/v1/seal-impressions?organization_id={b['id']}").json()["total"] == 0
    assert (
        client.post("/api/v1/reference-intake", json={**payload, "organization_name": "C"}).status_code == 422
    )
    client.patch(f"/api/v1/organizations/{b['id']}", json={"status": "inactive"})
    assert client.post("/api/v1/reference-intake", json=payload).status_code == 422


def test_intake_rolls_back_new_rows_on_failure(client, processed_pair, monkeypatch):
    from app.api.v1 import library
    from app.core.exceptions import AppError

    def fail(*args):
        raise AppError(422, "intake_test", "Failure after organization and design flush")

    name = "Rollback " + uuid.uuid4().hex
    monkeypatch.setattr(library, "validate_references", fail)
    result = client.post(
        "/api/v1/reference-intake",
        json={"organization_name": name, "name": name, "image_asset_id": processed_pair[0]["id"]},
    )
    assert result.status_code == 422
    assert client.get("/api/v1/organizations", params={"q": name}).json()["total"] == 0
    assert client.get("/api/v1/seal-designs", params={"q": name}).json()["total"] == 0

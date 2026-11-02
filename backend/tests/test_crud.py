import uuid

from conftest import apply_image, upload_image


def test_organization_design_impression_and_authorization(analyst, viewer, image_bytes):
    org = analyst.post(
        "/api/v1/organizations",
        json={"name": "Tổ chức DEMO " + uuid.uuid4().hex[:6], "code": uuid.uuid4().hex[:10]},
    )
    assert org.status_code == 201, org.text
    design = analyst.post(
        "/api/v1/seal-designs",
        json={"organization_id": org.json()["id"], "name": "Dấu DEMO", "design_code": uuid.uuid4().hex[:10]},
    )
    assert design.status_code == 201
    device = analyst.post(
        "/api/v1/seal-devices",
        json={"seal_design_id": design.json()["id"], "internal_device_code": uuid.uuid4().hex[:10]},
    )
    assert device.status_code == 201
    image = apply_image(analyst, upload_image(analyst, image_bytes))["asset"]
    impression = analyst.post(
        "/api/v1/seal-impressions",
        json={
            "seal_design_id": design.json()["id"],
            "image_asset_id": image["id"],
            "seal_device_id": device.json()["id"],
            "note": "Ảnh tham chiếu DEMO",
            "is_reference": True,
        },
    )
    assert impression.status_code == 201, impression.text
    assert impression.json()["organization_id"] == org.json()["id"]
    assert viewer.get(f"/api/v1/assets/{image['id']}/preview").status_code == 200
    search = viewer.get("/api/v1/seal-impressions?q=Dấu%20DEMO&organization_id=" + org.json()["id"]).json()
    assert search["total"] == 1
    assert search["items"][0]["design_name"] == "Dấu DEMO"
    assert viewer.patch(f"/api/v1/seal-designs/{design.json()['id']}", json={"name": "No"}).status_code == 403
    edited = analyst.patch(f"/api/v1/seal-designs/{design.json()['id']}", json={"name": "Dấu DEMO sửa"})
    assert edited.status_code == 200, edited.text
    assert analyst.delete(f"/api/v1/organizations/{org.json()['id']}").status_code == 200
    assert analyst.get(f"/api/v1/organizations/{org.json()['id']}").status_code == 404
    assert analyst.get(f"/api/v1/seal-designs/{design.json()['id']}").status_code == 200


def test_unknown_device_and_private_impression(analyst, viewer, image_bytes):
    org = analyst.post("/api/v1/organizations", json={"name": "DEMO riêng"}).json()
    design = analyst.post(
        "/api/v1/seal-designs", json={"organization_id": org["id"], "name": "DEMO chưa rõ dụng cụ"}
    ).json()
    asset = upload_image(analyst, image_bytes)
    impression = analyst.post(
        "/api/v1/seal-impressions",
        json={"seal_design_id": design["id"], "image_asset_id": asset["id"], "is_reference": False},
    )
    assert impression.status_code == 201
    assert impression.json()["seal_device_id"] is None
    assert viewer.get(f"/api/v1/assets/{asset['id']}/preview").status_code == 403
    assert viewer.get(f"/api/v1/seal-impressions/{impression.json()['id']}").status_code == 403


def test_organization_cycles_and_duplicate_codes(client):
    code = uuid.uuid4().hex[:10]
    a = client.post("/api/v1/organizations", json={"name": "DEMO A", "code": code}).json()
    b = client.post(
        "/api/v1/organizations", json={"name": "DEMO B", "parent_organization_id": a["id"]}
    ).json()
    assert (
        client.patch(f"/api/v1/organizations/{a['id']}", json={"parent_organization_id": b["id"]}).status_code
        == 422
    )
    assert client.post("/api/v1/organizations", json={"name": "DEMO C", "code": code}).status_code == 409


def test_user_management(client, analyst):
    name = "demo_" + uuid.uuid4().hex[:12]
    result = client.post(
        "/api/v1/users",
        json={"username": name, "full_name": "DEMO", "password": "Temporary-password-42", "role": "viewer"},
    )
    assert result.status_code == 201
    assert result.json()["must_change_password"]
    assert "password_hash" not in result.text
    assert analyst.get("/api/v1/users").status_code == 403
    assert client.patch(f"/api/v1/users/{result.json()['id']}", json={"is_active": False}).status_code == 200

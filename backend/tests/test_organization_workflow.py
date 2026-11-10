import uuid

from conftest import apply_image, upload_image
from sqlalchemy import select

from app.db.models import Organization
from app.organization_catalog import sync_catalog


def test_catalog_sync_is_idempotent(client, db):
    user = client.get("/api/v1/auth/me").json()
    # The auth response contains the current user's public fields.
    ident = user.get("id") or user["user"]["id"]
    sync_catalog(db, uuid.UUID(ident))
    db.commit()
    assert sync_catalog(db, uuid.UUID(ident)) == []
    db.commit()
    assert (
        len(
            db.scalars(
                select(Organization).where(Organization.code.in_(["VPCP", "TTCP", "BCA", "BQP"]))
            ).all()
        )
        == 4
    )


def test_shared_organization_presets_and_legacy_assignment(analyst, viewer, client, image_bytes):
    org = analyst.post("/api/v1/organizations", json={"name": "Cấu hình theo tổ chức"}).json()
    old = analyst.post(
        "/api/v1/preprocessing/profiles", json={"name": "Cấu hình cũ", "parameters": {"red_mask": True}}
    ).json()
    assert old["id"] not in {x["id"] for x in viewer.get("/api/v1/preprocessing/profiles").json()}
    linked = analyst.patch(
        f"/api/v1/preprocessing/profiles/{old['id']}/organization", json={"organization_id": org["id"]}
    )
    assert linked.status_code == 200, linked.text
    shared = viewer.get(f"/api/v1/preprocessing/profiles?organization_id={org['id']}").json()
    assert old["id"] in {x["id"] for x in shared}
    assert (
        client.patch(
            f"/api/v1/preprocessing/profiles/{old['id']}/organization", json={"organization_id": None}
        ).status_code
        == 200
    )
    # An unrelated analyst cannot reassign a preset they do not own.
    unrelated = client.post("/api/v1/preprocessing/profiles", json={"name": "Other", "parameters": {}}).json()
    assert (
        analyst.patch(
            f"/api/v1/preprocessing/profiles/{unrelated['id']}/organization",
            json={"organization_id": org["id"]},
        ).status_code
        == 403
    )


def test_document_provenance_and_renaming_preserve_bytes(analyst, viewer, client, image_bytes):
    org = analyst.post(
        "/api/v1/organizations", json={"name": "Tổ chức nguồn", "code": "SRC-" + uuid.uuid4().hex[:8]}
    ).json()
    asset = upload_image(analyst, image_bytes)
    doc = analyst.post(
        "/api/v1/documents",
        json={"file_asset_id": asset["id"], "display_name": "Văn bản nguồn", "organization_id": org["id"]},
    ).json()
    source_docs = analyst.get(f"/api/v1/documents?organization_id={org['id']}").json()
    assert doc["id"] in {x["id"] for x in source_docs["items"]}
    prepared = apply_image(analyst, asset)
    original_data = analyst.get(f"/api/v1/assets/{prepared['asset']['id']}/download").content
    saved = analyst.post(
        "/api/v1/reference-intake",
        json={
            "organization_id": org["id"],
            "name": "Dấu nguồn",
            "image_asset_id": prepared["asset"]["id"],
            "source_document_id": doc["id"],
            "source_page": 1,
        },
    )
    assert saved.status_code == 201, saved.text
    renamed = analyst.patch(
        f"/api/v1/assets/{prepared['asset']['id']}", json={"display_name": "Dấu TTCP (mẫu 2026)"}
    )
    assert renamed.status_code == 200
    assert renamed.json()["sha256"] == prepared["asset"]["sha256"]
    assert analyst.get(f"/api/v1/assets/{prepared['asset']['id']}/download").content == original_data
    assert (
        viewer.patch(f"/api/v1/assets/{prepared['asset']['id']}", json={"display_name": "No"}).status_code
        == 403
    )
    another = client.post("/api/v1/organizations", json={"name": "Khác"}).json()
    assert (
        analyst.post(
            "/api/v1/documents",
            json={
                "file_asset_id": asset["id"],
                "display_name": "Không được ghi đè",
                "organization_id": another["id"],
            },
        ).status_code
        == 409
    )
    assert viewer.get(f"/api/v1/documents/{doc['id']}").status_code == 403

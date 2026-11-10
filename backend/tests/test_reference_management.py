import uuid

from conftest import apply_image, upload_image
from pydantic import SecretStr

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.matching.base import MatchOutput
from app.schemas.comparison import SealVisualComparison


def create_reference(client, asset):
    response = client.post(
        "/api/v1/reference-intake",
        json={
            "organization_name": "Quản lý dấu " + uuid.uuid4().hex,
            "name": "Dấu ban đầu",
            "image_asset_id": asset["id"],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_edit_name_note_replace_image_and_reset_verification(client, processed_pair):
    old, new = processed_pair
    reference = create_reference(client, old)
    ident = reference["id"]
    client.patch(
        f"/api/v1/seal-impressions/{ident}", json={"verification_status": "verified", "observed_color": "red"}
    )
    old_metadata = client.get(f"/api/v1/assets/{old['id']}").json()
    edited = client.patch(
        f"/api/v1/reference-intake/{ident}", json={"name": "Dấu đổi tên", "note": "Ghi chú mới"}
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["design_name"] == "Dấu đổi tên"
    assert edited.json()["note"] == "Ghi chú mới"
    assert edited.json()["verification_status"] == "verified"
    replaced = client.patch(
        f"/api/v1/reference-intake/{ident}",
        json={"name": "Dấu ảnh mới", "note": None, "image_asset_id": new["id"]},
    )
    assert replaced.status_code == 200, replaced.text
    result = replaced.json()
    assert result["id"] == ident
    assert result["image_asset_id"] == new["id"]
    assert result["verification_status"] == "reference_only"
    assert result["observed_color"] is None
    assert result["note"] is None
    assert result["source_page"] == 1
    doc = client.get(f"/api/v1/documents/{result['source_document_id']}").json()
    assert doc["organization_id"] == reference["organization_id"]
    assert doc["file_asset_id"] == old["source_metadata"]["source_asset_id"]
    assert client.get(f"/api/v1/assets/{old['id']}").json() == old_metadata
    listing = client.get(f"/api/v1/seal-impressions?organization_id={reference['organization_id']}").json()
    assert listing["total"] == 1
    assert listing["items"][0]["design_name"] == "Dấu ảnh mới"


def test_invalid_replacement_and_foreign_source_are_atomic(client, processed_pair, image_bytes):
    reference = create_reference(client, processed_pair[0])
    path = f"/api/v1/reference-intake/{reference['id']}"
    original = upload_image(client, image_bytes)
    bad = client.patch(path, json={"name": "Không được đổi", "image_asset_id": original["id"]})
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "reference_roi"
    other_org = client.post("/api/v1/organizations", json={"name": "Tổ chức nguồn khác"}).json()
    client.post(
        "/api/v1/documents",
        json={
            "file_asset_id": original["id"],
            "organization_id": other_org["id"],
            "display_name": "Nguồn khác",
        },
    )
    bad_source = client.patch(
        path, json={"name": "Không được đổi", "image_asset_id": processed_pair[1]["id"]}
    )
    assert bad_source.status_code == 422
    assert bad_source.json()["error"]["code"] == "document_organization"
    stored = client.get(f"/api/v1/seal-impressions/{reference['id']}").json()
    assert stored["design_name"] == reference["design_name"]
    assert stored["image_asset_id"] == reference["image_asset_id"]
    assert client.patch(path, json={"name": "   "}).status_code == 422


def test_replacement_rolls_back_new_document_on_failure(client, processed_pair, monkeypatch):
    from app.api.v1 import library

    reference = create_reference(client, processed_pair[0])

    def fail(*args):
        raise AppError(422, "update_test", "Failure after source document flush")

    monkeypatch.setattr(library, "validate_references", fail)
    response = client.patch(
        f"/api/v1/reference-intake/{reference['id']}",
        json={"name": "Không được đổi", "image_asset_id": processed_pair[1]["id"]},
    )
    assert response.status_code == 422
    stored = client.get(f"/api/v1/seal-impressions/{reference['id']}").json()
    assert stored["design_name"] == reference["design_name"]
    assert stored["image_asset_id"] == reference["image_asset_id"]
    assert (
        client.get(f"/api/v1/documents?organization_id={reference['organization_id']}").json()["total"] == 0
    )


def test_reference_edit_delete_permissions(client, analyst, viewer, processed_pair, image_bytes):
    reference = create_reference(client, processed_pair[0])
    path = f"/api/v1/reference-intake/{reference['id']}"
    assert viewer.patch(path, json={"name": "Không có quyền"}).status_code == 403
    assert viewer.delete(f"/api/v1/seal-impressions/{reference['id']}").status_code == 403
    private = apply_image(analyst, upload_image(analyst, image_bytes))["asset"]
    assert (
        client.patch(path, json={"name": "Riêng tư", "image_asset_id": private["id"]}).status_code == 200
    )  # admin
    assert (
        client.patch(f"/api/v1/seal-impressions/{reference['id']}", json={"is_reference": False}).status_code
        == 200
    )
    assert analyst.patch(path, json={"name": "Không có quyền"}).status_code == 403
    assert analyst.delete(f"/api/v1/seal-impressions/{reference['id']}").status_code == 403


def test_replace_delete_preserve_results_images_and_private_history(
    client, analyst, viewer, processed_pair, image_bytes, comparison_data, monkeypatch
):
    reference = create_reference(client, processed_pair[1])
    old_asset = reference["image_asset_id"]
    q = apply_image(analyst, upload_image(analyst, image_bytes))["asset"]
    created = analyst.post(
        "/api/v1/analyses",
        json={
            "title": "Lịch sử trước thay dấu",
            "query_asset_id": q["id"],
            "candidates": [{"reference_asset_id": old_asset, "reference_impression_id": reference["id"]}],
        },
    )
    assert created.status_code == 201, created.text
    session_id = created.json()["id"]

    class Provider:
        async def analyse(self, request):
            return MatchOutput(
                SealVisualComparison.model_validate(comparison_data), "test-model", "test-request", None
            )

    monkeypatch.setattr(get_settings(), "openai_api_key", SecretStr("test-key"))
    monkeypatch.setattr("app.services.analysis_orchestrator.get_provider", lambda: Provider())
    response = analyst.post(f"/api/v1/analyses/{session_id}/compare-openai", json={"consent": True})
    assert response.status_code == 200, response.text
    before = analyst.get(f"/api/v1/analyses/{session_id}/results").json()
    old_image = analyst.get(f"/api/v1/assets/{old_asset}/preview").content
    assert (
        client.patch(
            f"/api/v1/reference-intake/{reference['id']}",
            json={"name": "Dấu mới", "image_asset_id": processed_pair[0]["id"]},
        ).status_code
        == 200
    )
    assert analyst.get(f"/api/v1/assets/{old_asset}/preview").content == old_image
    assert viewer.get(f"/api/v1/assets/{old_asset}/preview").status_code == 403
    inventory_before = client.get("/api/v1/library-searches/inventory").json()["reference_count"]
    assert client.delete(f"/api/v1/seal-impressions/{reference['id']}").status_code == 200
    assert client.get(f"/api/v1/seal-impressions/{reference['id']}").status_code == 404
    assert (
        client.patch(
            f"/api/v1/reference-intake/{reference['id']}", json={"name": "Không khôi phục"}
        ).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/v1/seal-impressions?organization_id={reference['organization_id']}&status=all"
        ).json()["total"]
        == 0
    )
    assert client.get("/api/v1/library-searches/inventory").json()["reference_count"] == inventory_before - 1
    assert analyst.get(f"/api/v1/analyses/{session_id}/results").json() == before
    assert analyst.get(f"/api/v1/assets/{old_asset}/preview").content == old_image
    assert analyst.get(f"/api/v1/reports/{session_id}").status_code == 200
    assert viewer.get(f"/api/v1/reports/{session_id}").status_code == 403

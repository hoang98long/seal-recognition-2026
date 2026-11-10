from copy import deepcopy

from conftest import apply_image, upload_image

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.matching.base import MatchOutput
from app.schemas.comparison import SealVisualComparison


def install_scoring(monkeypatch, comparison_data, scores=None, fail_once=False):
    calls = []
    failed = False

    class Provider:
        async def analyse(self, request):
            nonlocal failed
            calls.append(request.reference_path.stem)
            if fail_once and not failed and len(calls) == 2:
                failed = True
                raise AppError(429, "provider_rate_limit", "Giới hạn API trong kiểm thử")
            data = deepcopy(comparison_data)
            data["visual_similarity_score"] = (scores or {}).get(request.reference_path.stem, 10)
            if data["visual_similarity_score"] is None:
                data["status"] = "insufficient_data"
                data["verdict"] = "insufficient_evidence"
            return MatchOutput(SealVisualComparison.model_validate(data), "mock-model", "mock-request", None)

    monkeypatch.setattr("app.services.analysis_orchestrator.get_provider", lambda: Provider())
    monkeypatch.setattr(
        get_settings(), "openai_api_key", get_settings().openai_api_key.__class__("test-only")
    )
    return calls


def add_corpus(client, image_bytes):
    source = upload_image(client, image_bytes)
    expected = {}
    scores = {}
    for i, org_scores in enumerate([[95, 97], [90, 72], [65, 55], [20]]):
        org = client.post("/api/v1/organizations", json={"name": f"Ranking test {i}"}).json()
        expected[org["id"]] = max(org_scores)
        for score in org_scores:
            prepared = apply_image(client, source)
            asset_id = prepared["asset"]["id"]
            result = client.post(
                "/api/v1/reference-intake",
                json={"organization_id": org["id"], "name": f"Mẫu {score}", "image_asset_id": asset_id},
            )
            assert result.status_code == 201, result.text
            scores[asset_id] = score
    return apply_image(client, source)["asset"], expected, scores


def test_all_library_references_and_distinct_top_three(
    client, viewer, analyst, image_bytes, comparison_data, monkeypatch
):
    q, expected, scores = add_corpus(client, image_bytes)
    calls = install_scoring(monkeypatch, comparison_data, scores)
    count = client.get("/api/v1/library-searches/inventory").json()["reference_count"]
    assert count > 5
    body = {"query_asset_id": q["id"], "consent": False, "expected_reference_count": count}
    assert client.post("/api/v1/library-searches", json=body).status_code == 422
    assert (
        client.post(
            "/api/v1/library-searches", json={**body, "consent": True, "expected_reference_count": count + 1}
        ).status_code
        == 409
    )
    assert not calls
    started = client.post("/api/v1/library-searches", json={**body, "consent": True})
    assert started.status_code == 201, started.text
    ident = started.json()["id"]
    state = client.get(f"/api/v1/library-searches/{ident}").json()
    assert state["status"] == "completed", state
    assert state["complete_scan"]
    assert state["processed"] == count == len(calls)
    assert [x["score"] for x in state["rankings"]] == [97, 90, 65]
    assert len({x["id"] for x in state["rankings"]}) == 3
    for row in state["rankings"]:
        assert expected[row["id"]] == row["score"]
    results = client.get(f"/api/v1/analyses/{ident}/results").json()
    assert all(x["input_metadata"]["reference_organization"] for x in results)
    assert analyst.get(f"/api/v1/library-searches/{ident}").status_code == 403
    assert viewer.post("/api/v1/library-searches", json={**body, "consent": True}).status_code == 403
    assert client.post(f"/api/v1/analyses/{ident}/compare-openai", json={"consent": True}).status_code == 422
    report = client.get(f"/api/v1/reports/{ident}/export?download=true")
    assert report.status_code == 200
    assert "Top tổ chức tương đồng" in report.text


def test_resume_retains_completed_comparisons(client, image_bytes, comparison_data, monkeypatch):
    q, _, scores = add_corpus(client, image_bytes)
    calls = install_scoring(monkeypatch, comparison_data, scores, fail_once=True)
    count = client.get("/api/v1/library-searches/inventory").json()["reference_count"]
    started = client.post(
        "/api/v1/library-searches",
        json={"query_asset_id": q["id"], "consent": True, "expected_reference_count": count},
    ).json()
    ident = started["id"]
    state = client.get(f"/api/v1/library-searches/{ident}").json()
    assert state["status"] == "failed"
    assert not state["complete_scan"]
    assert len(state["errors"]) == 1
    assert client.post(f"/api/v1/library-searches/{ident}/resume", json={"consent": False}).status_code == 422
    resumed = client.post(f"/api/v1/library-searches/{ident}/resume", json={"consent": True})
    assert resumed.status_code == 202, resumed.text
    complete = client.get(f"/api/v1/library-searches/{ident}").json()
    assert complete["complete_scan"], complete
    assert complete["retry_count"] == 0
    assert len(calls) == count + 1
    assert calls.count(calls[0]) == 1


def test_no_score_is_not_invented(client, processed_pair, comparison_data, monkeypatch, db):
    from app.services.library_search_service import corpus_query

    ids = {str(item.image_asset_id): None for item in db.scalars(corpus_query())}
    assert ids
    install_scoring(monkeypatch, comparison_data, ids)
    count = client.get("/api/v1/library-searches/inventory").json()["reference_count"]
    result = client.post(
        "/api/v1/library-searches",
        json={"query_asset_id": processed_pair[0]["id"], "consent": True, "expected_reference_count": count},
    )
    assert result.status_code == 201, result.text
    state = client.get(f"/api/v1/library-searches/{result.json()['id']}").json()
    assert state["complete_scan"]
    assert state["rankings"] == []
    assert state["insufficient_count"] == count


def test_score_display_boundaries():
    from app.services.report_service import score_band

    assert score_band(None) == "gray"
    assert score_band(90) == "yellow"
    assert score_band(90.01) == "green"
    assert score_band(70) == "yellow"
    assert score_band(69.99) == "red"

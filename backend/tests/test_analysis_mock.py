import json
import time

import httpx
import openai
import pytest
from conftest import upload_image
from pydantic import SecretStr

from app.core.config import get_settings


def install_mock(monkeypatch, comparison, status=200, error=None, refusal=False):
    monkeypatch.setattr(get_settings(), "openai_api_key", SecretStr("test-key-not-a-real-secret"))
    calls = []

    def handler(request):
        calls.append(json.loads(request.content))
        if error:
            raise error
        if status != 200:
            return httpx.Response(
                status,
                json={
                    "error": {
                        "message": "upstream detail must not be leaked",
                        "type": "api_error",
                        "code": "test",
                    }
                },
            )
        content = (
            [{"type": "refusal", "refusal": "DEMO refusal"}]
            if refusal
            else [{"type": "output_text", "text": json.dumps(comparison), "annotations": []}]
        )
        return httpx.Response(
            200,
            json={
                "id": "resp_demo",
                "object": "response",
                "created_at": int(time.time()),
                "model": "gpt-4.1",
                "status": "completed",
                "output": [
                    {
                        "id": "msg_demo",
                        "type": "message",
                        "role": "assistant",
                        "status": "completed",
                        "content": content,
                    }
                ],
                "usage": {"input_tokens": 12, "output_tokens": 20, "total_tokens": 32},
            },
        )

    def client():
        return openai.AsyncOpenAI(
            api_key="test-key-not-a-real-secret",
            max_retries=0,
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

    monkeypatch.setattr("app.matching.providers.openai_vision.configured_client", client)
    return calls


def test_sdk_structured_result_persist_rerun_report_and_annotations(
    client, analysis, comparison_data, monkeypatch
):
    calls = install_mock(monkeypatch, comparison_data)
    ident = analysis["id"]
    response = client.post(f"/api/v1/analyses/{ident}/compare-openai", json={"consent": True})
    assert response.status_code == 200, response.text
    results = client.get(f"/api/v1/analyses/{ident}/results").json()
    assert results[0]["visual_similarity_score"] == 83.5
    assert results[0]["prompt_version"] == "seal-compare-vi-v1"
    assert results[0]["is_uncalibrated"]
    assert results[0]["token_usage"]["total_tokens"] == 32
    assert results[0]["input_metadata"]["query"]["preprocessing"]["parameters"]["gamma"] == 1
    assert client.get(f"/api/v1/analyses/{ident}").json()["consent_provider"] == "openai_vision"
    assert len(calls) == 1
    assert calls[0]["model"] == "gpt-4.1"
    assert calls[0]["store"] is False
    images = [p for p in calls[0]["input"][1]["content"] if p["type"] == "input_image"]
    assert len(images) == 2
    assert all(x["image_url"].startswith("data:image/png;base64,") for x in images)
    annotation = client.post(
        f"/api/v1/analysis-results/{results[0]['id']}/annotations",
        json={
            "label": "uncertain",
            "image_role": "Q",
            "geometry": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2},
            "note": "Vùng DEMO do người dùng vẽ",
        },
    )
    assert annotation.status_code == 201
    assert annotation.json()["source"] == "user"
    assert client.post(f"/api/v1/analyses/{ident}/compare-openai", json={"consent": True}).status_code == 200
    versions = client.get(f"/api/v1/analyses/{ident}/results").json()
    assert len(versions) == 2
    assert versions[1]["id"] == results[0]["id"]
    assert len(versions[1]["annotations"]) == 1
    report = client.get(f"/api/v1/reports/{ident}/export?download=true")
    assert report.status_code == 200
    assert "text/html" in report.headers["content-type"]
    assert "attachment" in report.headers["content-disposition"]
    assert "seal-compare-vi-v1" in report.text
    assert "data:image/png;base64," in report.text


def test_missing_key_and_consent_no_fallback(client, analysis):
    result = client.post(f"/api/v1/analyses/{analysis['id']}/compare-openai", json={"consent": True})
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "openai_not_configured"
    assert client.get(f"/api/v1/analyses/{analysis['id']}/results").json() == []
    assert (
        client.post(f"/api/v1/analyses/{analysis['id']}/compare-openai", json={"consent": False}).status_code
        == 422
    )
    status = client.get("/api/v1/settings/openai/status")
    assert not status.json()["is_configured"]
    assert "api_key" not in status.text
    assert client.post("/api/v1/settings/openai/test", json={}).status_code == 503


@pytest.mark.parametrize(
    "http_status,api_status,code",
    [
        (401, 502, "invalid_api_key"),
        (403, 502, "model_access"),
        (404, 502, "model_access"),
        (429, 429, "provider_rate_limit"),
        (500, 502, "provider_error"),
        (400, 502, "provider_bad_request"),
    ],
)
def test_upstream_errors(client, analysis, comparison_data, monkeypatch, http_status, api_status, code):
    install_mock(monkeypatch, comparison_data, status=http_status)
    response = client.post(f"/api/v1/analyses/{analysis['id']}/compare-openai", json={"consent": True})
    assert response.status_code == api_status, response.text
    assert response.json()["error"]["code"] == code
    results = client.get(f"/api/v1/analyses/{analysis['id']}/results").json()
    assert len(results) == 1
    assert results[0]["result_status"] == "error"
    assert results[0]["visual_similarity_score"] is None
    assert "upstream detail" not in response.text
    assert client.get(f"/api/v1/analyses/{analysis['id']}").json()["status"] == "failed"


@pytest.mark.parametrize(
    "exception,expected", [(httpx.ReadTimeout("DEMO"), 504), (httpx.ConnectError("DEMO"), 502)]
)
def test_network_timeout(client, analysis, comparison_data, monkeypatch, exception, expected):
    install_mock(monkeypatch, comparison_data, error=exception)
    assert (
        client.post(f"/api/v1/analyses/{analysis['id']}/compare-openai", json={"consent": True}).status_code
        == expected
    )


@pytest.mark.parametrize("bad", ["refusal", "score", "extra", "invalid_json"])
def test_refusal_and_invalid_structure(client, analysis, comparison_data, monkeypatch, bad):
    if bad == "score":
        comparison_data["visual_similarity_score"] = 180
    elif bad == "extra":
        comparison_data["fabricated_bbox"] = [1, 2, 3, 4]
    elif bad == "invalid_json":
        comparison_data = {"status": "success"}
    install_mock(monkeypatch, comparison_data, refusal=bad == "refusal")
    response = client.post(f"/api/v1/analyses/{analysis['id']}/compare-openai", json={"consent": True})
    assert response.status_code == 502, response.text
    result = client.get(f"/api/v1/analyses/{analysis['id']}/results").json()[0]
    assert result["visual_similarity_score"] is None
    assert result["result_status"] == "error"


def test_insufficient_normalizes_score(client, analysis, comparison_data, monkeypatch):
    comparison_data["status"] = "insufficient_data"
    comparison_data["verdict"] = "insufficient_evidence"
    install_mock(monkeypatch, comparison_data)
    assert (
        client.post(f"/api/v1/analyses/{analysis['id']}/compare-openai", json={"consent": True}).status_code
        == 200
    )
    result = client.get(f"/api/v1/analyses/{analysis['id']}/results").json()[0]
    assert result["visual_similarity_score"] is None
    assert result["structured_result"]["same_design_plausible"] is None


def test_unprocessed_assets_and_private_sessions(client, viewer, analyst, analysis, image_bytes):
    original = upload_image(client, image_bytes)
    assert (
        client.post(
            "/api/v1/analyses",
            json={
                "title": "bad",
                "query_asset_id": original["id"],
                "candidates": [{"reference_asset_id": original["id"]}],
            },
        ).status_code
        == 422
    )
    assert viewer.get(f"/api/v1/analyses/{analysis['id']}").status_code == 403
    assert analyst.get(f"/api/v1/analyses/{analysis['id']}/results").status_code == 403
    assert viewer.get(f"/api/v1/reports/{analysis['id']}").status_code == 403


def test_report_escapes_model_and_user_text(client, analysis, comparison_data, monkeypatch):
    malicious = '<script>alert("DEMO")</script><img src=x onerror=alert(1)>'
    comparison_data["summary_vi"] = malicious
    comparison_data["matching_features"][0]["description"] = malicious
    install_mock(monkeypatch, comparison_data)
    assert (
        client.post(f"/api/v1/analyses/{analysis['id']}/compare-openai", json={"consent": True}).status_code
        == 200
    )
    report = client.get(f"/api/v1/reports/{analysis['id']}")
    assert "<script>" not in report.text
    assert "&lt;script&gt;" in report.text
    assert "sandbox" in report.headers["content-security-policy"]


def test_running_guard_and_recovery(client, analysis, comparison_data, monkeypatch, db):
    import uuid
    from datetime import timedelta

    from app.db.base import utcnow
    from app.db.models import AnalysisSession

    calls = install_mock(monkeypatch, comparison_data)
    session = db.get(AnalysisSession, uuid.UUID(analysis["id"]))
    session.status = "running"
    session.updated_at = utcnow()
    db.commit()
    assert (
        client.post(f"/api/v1/analyses/{session.id}/compare-openai", json={"consent": True}).status_code
        == 409
    )
    assert calls == []
    session.updated_at = utcnow() - timedelta(hours=1)
    db.commit()
    assert (
        client.post(f"/api/v1/analyses/{session.id}/compare-openai", json={"consent": True}).status_code
        == 200
    )
    assert len(calls) == 1


def test_library_top_n_and_limit(client, processed_pair, comparison_data, monkeypatch):
    q, k = processed_pair
    calls = install_mock(monkeypatch, comparison_data)
    candidates = [{"reference_asset_id": q["id"]}, {"reference_asset_id": k["id"]}]
    session = client.post(
        "/api/v1/analyses",
        json={"title": "Top-N DEMO", "mode": "library", "query_asset_id": q["id"], "candidates": candidates},
    )
    assert session.status_code == 201
    response = client.post(f"/api/v1/analyses/{session.json()['id']}/compare-openai", json={"consent": True})
    assert response.status_code == 200
    assert len(calls) == 2
    assert len(client.get(f"/api/v1/analyses/{session.json()['id']}/results").json()) == 2
    assert (
        client.post(
            "/api/v1/analyses",
            json={
                "title": "Invalid",
                "mode": "library",
                "query_asset_id": q["id"],
                "candidates": candidates * 3,
            },
        ).status_code
        == 422
    )

import httpx
import openai
import pytest

from app.core.config import get_settings


@pytest.mark.parametrize(
    "upstream_status,error_code,message_fragment",
    [
        (200, None, "Key và ID model"),
        (401, "invalid_api_key", "khóa API"),
        (403, "model_access", "quyền truy cập"),
        (404, "model_access", "ID chính xác"),
    ],
)
def test_connection_checks_model_without_generating_content(
    client, monkeypatch, upstream_status, error_code, message_fragment
):
    monkeypatch.setattr(get_settings(), "openai_model", "gpt-6.1-sol")
    calls = []

    def handler(request):
        calls.append((request.method, request.url.path, request.content))
        if upstream_status != 200:
            return httpx.Response(
                upstream_status,
                json={
                    "error": {
                        "message": "upstream secret detail",
                        "type": "api_error",
                        "code": "model_not_found" if upstream_status == 404 else "test",
                    }
                },
            )
        return httpx.Response(
            200,
            json={"id": "gpt-6.1-sol", "object": "model", "created": 0, "owned_by": "openai"},
        )

    def mock_client():
        return openai.AsyncOpenAI(
            api_key="test-key-not-a-real-secret",
            max_retries=0,
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

    monkeypatch.setattr("app.api.v1.system.configured_client", mock_client)
    response = client.post("/api/v1/settings/openai/test", json={})
    assert calls == [("GET", "/v1/models/gpt-6.1-sol", b"")]
    assert "test-key-not-a-real-secret" not in response.text
    assert "upstream secret detail" not in response.text
    if error_code:
        assert response.status_code == 502
        assert response.json()["error"]["code"] == error_code
        assert message_fragment in response.json()["error"]["message"]
    else:
        assert response.status_code == 200
        assert response.json()["model"] == "gpt-6.1-sol"
        assert response.json()["usage"] is None
        assert message_fragment in response.json()["message"]


def test_connection_check_requires_admin(analyst, viewer, monkeypatch):
    def unexpected_client():
        pytest.fail("Non-admin users must not contact OpenAI")

    monkeypatch.setattr("app.api.v1.system.configured_client", unexpected_client)
    for user in (analyst, viewer):
        assert user.post("/api/v1/settings/openai/test", json={}).status_code == 403

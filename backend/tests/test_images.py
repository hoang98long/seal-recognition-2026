import io

import pytest
from conftest import demo_image, upload_image
from PIL import Image

from app.core.config import get_settings


@pytest.mark.parametrize("fmt,mime", [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")])
def test_image_upload_preview(client, fmt, mime):
    stream = io.BytesIO()
    demo_image().save(stream, fmt)
    result = client.post(
        "/api/v1/assets/upload",
        files={"file": ("../demo.exe", stream.getvalue(), "application/octet-stream")},
    )
    assert result.status_code == 201
    asset = result.json()
    assert asset["media_type"] == mime
    assert "/" not in asset["original_filename"]
    assert "relative_storage_path" not in asset
    preview = client.get(f"/api/v1/assets/{asset['id']}/preview")
    assert preview.status_code == 200
    assert preview.headers["X-Image-Width"] == "240"
    assert Image.open(io.BytesIO(preview.content)).size == (240, 200)
    assert client.get(f"/api/v1/assets/{asset['id']}/download").content == stream.getvalue()


def test_pdf_pages_and_document_metadata(client):
    stream = io.BytesIO()
    Image.new("RGB", (80, 100), "red").save(
        stream, "PDF", save_all=True, append_images=[Image.new("RGB", (80, 100), "blue")]
    )
    result = client.post(
        "/api/v1/assets/upload", files={"file": ("demo.pdf", stream.getvalue(), "application/pdf")}
    )
    assert result.status_code == 201, result.text
    asset = result.json()
    assert asset["page_count"] == 2
    doc = client.post("/api/v1/documents", json={"file_asset_id": asset["id"], "display_name": "PDF DEMO"})
    assert doc.status_code == 201
    for page, channel in [(1, 0), (2, 2)]:
        preview = client.get(f"/api/v1/documents/{doc.json()['id']}/pages/{page}/preview")
        assert preview.status_code == 200
        pixel = Image.open(io.BytesIO(preview.content)).getpixel((30, 30))
        assert pixel[channel] > 240
        assert pixel[2 - channel] < 15
    assert client.get(f"/api/v1/assets/{asset['id']}/preview?page=3").status_code == 422


def test_single_page_pdf(client):
    stream = io.BytesIO()
    demo_image().save(stream, "PDF")
    result = client.post(
        "/api/v1/assets/upload", files={"file": ("demo.pdf", stream.getvalue(), "application/pdf")}
    )
    assert result.status_code == 201
    assert result.json()["page_count"] == 1


def test_tiff_frames(client):
    stream = io.BytesIO()
    demo_image().save(stream, "TIFF", save_all=True, append_images=[Image.new("RGB", (70, 90), "blue")])
    result = client.post(
        "/api/v1/assets/upload", files={"file": ("demo.tiff", stream.getvalue(), "image/tiff")}
    )
    assert result.status_code == 201
    assert result.json()["page_count"] == 2
    frame = client.get(f"/api/v1/assets/{result.json()['id']}/preview?page=2")
    assert Image.open(io.BytesIO(frame.content)).size == (70, 90)


def test_reject_bad_and_oversized_files(client, image_bytes, monkeypatch):
    for data in [b"MZexecutable", b"%PDF-broken", b"", b"<script>alert(1)</script>"]:
        assert (
            client.post("/api/v1/assets/upload", files={"file": ("fake.png", data, "image/png")}).status_code
            == 422
        )
    monkeypatch.setattr(get_settings(), "max_image_pixels", 10)
    assert (
        client.post(
            "/api/v1/assets/upload", files={"file": ("large.png", image_bytes, "image/png")}
        ).status_code
        == 422
    )


def test_private_files_and_dedup(analyst, client, viewer, image_bytes):
    first = upload_image(analyst, image_bytes)
    repeat = upload_image(analyst, image_bytes)
    other = upload_image(client, image_bytes)
    assert repeat["id"] == first["id"]
    assert other["id"] != first["id"]
    assert viewer.get(f"/api/v1/assets/{first['id']}/download").status_code == 403
    assert viewer.get(f"/api/v1/assets/{first['id']}/preview").status_code == 403
    assert viewer.get(f"/api/v1/assets/{first['id']}").status_code == 403
    assert client.get(f"/api/v1/assets/{first['id']}/download").status_code == 200

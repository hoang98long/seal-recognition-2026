import hashlib

import cv2
import numpy as np
import pytest
from conftest import demo_image, upload_image
from PIL import Image

from app.schemas.common import ROI, Parameters
from app.services.image_preprocessing_service import process, red_mask


def test_apply_immutable_and_round_trip(client, image_bytes):
    source = upload_image(client, image_bytes)
    parameters = Parameters(
        rotation=90, brightness=10, contrast=1.2, gamma=1.1, red_mask=True, morphology="close"
    )
    profile = client.post(
        "/api/v1/preprocessing/profiles", json={"name": "DEMO mực đỏ", "parameters": parameters.model_dump()}
    )
    assert profile.status_code == 201
    body = {
        "source_asset_id": source["id"],
        "roi": {"x": 20, "y": 10, "width": 200, "height": 185},
        "parameters": parameters.model_dump(),
        "profile_id": profile.json()["id"],
        "roi_confirmed": True,
    }
    preview = client.post("/api/v1/preprocessing/preview", json=body)
    assert preview.status_code == 200
    response = client.post("/api/v1/preprocessing/apply", json=body)
    assert response.status_code == 201
    output = response.json()
    assert output["asset"]["width"] == 185
    assert output["asset"]["height"] == 200
    assert (
        output["run"]["parameters"]
        == Parameters.model_validate_json(parameters.model_dump_json()).model_dump()
    )
    again = client.post("/api/v1/preprocessing/apply", json=body).json()
    assert again["asset"]["sha256"] == output["asset"]["sha256"]
    assert again["asset"]["id"] != output["asset"]["id"]
    assert client.get(f"/api/v1/assets/{source['id']}/download").content == image_bytes
    data = client.get(f"/api/v1/assets/{output['asset']['id']}/download").content
    assert hashlib.sha256(data).hexdigest() == output["asset"]["sha256"]
    assert data == preview.content
    assert (
        client.get(f"/api/v1/preprocessing/runs/{output['run']['id']}").json()["roi_geometry"] == body["roi"]
    )


@pytest.mark.parametrize("mode", ["manual", "otsu", "adaptive"])
def test_thresholds_and_saturation(mode):
    image = demo_image()
    p = Parameters(grayscale=True, threshold_mode=mode, denoise=1, sharpen=0.2, saturation=0.8, invert=True)
    result = process(image, ROI(x=0, y=0, width=240, height=200), p)
    assert set(np.unique(np.asarray(result))).issubset({0, 255})


def test_hsv_wrap_and_preserving_ink():
    hsv = np.array([[[0, 200, 180], [179, 200, 180], [90, 200, 180]]], dtype=np.uint8)
    rgb = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    assert red_mask(rgb, Parameters(red_mask=True)).tolist() == [[255, 255, 0]]
    image = Image.new("RGB", (12, 12), "white")
    image.putpixel((5, 5), (180, 25, 40))
    result = process(
        image, ROI(x=0, y=0, width=12, height=12), Parameters(red_mask=True, background="transparent")
    )
    assert result.getpixel((0, 0))[3] == 0
    assert result.getpixel((5, 5))[3] == 255
    assert max(abs(a - b) for a, b in zip(result.getpixel((5, 5))[:3], (180, 25, 40))) <= 2


def test_roi_bounds_and_confirmation(client, image_bytes):
    source = upload_image(client, image_bytes)
    body = {
        "source_asset_id": source["id"],
        "roi": {"x": 230, "y": 0, "width": 30, "height": 30},
        "roi_confirmed": True,
    }
    assert client.post("/api/v1/preprocessing/apply", json=body).status_code == 422
    body["roi"] = {"x": 0, "y": 0, "width": 30, "height": 30}
    body["roi_confirmed"] = False
    assert client.post("/api/v1/preprocessing/apply", json=body).status_code == 422
    suggest = client.get(f"/api/v1/preprocessing/suggest-roi/{source['id']}").json()
    assert suggest["roi"]["width"] > 100


def test_full_page_requires_separate_acknowledgement(client, image_bytes):
    source = upload_image(client, image_bytes)
    body = {
        "source_asset_id": source["id"],
        "roi": {"x": 0, "y": 0, "width": 240, "height": 200},
        "roi_confirmed": True,
    }
    assert client.post("/api/v1/preprocessing/apply", json=body).status_code == 422
    body["allow_full_page"] = True
    result = client.post("/api/v1/preprocessing/apply", json=body)
    assert result.status_code == 201
    assert result.json()["asset"]["source_metadata"]["whole_source_confirmed"] is True

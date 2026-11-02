import cv2
import numpy as np
from PIL import Image

from app.core.exceptions import AppError
from app.schemas.common import ROI, Parameters

PIPELINE_VERSION = "roi-color-mask-v1"


def red_mask(rgb, p: Parameters):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    low = cv2.inRange(hsv, np.array([0, p.saturation_min, p.value_min]), np.array([p.hue_width, 255, 255]))
    high = cv2.inRange(
        hsv, np.array([179 - p.hue_width, p.saturation_min, p.value_min]), np.array([179, 255, 255])
    )
    return cv2.bitwise_or(low, high)


def process(image: Image.Image, roi: ROI, p: Parameters, preview=False):
    if roi.x + roi.width > image.width or roi.y + roi.height > image.height:
        raise AppError(422, "roi_bounds", "Vùng chọn vượt kích thước ảnh nguồn.")
    image = image.crop((roi.x, roi.y, roi.x + roi.width, roi.y + roi.height))
    image = image.rotate(-p.rotation, resample=Image.Resampling.BICUBIC, expand=True, fillcolor="white")
    rgb = np.asarray(image.convert("RGB"))
    rgb = np.clip((rgb.astype(np.float32) - 127.5) * p.contrast + 127.5 + p.brightness, 0, 255).astype(
        np.uint8
    )
    table = (np.power(np.arange(256) / 255.0, 1 / p.gamma) * 255).astype(np.uint8)
    rgb = cv2.LUT(rgb, table)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1].astype(float) * p.saturation, 0, 255).astype(np.uint8)
    rgb = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    if p.denoise:
        rgb = cv2.GaussianBlur(rgb, (p.denoise * 2 + 1, p.denoise * 2 + 1), 0)
    if p.sharpen:
        blurred = cv2.GaussianBlur(rgb, (0, 0), 1)
        rgb = cv2.addWeighted(rgb, 1 + p.sharpen, blurred, -p.sharpen, 0)
    mask = red_mask(rgb, p) if p.red_mask else None
    output = rgb.copy()
    if not p.red_mask and (p.grayscale or p.threshold_mode != "off"):
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        if p.threshold_mode == "manual":
            gray = cv2.threshold(gray, p.threshold_value, 255, cv2.THRESH_BINARY)[1]
        elif p.threshold_mode == "otsu":
            gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        elif p.threshold_mode == "adaptive":
            gray = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
        output = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
        if p.threshold_mode != "off":
            mask = cv2.bitwise_not(gray)  # dark pixels are foreground
    if p.morphology != "none":
        kernel = np.ones((p.kernel_size, p.kernel_size), np.uint8)
        op = cv2.MORPH_OPEN if p.morphology == "open" else cv2.MORPH_CLOSE
        if mask is not None:
            mask = cv2.morphologyEx(mask, op, kernel)
            if not p.red_mask:
                output = cv2.cvtColor(cv2.bitwise_not(mask), cv2.COLOR_GRAY2RGB)
        else:
            output = cv2.morphologyEx(output, op, kernel)
    if mask is not None and p.red_mask:
        if p.background == "overlay" and preview:
            tint = rgb.copy()
            tint[mask > 0] = [0, 200, 140]
            output = cv2.addWeighted(rgb, 0.6, tint, 0.4, 0)
        elif p.apply_mask:
            output[mask == 0] = 255  # original ink colors inside the mask are preserved
    if p.invert:
        output = cv2.bitwise_not(output)
    if mask is not None and p.background in {"white", "transparent"} and p.apply_mask:
        if p.background == "transparent":
            return Image.fromarray(np.dstack((output, mask)), "RGBA")
        output[mask == 0] = 255
    return Image.fromarray(output)


def suggest_roi(image):
    mask = red_mask(np.asarray(image.convert("RGB")), Parameters(red_mask=True))
    points = cv2.findNonZero(mask)
    if points is None:
        return None
    x, y, w, h = cv2.boundingRect(points)
    pad = 10
    x1, y1 = max(0, x - pad), max(0, y - pad)
    return {
        "x": x1,
        "y": y1,
        "width": min(image.width, x + w + pad) - x1,
        "height": min(image.height, y + h + pad) - y1,
    }

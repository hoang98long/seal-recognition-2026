import io

import numpy as np
from PIL import Image


def appearance_pdf():
    appearance = b"0.8 0.05 0.1 RG 5 w 10 10 100 100 re S"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R /AcroForm 7 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Contents 4 0 R /Annots [5 0 R 6 0 R] >>",
        b"<< /Length 0 >>\nstream\n\nendstream",
        b"<< /Type /Annot /Subtype /Stamp /Rect [30 40 150 160] /F 4 /AP << /N 8 0 R >> >>",
        b"<< /Type /Annot /Subtype /Widget /FT /Sig /T (TestSignature) /Rect [220 40 340 160] /F 4 /AP << /N 8 0 R >> >>",
        b"<< /Fields [6 0 R] /SigFlags 3 /NeedAppearances false >>",
        b"<< /Type /XObject /Subtype /Form /BBox [0 0 120 120] /Resources << >> /Length "
        + str(len(appearance)).encode()
        + b" >>\nstream\n"
        + appearance
        + b"\nendstream",
    ]
    data = b"%PDF-1.7\n"
    offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    start = len(data)
    data += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    data += b"".join(f"{offset:010} 00000 n \n".encode() for offset in offsets)
    return data + f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode()


def red_count(image):
    rgb = np.asarray(image.convert("RGB"))
    return int(((rgb[:, :, 0] > 130) & (rgb[:, :, 0] > rgb[:, :, 1] * 1.5) & (rgb[:, :, 1] < 100)).sum())


def test_pdf_stamp_annotations_and_signature_widgets_in_preview_and_crop(client):
    response = client.post(
        "/api/v1/assets/upload", files={"file": ("appearance-test.pdf", appearance_pdf(), "application/pdf")}
    )
    assert response.status_code == 201, response.text
    ident = response.json()["id"]
    preview = client.get(f"/api/v1/assets/{ident}/preview?full=true")
    assert preview.status_code == 200
    image = Image.open(io.BytesIO(preview.content))
    w, h = image.size
    assert red_count(image.crop((0, 0, w // 2, h))) > 100  # Stamp annotation.
    assert red_count(image.crop((w // 2, 0, w, h))) > 100  # AcroForm signature appearance.
    suggested = client.get(f"/api/v1/preprocessing/suggest-roi/{ident}").json()
    assert suggested["roi"] is not None
    output = client.post(
        "/api/v1/preprocessing/apply",
        json={"source_asset_id": ident, "roi": suggested["roi"], "roi_confirmed": True},
    )
    assert output.status_code == 201, output.text
    crop = client.get(f"/api/v1/assets/{output.json()['asset']['id']}/preview")
    assert red_count(Image.open(io.BytesIO(crop.content))) > 200
    thumb = client.get(f"/api/v1/assets/{ident}/preview?thumb=true")
    assert max(Image.open(io.BytesIO(thumb.content)).size) <= 280

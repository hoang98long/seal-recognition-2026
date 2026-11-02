import base64
import html
import json

from app.db.models import AnnotationRegion
from app.services.storage_service import authorized_asset

DISCLAIMER = "Không phải kết luận giám định pháp y. Điểm tương đồng do AI ước lượng chưa được hiệu chuẩn; không phải xác suất cùng dụng cụ và không xác thực tài liệu thật/giả."
VERDICTS = {
    "visually_similar": "Tương đồng biểu kiến",
    "partially_similar": "Tương đồng một phần",
    "visually_different": "Khác biệt biểu kiến",
    "insufficient_evidence": "KHÔNG ĐỦ CƠ SỞ KẾT LUẬN",
}


def esc(value):
    return html.escape(str(value)[:30000], quote=True)


def embedded_image(db, ident, user):
    asset = authorized_asset(db, ident, user)
    from app.services.pdf_render_service import load_page, png_bytes

    image = load_page(asset)
    image.thumbnail((1400, 1400))
    return "data:image/png;base64," + base64.b64encode(png_bytes(image)).decode("ascii")


def make_report(db, session, results, user):
    from sqlalchemy import select

    sections = []
    for index, result in enumerate(results, 1):
        data = result.structured_result
        snapshot = result.input_metadata
        q = snapshot.get("query", {}).get("asset_id")
        k = snapshot.get("reference", {}).get("asset_id")
        import uuid

        images = ""
        if q and k:
            images = (
                "<div class='images'>"
                + "".join(
                    f"<figure><img src='{embedded_image(db, uuid.UUID(ident), user)}'><figcaption>{label}</figcaption></figure>"
                    for ident, label in [(q, "Dấu cần kiểm tra (Q)"), (k, "Dấu đối chiếu (K)")]
                )
                + "</div>"
            )
        evidence = ""
        for field, label in [
            ("matching_features", "Điểm tương đồng"),
            ("differing_features", "Điểm khác biệt"),
            ("uncertain_features", "Vùng chưa rõ"),
        ]:
            evidence += (
                f"<h3>{label}</h3><ul>"
                + "".join(
                    f"<li>{esc(x['description'])} — {esc(x['region_description'])}</li>"
                    for x in data.get(field, [])
                )
                + "</ul>"
            )
        observations = "".join(
            f"<h3>{label}</h3><ul>" + "".join(f"<li>{esc(x)}</li>" for x in data.get(field, [])) + "</ul>"
            for field, label in [
                ("observations_q", "Quan sát Q"),
                ("observations_k", "Quan sát K"),
                ("text_recognition_q", "Chữ đọc được Q"),
                ("text_recognition_k", "Chữ đọc được K"),
                ("limitations", "Hạn chế"),
            ]
        )
        annotations = db.scalars(
            select(AnnotationRegion).where(AnnotationRegion.analysis_result_id == result.id)
        ).all()
        manual = (
            "<h3>Ghi chú thủ công (không phải kết luận AI)</h3><ul>"
            + "".join(
                f"<li>Ảnh {esc(a.image_role)} · {esc(a.label)} · {esc(a.note)} · Vùng chuẩn hóa {esc(json.dumps(a.geometry))}</li>"
                for a in annotations
            )
            + "</ul>"
        )
        sections.append(f"""<section><h2>Kết quả {index}: {esc(VERDICTS.get(result.verdict, result.verdict))}</h2>
        <p>Thời gian UTC: {esc(result.created_at)} · Mã kết quả: {esc(result.id)}</p>
        {images}<p>Điểm tương đồng do AI ước lượng: <strong>{esc(result.visual_similarity_score if result.visual_similarity_score is not None else "Không chấm điểm")}</strong></p>
        <p>{esc(data.get("summary_vi") or result.error_summary or "")}</p>{evidence}{observations}
        <p>Khuyến nghị: {esc(data.get("recommendation_vi", ""))}</p>{manual}
        <h3>Thông tin kỹ thuật và tiền xử lý</h3><p>Model: {esc(result.model_name)} · SDK: {esc(result.provider_version)} · Prompt: {esc(result.prompt_version)}</p>
        <p>Request ID: {esc(result.request_id_provider)} · Thời gian: {result.duration_ms} ms · Chi phí chưa xác định</p>
        <pre>{esc(json.dumps({"input": snapshot, "usage": result.token_usage}, ensure_ascii=False, indent=2))}</pre></section>""")
    return f"""<!doctype html><html lang='vi'><head><meta charset='UTF-8'><title>Báo cáo phân tích con dấu</title>
    <style>body{{font:15px/1.6 'Segoe UI',sans-serif;color:#172b4d;max-width:1000px;margin:40px auto;padding:0 24px}}
    h1{{font-size:26px}}h2{{font-size:21px}}.notice{{background:#fff5d6;padding:16px;border:1px solid #dcc37d}}
    .images{{display:flex;gap:24px}}figure{{width:48%;margin:0;text-align:center}}img{{max-width:100%;max-height:350px;object-fit:contain}}
    pre{{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f5f8;padding:12px;font-size:11px}}section{{border-top:1px solid #ddd;margin-top:32px;padding-top:16px}}
    @media print{{body{{margin:0;max-width:none}}.images,li{{break-inside:avoid}}@page{{size:A4;margin:16mm}}}}</style></head><body>
    <h1>HỆ THỐNG GIÁM ĐỊNH CON DẤU</h1><p>PHIẾU PHÂN TÍCH TƯƠNG ĐỒNG HÌNH ẢNH</p><h2>{esc(session.title)}</h2>
    <p>Mã phiên: {esc(session.id)} · Tạo lúc UTC: {esc(session.created_at)}</p><p class='notice'>{esc(DISCLAIMER)}</p>
    {"".join(sections) or "<p>Phiên chưa có kết quả phân tích.</p>"}</body></html>"""

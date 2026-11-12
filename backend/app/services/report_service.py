import base64
import html
import json

from app.db.models import AnnotationRegion
from app.services.comparison_explanation import compact_explanation
from app.services.storage_service import authorized_asset

DISCLAIMER = "Điểm tương đồng dùng để tham khảo, không phải kết luận giám định hoặc xác thực tài liệu."


def score_label(score):
    return (
        "Chưa đủ dữ liệu"
        if score is None
        else "Tương đồng cao"
        if score > 90
        else "Cần xem xét"
        if score >= 70
        else "Ít tương đồng"
    )


def report_error(code):
    return {
        "provider_timeout": "So khớp vượt quá thời gian chờ. Vui lòng thử lại.",
        "provider_rate_limit": "Dịch vụ so khớp đang giới hạn lượt xử lý hoặc hết hạn mức. Vui lòng kiểm tra kết nối hoặc thử lại sau.",
        "invalid_api_key": "Thông tin kết nối dịch vụ so khớp không hợp lệ.",
        "model_access": "Cấu hình dịch vụ so khớp chưa khả dụng hoặc thiếu quyền truy cập.",
        "openai_not_configured": "Dịch vụ so khớp chưa được cấu hình.",
        "provider_network": "Không kết nối được dịch vụ so khớp.",
    }.get(code, "Không thể hoàn tất so khớp. Vui lòng kiểm tra ảnh và thử lại.")


def esc(value):
    return html.escape(str(value)[:30000], quote=True)


def score_band(score):
    return "gray" if score is None else "green" if score > 90 else "yellow" if score >= 70 else "red"


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
        annotations = db.scalars(
            select(AnnotationRegion).where(AnnotationRegion.analysis_result_id == result.id)
        ).all()
        manual = (
            "<h3>Ghi chú thủ công của chuyên viên</h3><ul>"
            + "".join(
                f"<li>Ảnh {esc(a.image_role)} · {esc(a.label)} · {esc(a.note)} · Vùng chuẩn hóa {esc(json.dumps(a.geometry))}</li>"
                for a in annotations
            )
            + "</ul>"
        )
        score = result.visual_similarity_score if result.result_status == "success" else None
        label = "Không hoàn tất so khớp" if result.result_status == "error" else score_label(score)
        note = (
            report_error(result.error_code)
            if result.result_status == "error"
            else "Chưa đủ dữ liệu để chấm điểm. Hãy kiểm tra vùng dấu và chất lượng ảnh."
            if score is None
            else "Mức tương đồng giữa dấu cần kiểm tra và dấu đối chiếu."
        )
        explanation = compact_explanation(result)
        if explanation:
            note = explanation["conclusion"]
        reasons = ""
        if explanation and explanation["reasons"]:
            reasons = (
                "<h3>Căn cứ đối chiếu</h3><ul>"
                + "".join(
                    f"<li><strong>{'Tương đồng' if reason['kind'] == 'matching' else 'Khác biệt'}:</strong> {esc(reason['text'])}</li>"
                    for reason in explanation["reasons"]
                )
                + "</ul>"
            )
        limitation = (
            f"<p><strong>Lưu ý:</strong> {esc(explanation['limitation'])}</p>"
            if explanation and explanation["limitation"]
            else ""
        )
        sections.append(f"""<section><h2>Kết quả {index}: {esc(label)}</h2>
        <p>Thời gian UTC: {esc(result.created_at)} · Mã kết quả: {esc(result.id)}</p>
        {images}<p>Điểm tương đồng: <strong class='score {score_band(score)}'>{esc(str(score) + "%" if score is not None else "Không chấm điểm")}</strong></p>
        <p><strong>Kết luận:</strong> {esc(note)}</p>{reasons}{limitation}<p>Thời gian xử lý: {esc(result.duration_ms)} ms</p>{manual}</section>""")
    ranking = ""
    if session.mode == "organization_search":
        from app.services.library_search_service import search_state

        state = search_state(db, session)
        label = (
            "Top tổ chức tương đồng"
            if state["complete_scan"]
            else "Xếp hạng tạm thời — chưa quét đủ thư viện"
        )
        ranking = (
            f"<h2>{label}</h2><p>Đã xử lý {state['processed']}/{state['total']} cặp ảnh. {esc(state['aggregation'])}</p><ol>"
            + "".join(
                f"<li>{esc(row['name'])}: <strong class='score {score_band(row['score'])}'>{esc(row['score'])}%</strong></li>"
                for row in state["rankings"]
            )
            + "</ol>"
        )
    return f"""<!doctype html><html lang='vi'><head><meta charset='UTF-8'><title>Báo cáo phân tích con dấu</title>
    <style>body{{font:15px/1.6 'Segoe UI',sans-serif;color:#172b4d;max-width:1000px;margin:40px auto;padding:0 24px}}
    h1{{font-size:26px}}h2{{font-size:21px}}.notice{{background:#fff5d6;padding:16px;border:1px solid #dcc37d}}
    .score{{padding:4px 8px;border-radius:4px}}.green{{background:#e5f6eb;color:#15713c}}.yellow{{background:#fff3cf;color:#876015}}.red{{background:#fde9eb;color:#b03849}}.gray{{background:#edf1f5;color:#62778d}}
    .images{{display:flex;gap:24px}}figure{{width:48%;margin:0;text-align:center}}img{{max-width:100%;max-height:350px;object-fit:contain}}
    pre{{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f5f8;padding:12px;font-size:11px}}section{{border-top:1px solid #ddd;margin-top:32px;padding-top:16px}}
    @media print{{body{{margin:0;max-width:none}}.images,li{{break-inside:avoid}}@page{{size:A4;margin:16mm}}}}</style></head><body>
    <h1>HỆ THỐNG GIÁM ĐỊNH CON DẤU</h1><p>PHIẾU PHÂN TÍCH TƯƠNG ĐỒNG HÌNH ẢNH</p><h2>{esc(session.title)}</h2>
    <p>Mã phiên: {esc(session.id)} · Tạo lúc UTC: {esc(session.created_at)}</p><p class='notice'>{esc(DISCLAIMER)}</p>
    <p>Màu hiển thị: trên 90% xanh; 70–90% vàng; dưới 70% đỏ; không đủ dữ liệu màu xám.</p>{ranking}
    {"".join(sections) or "<p>Phiên chưa có kết quả phân tích.</p>"}</body></html>"""

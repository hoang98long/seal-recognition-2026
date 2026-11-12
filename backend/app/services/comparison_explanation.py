"""A bounded, provider-independent explanation from the saved comparison evidence."""

import re

TECHNICAL = re.compile(
    r"openai|\bgpt[-\s]?\d|\b(?:model|prompt|tokens?|sdk|api|http|mock)\b|AI thật|bên ngoài|gửi tới|chia sẻ",
    re.IGNORECASE,
)
NON_STAMP = re.compile(r"chữ ký|chức danh|chữ viết tay|tên người ký", re.IGNORECASE)
BOILERPLATE = re.compile(r"cùng dụng cụ|thật[/ ]giả|giám định|nguồn vật lý|hiệu chuẩn", re.IGNORECASE)
UNSUPPORTED_CLAIM = re.compile(
    r"cùng dụng cụ|tài liệu (?:thật|giả)|dấu (?:thật|giả)|\d+\s*[%％]|\d+\s*(?:đặc trưng|keypoints?)",
    re.IGNORECASE,
)
CATEGORIES = {
    "outer_ring": "vòng viền ngoài",
    "inner_ring": "vòng viền trong",
    "text": "chữ trên dấu",
    "symbol": "biểu tượng",
    "layout": "bố cục",
    "local_detail": "chi tiết dấu",
    "other": "đặc điểm của dấu",
}


def clean_text(value):
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())
    if not text or TECHNICAL.search(text) or "<" in text or ">" in text:
        return None
    return text


def evidence_points(data, field, kind):
    items = data.get(field)
    if not isinstance(items, list):
        return []
    points = []
    seen = set()
    # Inspect at most 20 stored observations; the prompt requests only two.
    for item in items[:20]:
        if not isinstance(item, dict) or item.get("strength") == "uncertain":
            continue
        category = item.get("category")
        text = clean_text(item.get("description"))
        if (
            category not in CATEGORIES
            or category in seen
            or not text
            or NON_STAMP.search(text)
            or UNSUPPORTED_CLAIM.search(text)
        ):
            continue
        # Do not cut a sentence and lose a qualification or negation.
        if len(text) > 140:
            continue
        seen.add(category)
        points.append({"kind": kind, "text": text})
    return points


def compact_explanation(result):
    """Never infer measured sub-scores, hidden details, or physical authenticity."""
    if result.result_status == "error":
        return None
    data = result.structured_result or {}
    if not isinstance(data, dict):
        data = {}
    score = result.visual_similarity_score if result.result_status == "success" else None
    if score is None:
        conclusion = "Chưa đủ căn cứ để đánh giá mức tương đồng của hai ảnh con dấu."
    elif score > 90:
        conclusion = "Hai ảnh có mức tương đồng cao về các đặc điểm con dấu quan sát được."
    elif score >= 70:
        conclusion = (
            "Hai ảnh có một số đặc điểm tương đồng; cần xem xét các điểm khác biệt và chất lượng ảnh."
        )
    else:
        conclusion = "Các đặc điểm con dấu quan sát được cho thấy mức tương đồng thấp."

    reasons = []
    if score is not None:
        matches = evidence_points(data, "matching_features", "matching")
        differences = evidence_points(data, "differing_features", "differing")
        # Keep at least one counterexample when both types were observed.
        if score < 70:
            reasons = (differences[:2] + matches[:1] + differences[2:] + matches[1:])[:3]
        else:
            reasons = (matches[:2] + differences[:1] + matches[2:] + differences[1:])[:3]

    limitations = data.get("limitations")
    candidates = list(limitations[:10]) if isinstance(limitations, list) else []
    uncertain = data.get("uncertain_features")
    if isinstance(uncertain, list):
        candidates.extend(x.get("description") for x in uncertain[:10] if isinstance(x, dict))
    limitation = None
    for candidate in candidates:
        text = clean_text(candidate)
        if text and not BOILERPLATE.search(text):
            limitation = text if len(text) <= 160 else "Có hạn chế quan sát; cần kiểm tra lại ảnh nguồn."
            break
    if score is None and limitation is None:
        limitation = "Cần kiểm tra lại vùng dấu và chất lượng ảnh trước khi so khớp lại."
    return {"conclusion": conclusion, "reasons": reasons, "limitation": limitation}

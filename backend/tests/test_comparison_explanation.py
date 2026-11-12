from types import SimpleNamespace

import pytest

from app.services.comparison_explanation import compact_explanation


def feature(category, text, strength="moderate"):
    return {"category": category, "description": text, "strength": strength, "region_description": ""}


def result(score=94, status="success", **data):
    return SimpleNamespace(result_status=status, visual_similarity_score=score, structured_result=data)


def test_explanation_is_short_balanced_and_does_not_change_score():
    stored = result(
        matching_features=[
            feature("outer_ring", "Vòng viền có cấu trúc tương tự."),
            feature("layout", "Bố cục chữ và biểu tượng tương đồng."),
            feature("symbol", "Biểu tượng ở giữa có nét tương tự."),
        ],
        differing_features=[feature("text", "Khoảng cách một số ký tự có khác biệt.")],
        limitations=["Một phần chữ trên vành dấu bị che khuất."],
    )
    explanation = compact_explanation(stored)
    assert len(explanation["conclusion"]) <= 240
    assert len(explanation["reasons"]) == 3
    assert [p["kind"] for p in explanation["reasons"]] == ["matching", "matching", "differing"]
    assert all(len(p["text"]) <= 140 for p in explanation["reasons"])
    assert explanation["limitation"] == "Một phần chữ trên vành dấu bị che khuất."
    assert stored.visual_similarity_score == 94


def test_low_similarity_prioritizes_actual_differences():
    explanation = compact_explanation(
        result(
            score=35,
            matching_features=[feature("outer_ring", "Cùng có vòng ngoài tròn.")],
            differing_features=[
                feature("text", "Nội dung chữ trên vành khác nhau."),
                feature("symbol", "Biểu tượng giữa dấu khác nhau."),
            ],
        )
    )
    assert "tương đồng thấp" in explanation["conclusion"]
    assert [p["kind"] for p in explanation["reasons"]] == ["differing", "differing", "matching"]


def test_no_signature_technical_or_unmeasured_metric_as_evidence():
    explanation = compact_explanation(
        result(
            matching_features=[
                feature("text", "Chữ ký của hai người khác nhau."),
                feature("layout", "OpenAI nhận định bố cục tương đồng."),
                feature("local_detail", "Có 123 đặc trưng và đạt 99% ở đường viền."),
                feature("symbol", "Chứng minh cùng dụng cụ đóng dấu."),
                feature("inner_ring", "Vòng trong chưa rõ.", "uncertain"),
                feature("outer_ring", "<script>fake()</script>"),
            ],
            limitations=["SDK và model còn hạn chế.", "Không thể kết luận cùng dụng cụ."],
        )
    )
    assert explanation["reasons"] == []
    assert explanation["limitation"] is None


def test_legacy_long_evidence_is_not_cut_before_its_qualification():
    text = "Một mô tả chi tiết rất dài. " * 15 + "Không đủ rõ để khẳng định tương đồng."
    explanation = compact_explanation(
        result(
            matching_features=[feature("outer_ring", text), feature("layout", "Bố cục vòng chữ tương tự.")],
            limitations=["Chi tiết bị che khuất. " * 20],
        )
    )
    assert explanation["reasons"] == [{"kind": "matching", "text": "Bố cục vòng chữ tương tự."}]
    assert len(explanation["limitation"]) <= 160


def test_insufficient_data_does_not_present_observations_as_a_match():
    explanation = compact_explanation(
        result(
            score=95,
            status="insufficient_data",
            matching_features=[feature("outer_ring", "Vòng viền tương tự.")],
            limitations=["Không quan sát đủ phần chữ và vòng viền."],
        )
    )
    assert "Chưa đủ căn cứ" in explanation["conclusion"]
    assert explanation["reasons"] == []
    assert explanation["limitation"] == "Không quan sát đủ phần chữ và vòng viền."
    assert compact_explanation(result(score=None))["reasons"] == []
    assert compact_explanation(result(status="error")) is None


@pytest.mark.parametrize(
    "data",
    [
        {},
        {"matching_features": None, "limitations": None},
        {"uncertain_features": [{"description": "Chữ bị che nên chưa đối chiếu đủ."}]},
    ],
)
def test_legacy_sparse_results_still_have_a_safe_explanation(data):
    explanation = compact_explanation(result(**data))
    assert explanation["conclusion"]
    assert len(explanation["reasons"]) <= 3

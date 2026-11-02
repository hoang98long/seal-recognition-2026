from sqlalchemy import select

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.db.models import AnalysisCandidate, SealImpression
from app.db.repositories import record
from app.services.storage_service import authorized_asset


def normalized_asset(db, ident, user):
    asset = authorized_asset(db, ident, user)
    if asset.kind != "processed_stamp" or not asset.source_metadata.get("roi_confirmed"):
        raise AppError(
            422,
            "processed_roi_required",
            "Q và K phải là ảnh đã cắt, tiền xử lý và xác nhận ROI trong Xưởng xử lý ảnh.",
        )
    return asset


def add_candidates(db, session, candidates, user):
    if len(candidates) > get_settings().openai_max_compare_candidates:
        raise AppError(422, "candidate_limit", "Vượt số ảnh tham chiếu tối đa được cấu hình.")
    if len({x.reference_asset_id for x in candidates}) != len(candidates):
        raise AppError(422, "duplicate_candidates", "Không chọn trùng ảnh tham chiếu.")
    for order, candidate in enumerate(candidates):
        normalized_asset(db, candidate.reference_asset_id, user)
        if candidate.reference_impression_id:
            impression = record(db, SealImpression, candidate.reference_impression_id)
            if not impression.is_reference or impression.image_asset_id != candidate.reference_asset_id:
                raise AppError(422, "candidate_reference", "Ảnh không khớp mẫu tham chiếu trong thư viện.")
        db.add(
            AnalysisCandidate(
                analysis_session_id=session.id,
                **candidate.model_dump(),
                display_order=order,
                selection_method="library_search" if candidate.reference_impression_id else "manual",
            )
        )
    db.flush()


def active_candidates(db, session):
    return db.scalars(
        select(AnalysisCandidate)
        .where(AnalysisCandidate.analysis_session_id == session.id, AnalysisCandidate.is_selected.is_(True))
        .order_by(AnalysisCandidate.display_order)
    ).all()

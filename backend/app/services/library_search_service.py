"""Exhaustive API comparisons, then group scores by organization. No image matching algorithm."""

from datetime import timedelta

from sqlalchemy import exists, select

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.db.base import utcnow
from app.db.models import (
    AnalysisCandidate,
    AnalysisResult,
    AnalysisSession,
    FileAsset,
    Organization,
    PreprocessingRun,
    SealDesign,
    SealImpression,
    User,
)
from app.db.repositories import audit, public
from app.db.session import SessionLocal
from app.schemas.common import CompareIn
from app.services.analysis_orchestrator import compare
from app.services.candidate_selection_service import normalized_asset
from app.services.comparison_explanation import compact_explanation


def corpus_query():
    return (
        select(SealImpression)
        .join(Organization)
        .join(SealDesign, SealDesign.id == SealImpression.seal_design_id)
        .join(FileAsset, FileAsset.id == SealImpression.image_asset_id)
        .where(
            SealImpression.status == "active",
            SealImpression.is_reference.is_(True),
            Organization.status == "active",
            SealDesign.status == "active",
            FileAsset.kind == "processed_stamp",
            FileAsset.source_metadata["roi_confirmed"].as_boolean().is_(True),
            exists().where(PreprocessingRun.output_asset_id == FileAsset.id),
        )
        .order_by(SealImpression.organization_id, SealImpression.id)
    )


def inventory(db):
    items = db.scalars(corpus_query()).all()
    active = db.scalars(
        select(SealImpression.id).where(
            SealImpression.status == "active", SealImpression.is_reference.is_(True)
        )
    ).all()
    return {
        "reference_count": len(items),
        "organization_count": len({x.organization_id for x in items}),
        "excluded_count": len(active) - len(items),
    }


def mark_interrupted(db, session):
    if session.status in {"running", "queued"} and session.updated_at < utcnow() - timedelta(
        seconds=get_settings().openai_request_timeout_seconds + 120
    ):
        session.status = "interrupted"
        return True
    return False


def start_search(db, body, user):
    if not body.consent:
        raise AppError(422, "consent_required", "Cần xác nhận gửi Q và các mẫu thư viện tới OpenAI.")
    if not get_settings().openai_api_key.get_secret_value():
        raise AppError(
            503, "openai_not_configured", "Chưa cấu hình OPENAI_API_KEY. Bạn vẫn có thể chuẩn bị ảnh."
        )
    normalized_asset(db, body.query_asset_id, user)
    # Serialize starts for the same user to avoid double-click or multi-tab duplicate jobs.
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    running = db.scalars(
        select(AnalysisSession).where(
            AnalysisSession.created_by == user.id,
            AnalysisSession.mode == "organization_search",
            AnalysisSession.status.in_(["queued", "running"]),
        )
    ).all()
    for old in running:
        mark_interrupted(db, old)
        if old.status in {"queued", "running"}:
            raise AppError(
                409, "search_running", "Bạn đang có một phiên tra cứu. Mở lại phiên đó trong Lịch sử."
            )
    references = db.scalars(corpus_query()).all()
    if not references:
        raise AppError(422, "empty_library", "Thư viện chưa có dấu đã xử lý thuộc tổ chức đang hoạt động.")
    if len(references) != body.expected_reference_count:
        raise AppError(
            409, "library_changed", "Số mẫu thư viện vừa thay đổi. Hãy đọc lại số lượt API và xác nhận lại."
        )
    session = AnalysisSession(
        title=body.title,
        mode="organization_search",
        query_asset_id=body.query_asset_id,
        created_by=user.id,
        status="queued",
        consent_at=utcnow(),
        consent_provider="openai_vision",
        processing_notes="Tra cứu toàn bộ ảnh tham chiếu hợp lệ tại thời điểm bắt đầu; điểm tổ chức là điểm cao nhất trong các mẫu đã so.",
    )
    db.add(session)
    db.flush()
    for index, item in enumerate(references):
        db.add(
            AnalysisCandidate(
                analysis_session_id=session.id,
                reference_asset_id=item.image_asset_id,
                reference_impression_id=item.id,
                selection_method="library_scan",
                display_order=index,
            )
        )
    audit(
        db,
        user,
        "library_search_consent",
        "analysis",
        session.id,
        {"calls": len(references), "organizations": len({x.organization_id for x in references})},
    )
    db.commit()
    return session


def search_state(db, session):
    if mark_interrupted(db, session):
        db.commit()
    candidates = db.scalars(
        select(AnalysisCandidate).where(AnalysisCandidate.analysis_session_id == session.id)
    ).all()
    results = db.scalars(
        select(AnalysisResult)
        .where(AnalysisResult.session_id == session.id)
        .order_by(AnalysisResult.created_at.desc(), AnalysisResult.id.desc())
    ).all()
    latest = {}
    for result in results:
        latest.setdefault(result.candidate_id, result)
    organizations = {}
    errors = []
    for candidate in candidates:
        result = latest.get(candidate.id)
        if not result:
            continue
        if result.result_status == "error":
            errors.append(
                {
                    "candidate_id": str(candidate.id),
                    "message": result.error_summary,
                    "code": result.error_code,
                }
            )
            continue
        org = result.input_metadata.get("reference_organization")
        if org and result.visual_similarity_score is not None:
            score = float(result.visual_similarity_score)
            if org["id"] not in organizations or organizations[org["id"]]["score"] < score:
                organizations[org["id"]] = {
                    **org,
                    "score": score,
                    "result_id": str(result.id),
                    "reference_asset_id": str(candidate.reference_asset_id),
                    "summary": result.structured_result.get("summary_vi", ""),
                    "explanation": compact_explanation(result),
                }
    successful = sum(x.result_status != "error" for x in latest.values())
    ranked = sorted(organizations.values(), key=lambda x: (-x["score"], x["name"], x["id"]))[:3]
    pending = len(candidates) - len(latest)
    return {
        **public(session),
        "total": len(candidates),
        "processed": len(latest),
        "successful": successful,
        "pending": pending,
        "errors": errors,
        "rankings": ranked,
        "retry_count": pending + len(errors),
        "complete_scan": pending == 0 and not errors,
        "insufficient_count": sum(x.result_status == "insufficient_data" for x in latest.values()),
        "aggregation": "Điểm cao nhất trong các mẫu đã so của từng tổ chức; không phải xác suất sở hữu con dấu.",
    }


async def run_search(session_id, user_id):
    with SessionLocal() as db:
        session = db.get(AnalysisSession, session_id)
        user = db.get(User, user_id)
        if not session or not user or not user.is_active:
            if session:
                session.status = "failed"
                db.commit()
            return
        candidates = db.scalars(
            select(AnalysisCandidate).where(AnalysisCandidate.analysis_session_id == session_id)
        ).all()
        results = db.scalars(
            select(AnalysisResult)
            .where(AnalysisResult.session_id == session_id)
            .order_by(AnalysisResult.created_at.desc())
        ).all()
        done = {}
        for result in results:
            done.setdefault(result.candidate_id, result.result_status)
        remaining = {x.id for x in candidates if done.get(x.id) in (None, "error")}
        try:
            await compare(
                db, session_id, CompareIn(consent=True), user, library_scan=True, candidate_ids=remaining
            )
        except Exception:
            # Never persist raw upstream exception text or credentials.
            db.rollback()
            session = db.get(AnalysisSession, session_id)
            session.status = "failed"
            session.completed_at = utcnow()
            db.commit()

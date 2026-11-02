import asyncio
import time
from datetime import timedelta

import openai
from sqlalchemy import select

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.db.base import utcnow
from app.db.models import AnalysisResult, AnalysisSession, PreprocessingRun
from app.db.repositories import audit, public
from app.matching.base import MatchInput
from app.matching.registry import get_provider
from app.prompts.seal_comparison_vi import PROMPT_VERSION
from app.services.candidate_selection_service import active_candidates, add_candidates, normalized_asset
from app.services.storage_service import asset_path


def preprocessing_snapshot(db, asset):
    run = db.scalar(select(PreprocessingRun).where(PreprocessingRun.output_asset_id == asset.id))
    return {
        "asset_id": str(asset.id),
        "sha256": asset.sha256,
        "width": asset.width,
        "height": asset.height,
        "preprocessing": public(run) if run else None,
        "source_metadata": asset.source_metadata,
    }


async def compare(db, session_id, body, user):
    if not body.consent:
        raise AppError(422, "consent_required", "Bạn cần cho phép gửi ảnh tới OpenAI trước khi phân tích.")
    if not get_settings().openai_api_key.get_secret_value():
        raise AppError(
            503,
            "openai_not_configured",
            "Chưa cấu hình OPENAI_API_KEY trong backend/.env. Vẫn có thể xử lý ảnh nội bộ.",
        )
    # Row lock protects the state transition from concurrent requests in multiple workers.
    session = db.scalar(select(AnalysisSession).where(AnalysisSession.id == session_id).with_for_update())
    if session.status == "running":
        stale_after = (
            get_settings().openai_request_timeout_seconds * get_settings().openai_max_compare_candidates + 120
        )
        if session.updated_at > utcnow() - timedelta(seconds=stale_after):
            raise AppError(409, "analysis_running", "Phiên đang phân tích. Vui lòng đợi kết quả.")
        audit(db, user, "recover_interrupted_analysis", "analysis", session.id)
    query = normalized_asset(db, body.query_asset_id or session.query_asset_id, user)
    if body.query_asset_id:
        session.query_asset_id = body.query_asset_id
    if body.candidates:
        for old in active_candidates(db, session):
            old.is_selected = False
        add_candidates(db, session, body.candidates, user)
    candidates = active_candidates(db, session)
    if not candidates or len(candidates) > get_settings().openai_max_compare_candidates:
        raise AppError(422, "candidate_limit", "Danh sách ảnh tham chiếu không hợp lệ.")
    references = [normalized_asset(db, c.reference_asset_id, user) for c in candidates]
    session.status = "running"
    session.completed_at = None
    session.consent_at = utcnow()
    session.consent_provider = "openai_vision"
    audit(
        db,
        user,
        "external_consent",
        "analysis",
        session.id,
        {"provider": "openai_vision", "calls": len(candidates)},
    )
    db.commit()
    provider = get_provider()
    try:
        for candidate, reference in zip(candidates, references, strict=True):
            started, clock = utcnow(), time.monotonic()
            snapshot = {
                "query": preprocessing_snapshot(db, query),
                "reference": preprocessing_snapshot(db, reference),
                "consent_at": session.consent_at.isoformat(),
            }
            try:
                output = await provider.analyse(
                    MatchInput(
                        asset_path(query),
                        asset_path(reference),
                        {
                            "roi_confirmed": True,
                            "query_preprocessing": snapshot["query"]["preprocessing"]["parameters"],
                            "reference_preprocessing": snapshot["reference"]["preprocessing"]["parameters"],
                            "user_notes": session.processing_notes,
                        },
                    )
                )
                result = output.comparison
                db.add(
                    AnalysisResult(
                        session_id=session.id,
                        candidate_id=candidate.id,
                        provider="openai_vision",
                        model_name=output.model,
                        provider_version=openai.__version__,
                        prompt_version=PROMPT_VERSION,
                        result_status=result.status,
                        visual_similarity_score=result.visual_similarity_score,
                        verdict=result.verdict,
                        confidence_label=result.visual_confidence_label,
                        structured_result=result.model_dump(mode="json"),
                        narrative=result.summary_vi,
                        quality_flags=result.limitations,
                        request_id_provider=output.request_id,
                        token_usage=output.usage,
                        started_at=started,
                        completed_at=utcnow(),
                        duration_ms=round((time.monotonic() - clock) * 1000),
                        input_metadata=snapshot,
                    )
                )
                audit(
                    db,
                    user,
                    "analysis_result",
                    "analysis",
                    session.id,
                    {"candidate_id": str(candidate.id), "status": result.status},
                )
                db.commit()
            except (AppError, asyncio.CancelledError) as exc:
                error = (
                    exc
                    if isinstance(exc, AppError)
                    else AppError(504, "cancelled", "Yêu cầu phân tích đã bị hủy.")
                )
                db.add(
                    AnalysisResult(
                        session_id=session.id,
                        candidate_id=candidate.id,
                        provider="openai_vision",
                        model_name=get_settings().openai_model,
                        provider_version=openai.__version__,
                        prompt_version=PROMPT_VERSION,
                        result_status="error",
                        verdict="insufficient_evidence",
                        error_code=error.code,
                        error_summary=error.message,
                        started_at=started,
                        completed_at=utcnow(),
                        duration_ms=round((time.monotonic() - clock) * 1000),
                        input_metadata=snapshot,
                    )
                )
                db.commit()
                raise
        session.status = "completed"
        session.completed_at = utcnow()
        db.commit()
    except BaseException:
        db.rollback()
        session.status = "failed"
        session.completed_at = utcnow()
        audit(db, user, "analysis_failed", "analysis", session.id)
        db.commit()
        raise
    return {"id": str(session.id), "status": session.status, "calls": len(candidates)}

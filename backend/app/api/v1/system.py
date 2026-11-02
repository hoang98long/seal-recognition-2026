import asyncio
import tempfile

import openai
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.security import admin, current_user, limiter
from app.db.models import (
    AnalysisSession,
    AuditLog,
    Organization,
    SealDesign,
    SealImpression,
    SourceDocument,
    User,
)
from app.db.repositories import audit, public
from app.db.session import get_db
from app.matching.providers.openai_vision import configured_client, provider_error
from app.services.image_preprocessing_service import PIPELINE_VERSION

router = APIRouter(tags=["Hệ thống"])


@router.get("/health")
def health(db: Session = Depends(get_db)):
    state = {"version": "1.0.0", "database": "ok", "storage": "ok", "status": "ok"}
    try:
        db.execute(text("SELECT 1"))
        db.execute(text("SELECT version_num FROM alembic_version"))
    except Exception:
        db.rollback()
        state["database"] = "unavailable"
        state["status"] = "unavailable"
    try:
        root = get_settings().storage_root
        root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryFile(dir=root) as f:
            f.write(b"health")
    except OSError:
        state["storage"] = "unavailable"
        state["status"] = "unavailable"
    if state["status"] != "ok":
        from fastapi.responses import JSONResponse

        return JSONResponse(state, status_code=503)
    return state


@router.get("/dashboard/summary")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    def count(model, conditions=()):
        return db.scalar(select(func.count()).select_from(model).where(*conditions))

    own_docs = () if user.role == "admin" else (SourceDocument.uploaded_by == user.id,)
    own_sessions = () if user.role == "admin" else (AnalysisSession.created_by == user.id,)
    recent = db.scalars(
        select(AnalysisSession).where(*own_sessions).order_by(AnalysisSession.created_at.desc()).limit(5)
    )
    activity = db.execute(
        select(func.date(AnalysisSession.created_at), func.count())
        .where(*own_sessions)
        .group_by(func.date(AnalysisSession.created_at))
        .order_by(func.date(AnalysisSession.created_at).desc())
        .limit(14)
    ).all()
    return {
        "documents": count(SourceDocument, own_docs),
        "designs": count(SealDesign, (SealDesign.status == "active",)),
        "impressions": count(SealImpression, (SealImpression.status == "active",)),
        "organizations": count(Organization, (Organization.status == "active",)),
        "analyses": count(AnalysisSession, own_sessions),
        "recent": [public(x) for x in recent],
        "activity": [{"date": str(d), "count": c} for d, c in reversed(activity)],
    }


@router.get("/settings/openai/status")
def openai_status(user: User = Depends(current_user)):
    settings = get_settings()
    return {
        "is_configured": bool(settings.openai_api_key.get_secret_value()),
        "model": settings.openai_model,
        "max_candidates": settings.openai_max_compare_candidates,
        "timeout_seconds": settings.openai_request_timeout_seconds,
        "max_image_side": settings.openai_max_image_side,
        "cost_status": "unknown",
        "pipeline_version": PIPELINE_VERSION,
        "max_upload_mb": settings.max_upload_mb,
        "max_pages": settings.max_pdf_pages,
    }


@router.post("/settings/openai/test")
async def test_openai(user: User = Depends(admin), db: Session = Depends(get_db)):
    limiter.check(f"test-openai:{user.id}", 3, 60)
    audit(db, user, "openai_connection_test", "settings")
    db.commit()
    async with configured_client() as client:
        try:
            async with asyncio.timeout(get_settings().openai_request_timeout_seconds):
                response = await client.responses.create(
                    model=get_settings().openai_model, input="Reply OK.", max_output_tokens=16, store=False
                )
            if response.status != "completed":
                raise AppError(502, "test_incomplete", "OpenAI chưa hoàn tất phản hồi kiểm tra.")
            return {
                "message": "Kết nối OpenAI thành công (kiểm tra văn bản tối thiểu; chưa kiểm tra cặp ảnh).",
                "model": response.model,
                "request_id": getattr(response, "_request_id", None),
                "usage": response.usage.model_dump() if response.usage else None,
            }
        except (openai.APIError, TimeoutError) as exc:
            raise provider_error(exc) from None


@router.get("/audit-logs")
def logs(user: User = Depends(admin), db: Session = Depends(get_db)):
    return [public(x) for x in db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(100))]

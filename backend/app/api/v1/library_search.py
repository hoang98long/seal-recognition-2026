import uuid

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.analyses import authorized_session
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.security import current_user, editor, limiter
from app.db.base import utcnow
from app.db.models import AnalysisSession, User
from app.db.repositories import audit
from app.db.session import get_db
from app.schemas.common import LibrarySearchIn, SearchResumeIn
from app.services.library_search_service import inventory, run_search, search_state, start_search

router = APIRouter(prefix="/library-searches", tags=["Tra cứu thư viện qua OpenAI"])


@router.get("/inventory")
def corpus(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return inventory(db)


@router.post("", status_code=201)
def start(
    body: LibrarySearchIn,
    background: BackgroundTasks,
    user: User = Depends(editor),
    db: Session = Depends(get_db),
):
    limiter.check(f"library-search:{user.id}", 5, 60)
    session = start_search(db, body, user)
    state = search_state(db, session)
    background.add_task(run_search, session.id, user.id)
    return state


@router.get("/{ident}")
def state(ident: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = authorized_session(db, ident, user)
    if session.mode != "organization_search":
        raise AppError(422, "search_session", "Đây không phải phiên tra cứu tổ chức.")
    return search_state(db, session)


@router.post("/{ident}/resume", status_code=202)
def resume(
    ident: uuid.UUID,
    body: SearchResumeIn,
    background: BackgroundTasks,
    user: User = Depends(editor),
    db: Session = Depends(get_db),
):
    if not body.consent:
        raise AppError(422, "consent_required", "Cần xác nhận lại để tiếp tục gửi các cặp ảnh còn lại.")
    if not get_settings().openai_api_key.get_secret_value():
        raise AppError(503, "openai_not_configured", "Chưa cấu hình OPENAI_API_KEY.")
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    session = authorized_session(db, ident, user)
    db.refresh(session, with_for_update=True)
    status = search_state(db, session)
    db.refresh(session, with_for_update=True)
    other = db.scalar(
        select(AnalysisSession.id).where(
            AnalysisSession.created_by == user.id,
            AnalysisSession.mode == "organization_search",
            AnalysisSession.id != ident,
            AnalysisSession.status.in_(["queued", "running"]),
        )
    )
    if other:
        raise AppError(409, "search_running", "Bạn đang có phiên tra cứu khác. Hãy đợi phiên đó hoàn tất.")
    if (
        session.mode != "organization_search"
        or session.status in {"queued", "running"}
        or not status["retry_count"]
    ):
        raise AppError(409, "search_state", "Phiên đang chạy hoặc không có cặp ảnh cần thử lại.")
    session.status = "queued"
    session.updated_at = utcnow()
    audit(db, user, "library_search_resume_consent", "analysis", session.id, {"calls": status["retry_count"]})
    db.commit()
    background.add_task(run_search, session.id, user.id)
    return {"id": str(session.id), "status": session.status}

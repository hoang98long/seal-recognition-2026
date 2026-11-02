import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.analyses import authorized_session
from app.core.security import current_user
from app.db.models import AnalysisResult, AnalysisSession, User
from app.db.repositories import public
from app.db.session import get_db
from app.services.report_service import make_report

router = APIRouter(prefix="/reports", tags=["Báo cáo"])


@router.get("")
def listing(user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = select(AnalysisSession).where(AnalysisSession.id.in_(select(AnalysisResult.session_id)))
    if user.role != "admin":
        query = query.where(AnalysisSession.created_by == user.id)
    return [public(x) for x in db.scalars(query.order_by(AnalysisSession.updated_at.desc()).limit(100))]


@router.get("/{ident}")
@router.get("/{ident}/export")
def report(
    ident: uuid.UUID,
    download: bool = False,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    session = authorized_session(db, ident, user)
    results = db.scalars(
        select(AnalysisResult).where(AnalysisResult.session_id == ident).order_by(AnalysisResult.created_at)
    ).all()
    headers = {
        "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox allow-same-origin"
    }
    if download:
        headers["Content-Disposition"] = f'attachment; filename="bao-cao-{ident}.html"'
    return Response(make_report(db, session, results, user), media_type="text/html", headers=headers)

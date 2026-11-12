import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.core.security import current_user, editor, limiter
from app.db.models import (
    AnalysisCandidate,
    AnalysisResult,
    AnalysisSession,
    AnnotationRegion,
    SourceDocument,
    User,
)
from app.db.repositories import audit, page_query, public, record
from app.db.session import get_db
from app.schemas.common import AnalysisIn, AnnotationIn, CompareIn
from app.services.analysis_orchestrator import compare
from app.services.candidate_selection_service import active_candidates, add_candidates, normalized_asset
from app.services.comparison_explanation import compact_explanation
from app.services.storage_service import authorized_asset

router = APIRouter(tags=["Phân tích"])


def authorized_session(db, ident, user):
    item = record(db, AnalysisSession, ident)
    if item.created_by != user.id and user.role != "admin":
        raise AppError(403, "private_analysis", "Bạn không có quyền mở phiên phân tích này.")
    return item


@router.post("/analyses", status_code=201)
def create(body: AnalysisIn, user: User = Depends(editor), db: Session = Depends(get_db)):
    normalized_asset(db, body.query_asset_id, user)
    if body.source_document_id:
        doc = record(db, SourceDocument, body.source_document_id)
        authorized_asset(db, doc.file_asset_id, user)
    if body.mode == "pairwise" and len(body.candidates) != 1:
        raise AppError(422, "pairwise_count", "So sánh hai ảnh cần đúng một ảnh K.")
    session = AnalysisSession(**body.model_dump(exclude={"candidates"}), created_by=user.id)
    db.add(session)
    db.flush()
    add_candidates(db, session, body.candidates, user)
    audit(db, user, "analysis_create", "analysis", session.id)
    db.commit()
    return public(session)


@router.get("/analyses")
def listing(
    q: str = "",
    status: str | None = None,
    model: str | None = None,
    design_code: str | None = None,
    created_by: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = select(AnalysisSession)
    if user.role != "admin":
        query = query.where(AnalysisSession.created_by == user.id)
    elif created_by:
        query = query.where(AnalysisSession.created_by == created_by)
    if q:
        query = query.where(AnalysisSession.title.ilike(f"%{q[:200]}%"))
    if status:
        query = query.where(AnalysisSession.status == status)
    if date_from:
        query = query.where(AnalysisSession.created_at >= date_from)
    if date_to:
        query = query.where(AnalysisSession.created_at <= date_to)
    if model:
        query = query.where(
            AnalysisSession.id.in_(
                select(AnalysisResult.session_id).where(AnalysisResult.model_name.ilike(f"%{model[:100]}%"))
            )
        )
    if design_code:
        from app.db.models import SealDesign, SealImpression

        ids = (
            select(AnalysisCandidate.analysis_session_id)
            .join(SealImpression, AnalysisCandidate.reference_impression_id == SealImpression.id)
            .join(SealDesign, SealImpression.seal_design_id == SealDesign.id)
            .where(SealDesign.design_code.ilike(f"%{design_code[:80]}%"))
        )
        query = query.where(AnalysisSession.id.in_(ids))
    return page_query(
        db,
        AnalysisSession,
        query.order_by(AnalysisSession.created_at.desc(), AnalysisSession.id),
        page,
        page_size,
    )


@router.get("/analyses/{ident}")
def detail(ident: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = authorized_session(db, ident, user)
    return {**public(item), "candidates": [public(x) for x in active_candidates(db, item)]}


@router.post("/analyses/{ident}/compare-openai")
async def compare_openai(
    ident: uuid.UUID, body: CompareIn, user: User = Depends(editor), db: Session = Depends(get_db)
):
    limiter.check(f"analysis:{user.id}", 10, 60)
    authorized_session(db, ident, user)
    return await compare(db, ident, body, user)


@router.get("/analyses/{ident}/results")
def results(ident: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorized_session(db, ident, user)
    items = db.scalars(
        select(AnalysisResult)
        .where(AnalysisResult.session_id == ident)
        .order_by(AnalysisResult.created_at.desc())
    )
    result = []
    for item in items:
        result.append(
            {
                **public(item),
                "explanation": compact_explanation(item),
                "annotations": [
                    public(x)
                    for x in db.scalars(
                        select(AnnotationRegion)
                        .where(AnnotationRegion.analysis_result_id == item.id)
                        .order_by(AnnotationRegion.created_at)
                    )
                ],
            }
        )
    return result


@router.post("/analysis-results/{ident}/annotations", status_code=201)
def annotate(
    ident: uuid.UUID, body: AnnotationIn, user: User = Depends(editor), db: Session = Depends(get_db)
):
    result = record(db, AnalysisResult, ident)
    authorized_session(db, result.session_id, user)
    item = AnnotationRegion(analysis_result_id=ident, created_by=user.id, source="user", **body.model_dump())
    db.add(item)
    db.flush()
    audit(db, user, "annotation_create", "analysis_result", ident)
    db.commit()
    return public(item)


@router.delete("/annotations/{ident}")
def delete_annotation(ident: uuid.UUID, user: User = Depends(editor), db: Session = Depends(get_db)):
    item = record(db, AnnotationRegion, ident)
    result = record(db, AnalysisResult, item.analysis_result_id)
    authorized_session(db, result.session_id, user)
    if item.created_by != user.id and user.role != "admin":
        raise AppError(403, "annotation_owner", "Chỉ tác giả hoặc quản trị viên được xóa vùng đánh dấu.")
    db.delete(item)
    audit(db, user, "annotation_delete", "analysis_result", result.id)
    db.commit()
    return {"message": "Đã xóa vùng đánh dấu."}

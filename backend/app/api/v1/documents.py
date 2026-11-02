import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.security import current_user, editor
from app.db.models import FileAsset, SourceDocument, User
from app.db.repositories import audit, page_query, public, record
from app.db.session import get_db
from app.schemas.common import DocumentIn
from app.services.image_validation_service import validate_bytes
from app.services.pdf_render_service import PDF_LOCK, load_page, png_bytes
from app.services.storage_service import asset_path, authorized_asset, store

router = APIRouter(tags=["Tài liệu và tệp"])


@router.post("/assets/upload", status_code=201)
async def upload(
    file: UploadFile = File(...),
    kind: Literal["document", "original_stamp"] = "document",
    user: User = Depends(editor),
    db: Session = Depends(get_db),
):
    data = bytearray()
    limit = get_settings().max_upload_mb * 1024 * 1024
    while chunk := await file.read(1024 * 1024):
        data.extend(chunk)
        if len(data) > limit:
            raise AppError(422, "file_size", "Tệp vượt giới hạn dung lượng.")

    def save():
        with PDF_LOCK:
            meta = validate_bytes(bytes(data))
        asset = store(db, bytes(data), file.filename or "tai-lieu", meta, user, kind)
        audit(
            db, user, "upload", "asset", asset.id, {"media_type": asset.media_type, "size": asset.file_size}
        )
        db.commit()
        return public(asset)

    return await run_in_threadpool(save)


@router.get("/assets")
def assets(
    kind: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = select(FileAsset).where(FileAsset.uploaded_by == user.id)
    if kind:
        query = query.where(FileAsset.kind == kind)
    return page_query(
        db, FileAsset, query.order_by(FileAsset.created_at.desc(), FileAsset.id), page, page_size
    )


@router.get("/assets/{ident}")
def asset_metadata(ident: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return public(authorized_asset(db, ident, user))


@router.get("/assets/{ident}/download")
def download(ident: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    asset = authorized_asset(db, ident, user)
    return FileResponse(
        asset_path(asset),
        media_type=asset.media_type,
        filename=asset.original_filename,
        headers={"Cache-Control": "private, no-store"},
    )


@router.get("/assets/{ident}/preview")
def preview(
    ident: uuid.UUID,
    page: int = Query(1, ge=1),
    full: bool = False,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    asset = authorized_asset(db, ident, user)
    image = load_page(asset, page)
    width, height = image.size
    if not full:
        image.thumbnail((1600, 1600))
    return Response(
        png_bytes(image),
        media_type="image/png",
        headers={
            "X-Image-Width": str(width),
            "X-Image-Height": str(height),
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/documents")
def documents(
    q: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = select(SourceDocument)
    if user.role != "admin":
        query = query.where(SourceDocument.uploaded_by == user.id)
    if q:
        query = query.where(SourceDocument.display_name.ilike(f"%{q[:200]}%"))
    return page_query(db, SourceDocument, query.order_by(SourceDocument.created_at.desc()), page, page_size)


@router.post("/documents", status_code=201)
def create_document(body: DocumentIn, user: User = Depends(editor), db: Session = Depends(get_db)):
    asset = authorized_asset(db, body.file_asset_id, user)
    existing = db.scalar(select(SourceDocument).where(SourceDocument.file_asset_id == asset.id))
    if existing:
        return public(existing)
    item = SourceDocument(**body.model_dump(), page_count=asset.page_count, uploaded_by=user.id)
    db.add(item)
    db.flush()
    audit(db, user, "document_create", "document", item.id)
    db.commit()
    return public(item)


@router.get("/documents/{ident}")
def get_document(ident: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    doc = record(db, SourceDocument, ident)
    asset = authorized_asset(db, doc.file_asset_id, user)
    return {**public(doc), "asset": public(asset)}


@router.get("/documents/{ident}/pages/{page}/preview")
def document_preview(
    ident: uuid.UUID, page: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    doc = record(db, SourceDocument, ident)
    return preview(doc.file_asset_id, page, False, user, db)

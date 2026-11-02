import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.core.security import current_user, editor, limiter
from app.db.models import PreprocessingProfile, PreprocessingRun, User
from app.db.repositories import audit, public, record
from app.db.session import get_db
from app.schemas.common import PreprocessIn, ProfileIn
from app.services.image_preprocessing_service import PIPELINE_VERSION, process, suggest_roi
from app.services.pdf_render_service import load_page, png_bytes
from app.services.storage_service import authorized_asset, store

router = APIRouter(prefix="/preprocessing", tags=["Tiền xử lý"])


@router.get("/profiles")
def profiles(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [
        public(x)
        for x in db.scalars(
            select(PreprocessingProfile)
            .where(
                or_(
                    PreprocessingProfile.owner_user_id == user.id,
                    PreprocessingProfile.owner_user_id.is_(None),
                )
            )
            .order_by(PreprocessingProfile.created_at.desc())
        )
    ]


@router.post("/profiles", status_code=201)
def create_profile(body: ProfileIn, user: User = Depends(editor), db: Session = Depends(get_db)):
    if body.is_default:
        for old in db.scalars(
            select(PreprocessingProfile).where(PreprocessingProfile.owner_user_id == user.id)
        ):
            old.is_default = False
    item = PreprocessingProfile(owner_user_id=user.id, **body.model_dump())
    db.add(item)
    db.flush()
    audit(db, user, "profile_create", "preprocessing_profile", item.id)
    db.commit()
    return public(item)


@router.get("/suggest-roi/{asset_id}")
def suggest(
    asset_id: uuid.UUID, page: int = 1, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    image = load_page(authorized_asset(db, asset_id, user), page)
    return {
        "roi": suggest_roi(image),
        "width": image.width,
        "height": image.height,
        "message": "Vùng mực đỏ gợi ý. Hãy kiểm tra và điều chỉnh thủ công.",
    }


@router.post("/preview")
def preview(body: PreprocessIn, user: User = Depends(editor), db: Session = Depends(get_db)):
    limiter.check(f"preview:{user.id}", 120, 60)
    asset = authorized_asset(db, body.source_asset_id, user)
    image = process(load_page(asset, body.page), body.roi, body.parameters, preview=True)
    image.thumbnail((1200, 1200))
    return Response(png_bytes(image), media_type="image/png", headers={"Cache-Control": "no-store"})


@router.post("/apply", status_code=201)
def apply(body: PreprocessIn, user: User = Depends(editor), db: Session = Depends(get_db)):
    if not body.roi_confirmed:
        raise AppError(422, "roi_confirmation", "Vui lòng xác nhận vùng con dấu trước khi lưu.")
    asset = authorized_asset(db, body.source_asset_id, user)
    if body.profile_id:
        profile = record(db, PreprocessingProfile, body.profile_id)
        if profile.owner_user_id not in {None, user.id}:
            raise AppError(403, "profile_private", "Hồ sơ xử lý thuộc người dùng khác.")
    source = load_page(asset, body.page)
    whole_page = (
        body.roi.x == 0
        and body.roi.y == 0
        and body.roi.width == source.width
        and body.roi.height == source.height
    )
    if whole_page and not body.allow_full_page:
        raise AppError(
            422,
            "full_page_consent",
            "Bạn đang dùng toàn ảnh/trang. Hãy cắt ROI hoặc xác nhận riêng cho phép dùng toàn ảnh.",
        )
    output = process(source, body.roi, body.parameters)
    saved = store(
        db,
        png_bytes(output),
        "con-dau-da-xu-ly.png",
        {"media_type": "image/png", "extension": ".png", "width": output.width, "height": output.height},
        user,
        "processed_stamp",
        {
            "source_asset_id": str(asset.id),
            "source_page": body.page,
            "roi_confirmed": True,
            "whole_source_confirmed": whole_page and body.allow_full_page,
            "roi": body.roi.model_dump(),
            "pipeline_version": PIPELINE_VERSION,
        },
    )
    run = PreprocessingRun(
        source_asset_id=asset.id,
        output_asset_id=saved.id,
        profile_id=body.profile_id,
        source_page=body.page,
        roi_geometry=body.roi.model_dump(),
        parameters=body.parameters.model_dump(),
        pipeline_version=PIPELINE_VERSION,
        initiated_by=user.id,
    )
    db.add(run)
    db.flush()
    audit(db, user, "preprocess_apply", "preprocessing_run", run.id, {"output_asset_id": str(saved.id)})
    db.commit()
    return {"run": public(run), "asset": public(saved)}


@router.get("/runs/{ident}")
def get_run(ident: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    run = record(db, PreprocessingRun, ident)
    authorized_asset(db, run.output_asset_id, user)
    return public(run)

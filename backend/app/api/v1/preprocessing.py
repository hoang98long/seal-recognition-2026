import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.core.security import current_user, editor, limiter
from app.db.models import Organization, PreprocessingProfile, PreprocessingRun, User
from app.db.repositories import audit, public, record
from app.db.session import get_db
from app.schemas.common import OrganizationLinkIn, PreprocessIn, ProfileIn
from app.services.image_preprocessing_service import PIPELINE_VERSION, process, suggest_roi
from app.services.pdf_render_service import load_page, png_bytes
from app.services.storage_service import authorized_asset, store

router = APIRouter(prefix="/preprocessing", tags=["Tiền xử lý"])


@router.get("/profiles")
def profiles(
    organization_id: uuid.UUID | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = select(PreprocessingProfile).where(
        or_(
            PreprocessingProfile.owner_user_id == user.id,
            PreprocessingProfile.owner_user_id.is_(None),
            PreprocessingProfile.organization_id.is_not(None),
        )
    )
    if organization_id:
        record(db, Organization, organization_id)
        query = query.where(PreprocessingProfile.organization_id == organization_id)
    return [public(x) for x in db.scalars(query.order_by(PreprocessingProfile.created_at.desc()))]


@router.post("/profiles", status_code=201)
def create_profile(body: ProfileIn, user: User = Depends(editor), db: Session = Depends(get_db)):
    if body.organization_id:
        record(db, Organization, body.organization_id)
    if body.is_default:
        for old in db.scalars(
            select(PreprocessingProfile)
            .where(PreprocessingProfile.owner_user_id == user.id)
            .where(PreprocessingProfile.organization_id == body.organization_id)
        ):
            old.is_default = False
    item = PreprocessingProfile(owner_user_id=user.id, **body.model_dump())
    db.add(item)
    db.flush()
    audit(db, user, "profile_create", "preprocessing_profile", item.id)
    db.commit()
    return public(item)


@router.patch("/profiles/{ident}/organization")
def link_profile(
    ident: uuid.UUID, body: OrganizationLinkIn, user: User = Depends(editor), db: Session = Depends(get_db)
):
    profile = record(db, PreprocessingProfile, ident)
    if profile.owner_user_id != user.id and user.role != "admin":
        raise AppError(
            403, "profile_owner", "Chỉ người tạo hoặc quản trị viên được gắn cấu hình vào tổ chức."
        )
    if body.organization_id:
        record(db, Organization, body.organization_id)
    profile.organization_id = body.organization_id
    audit(db, user, "profile_organization", "preprocessing_profile", profile.id)
    db.commit()
    return public(profile)


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
    organization = record(db, Organization, body.organization_id) if body.organization_id else None
    if body.profile_id:
        profile = record(db, PreprocessingProfile, body.profile_id)
        if profile.owner_user_id not in {None, user.id} and not profile.organization_id:
            raise AppError(403, "profile_private", "Hồ sơ xử lý thuộc người dùng khác.")
        if profile.organization_id and profile.organization_id != body.organization_id:
            raise AppError(422, "profile_organization", "Cấu hình xử lý không thuộc tổ chức đã chọn.")
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
        f"{Path(asset.original_filename).stem[:170]}-trang-{body.page}-con-dau.png",
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
            "organization_id": str(organization.id) if organization else None,
        },
    )
    org_label = (
        f" ({organization.code or organization.short_name or organization.name})" if organization else ""
    )
    saved.display_name = (
        f"{body.output_name or Path(asset.original_filename).stem} · trang {body.page}{org_label}"[:230]
        + f" · {str(saved.id)[:8]}"
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


@router.get("/by-output/{asset_id}")
def by_output(asset_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    asset = authorized_asset(db, asset_id, user)
    run = db.scalar(
        select(PreprocessingRun)
        .where(PreprocessingRun.output_asset_id == asset.id)
        .order_by(PreprocessingRun.created_at.desc())
        .limit(1)
    )
    return {"asset": public(asset), "run": public(run)} if run else None

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import ValidationError, create_model
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.core.security import current_user, editor
from app.db.models import (
    AnalysisCandidate,
    AnalysisResult,
    Organization,
    SealDesign,
    SealDevice,
    SealImpression,
    User,
)
from app.db.repositories import audit, page_query, public, record
from app.db.session import get_db
from app.schemas.common import DesignIn, DeviceIn, ImpressionIn, OrganizationIn
from app.services.storage_service import authorized_asset

router = APIRouter(tags=["Thư viện"])


def validate_references(db, model, values, user):
    if model == Organization and values.get("parent_organization_id"):
        record(db, Organization, values["parent_organization_id"])
    if model == SealDesign and values.get("organization_id"):
        record(db, Organization, values["organization_id"])
    if model == SealDevice and values.get("seal_design_id"):
        record(db, SealDesign, values["seal_design_id"])
    if model == SealImpression:
        design = record(db, SealDesign, values["seal_design_id"])
        asset = authorized_asset(db, values["image_asset_id"], user)
        if not asset.media_type.startswith("image/") or asset.page_count != 1:
            raise AppError(
                422, "reference_image", "Hãy cắt và lưu một ảnh con dấu đơn trước khi thêm vào thư viện."
            )
        device_id = values.get("seal_device_id")
        if device_id and record(db, SealDevice, device_id).seal_design_id != design.id:
            raise AppError(422, "device_design", "Dụng cụ không thuộc mẫu thiết kế đã chọn.")
        if values.get("source_document_id"):
            from app.db.models import SourceDocument

            doc = record(db, SourceDocument, values["source_document_id"])
            authorized_asset(db, doc.file_asset_id, user)
            if values.get("source_page") and values["source_page"] > doc.page_count:
                raise AppError(422, "source_page", "Trang nguồn không hợp lệ.")
        values["organization_id"] = design.organization_id


def register_crud(path, model, schema, search_fields):
    partial = create_model(
        f"{schema.__name__}Patch",
        __base__=schema,
        **{k: (v.annotation | None, None) for k, v in schema.model_fields.items()},
    )

    def listing(
        q: str = Query(default="", max_length=200),
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=24, ge=1, le=100),
        organization_id: uuid.UUID | None = None,
        seal_design_id: uuid.UUID | None = None,
        status: str = "active",
        sort: str = "newest",
        user: User = Depends(current_user),
        db: Session = Depends(get_db),
    ):
        query = select(model).where(model.status != "deleted")
        if status in {"active", "inactive"}:
            query = query.where(model.status == status)
        if model == SealImpression:
            if user.role != "admin":
                query = query.where(or_(model.is_reference.is_(True), model.created_by == user.id))
        if q:
            clauses = [getattr(model, key).ilike(f"%{q}%") for key in search_fields]
            if model == SealImpression:
                clauses.extend(
                    [
                        model.seal_design_id.in_(
                            select(SealDesign.id).where(
                                or_(SealDesign.name.ilike(f"%{q}%"), SealDesign.design_code.ilike(f"%{q}%"))
                            )
                        ),
                        model.organization_id.in_(
                            select(Organization.id).where(Organization.name.ilike(f"%{q}%"))
                        ),
                    ]
                )
            query = query.where(or_(*clauses))
        if organization_id and hasattr(model, "organization_id"):
            query = query.where(model.organization_id == organization_id)
        if seal_design_id and hasattr(model, "seal_design_id"):
            query = query.where(model.seal_design_id == seal_design_id)
        query = query.order_by(
            model.created_at.asc() if sort == "oldest" else model.created_at.desc(), model.id
        )
        result = page_query(db, model, query, page, page_size)
        if model == SealImpression:
            for row in result["items"]:
                row["design_name"] = db.get(SealDesign, uuid.UUID(row["seal_design_id"])).name
                row["organization_name"] = db.get(Organization, uuid.UUID(row["organization_id"])).name
        return result

    def create(body, user: User = Depends(editor), db: Session = Depends(get_db)):
        values = body.model_dump()
        validate_references(db, model, values, user)
        if hasattr(model, "created_by"):
            values["created_by"] = user.id
        item = model(**values)
        db.add(item)
        db.flush()
        audit(db, user, "create", path, item.id)
        db.commit()
        return public(item)

    create.__annotations__["body"] = schema

    def get_one(ident: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
        item = record(db, model, ident)
        if (
            model == SealImpression
            and not item.is_reference
            and item.created_by != user.id
            and user.role != "admin"
        ):
            raise AppError(403, "private_impression", "Ảnh dấu này là dữ liệu riêng.")
        return public(item)

    def patch(ident: uuid.UUID, body, user: User = Depends(editor), db: Session = Depends(get_db)):
        item = record(db, model, ident)
        if (
            model == SealImpression
            and not item.is_reference
            and item.created_by != user.id
            and user.role != "admin"
        ):
            raise AppError(403, "private_impression", "Ảnh dấu này là dữ liệu riêng.")
        changes = body.model_dump(exclude_unset=True)
        try:
            merged = schema.model_validate(
                {k: changes.get(k, getattr(item, k)) for k in schema.model_fields}
            ).model_dump()
        except ValidationError:
            raise AppError(
                422, "validation", "Thông tin cập nhật không hợp lệ hoặc thiếu trường bắt buộc."
            ) from None
        validate_references(db, model, merged, user)
        if model == Organization and merged.get("parent_organization_id"):
            seen = {ident}
            parent = merged["parent_organization_id"]
            while parent:
                if parent in seen:
                    raise AppError(422, "organization_cycle", "Tổ chức cha tạo thành vòng lặp.")
                seen.add(parent)
                parent = record(db, Organization, parent).parent_organization_id
        for k, v in merged.items():
            setattr(item, k, v)
        audit(db, user, "update", path, item.id)
        db.commit()
        return public(item)

    patch.__annotations__["body"] = partial

    def remove(ident: uuid.UUID, user: User = Depends(editor), db: Session = Depends(get_db)):
        item = record(db, model, ident)
        if (
            model == SealImpression
            and not item.is_reference
            and item.created_by != user.id
            and user.role != "admin"
        ):
            raise AppError(403, "private_impression", "Ảnh dấu này là dữ liệu riêng.")
        item.status = "deleted"
        audit(db, user, "soft_delete", path, item.id)
        db.commit()
        return {"message": "Đã lưu trữ dữ liệu. Lịch sử được giữ nguyên."}

    for fn, method, suffix in [
        (listing, "GET", ""),
        (create, "POST", ""),
        (get_one, "GET", "/{ident}"),
        (patch, "PATCH", "/{ident}"),
        (remove, "DELETE", "/{ident}"),
    ]:
        router.add_api_route(
            f"/{path}{suffix}",
            fn,
            methods=[method],
            name=f"{path}_{fn.__name__}",
            status_code=201 if method == "POST" else 200,
        )


register_crud("organizations", Organization, OrganizationIn, ["name", "code", "short_name"])
register_crud("seal-designs", SealDesign, DesignIn, ["name", "design_code"])
register_crud("seal-devices", SealDevice, DeviceIn, ["internal_device_code", "inventory_note"])
register_crud(
    "seal-impressions", SealImpression, ImpressionIn, ["note", "observed_color", "image_quality_note"]
)


@router.get("/seal-designs/{ident}/usage")
def design_usage(ident: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    record(db, SealDesign, ident)
    query = (
        select(AnalysisResult)
        .join(AnalysisCandidate, AnalysisResult.candidate_id == AnalysisCandidate.id)
        .join(SealImpression, AnalysisCandidate.reference_impression_id == SealImpression.id)
        .where(SealImpression.seal_design_id == ident)
    )
    if user.role != "admin":
        from app.db.models import AnalysisSession

        query = query.join(AnalysisSession, AnalysisResult.session_id == AnalysisSession.id).where(
            AnalysisSession.created_by == user.id
        )
    return [public(r) for r in db.scalars(query.order_by(AnalysisResult.created_at.desc()).limit(100))]

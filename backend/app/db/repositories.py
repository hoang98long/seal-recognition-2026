import uuid

from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, inspect, select

from app.core.exceptions import AppError
from app.db.models import AuditLog


def record(db, model, ident):
    item = db.get(model, ident)
    if not item or getattr(item, "status", "") == "deleted":
        raise AppError(404, "not_found", "Không tìm thấy dữ liệu.")
    return item


def public(item, exclude=()):
    hidden = {"password_hash", "token_hash", "csrf_hash", "relative_storage_path", *exclude}
    return jsonable_encoder(
        {c.key: getattr(item, c.key) for c in inspect(item).mapper.column_attrs if c.key not in hidden}
    )


def page_query(db, model, query, page, page_size):
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    items = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [public(x) for x in items], "total": total, "page": page, "page_size": page_size}


def audit(db, user, action, entity_type, entity_id=None, details=None):
    db.add(
        AuditLog(
            actor_user_id=user.id if user else None,
            action=action,
            entity_type=entity_type,
            entity_id=uuid.UUID(str(entity_id)) if entity_id else None,
            sanitized_details=details or {},
        )
    )

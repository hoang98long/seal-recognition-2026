import hashlib
import re
import uuid
from pathlib import Path

from sqlalchemy import select

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.db.models import FileAsset, SealImpression
from app.db.repositories import record


def asset_path(asset: FileAsset) -> Path:
    root = get_settings().storage_root
    path = (root / asset.relative_storage_path).resolve()
    if not path.is_relative_to(root):
        raise AppError(403, "path", "Đường dẫn tệp không hợp lệ.")
    if not path.is_file():
        raise AppError(404, "missing_file", "Tệp không còn trong kho lưu trữ.")
    return path


def authorized_asset(db, ident, user):
    asset = record(db, FileAsset, ident)
    shared = db.scalar(
        select(SealImpression.id).where(
            SealImpression.image_asset_id == asset.id,
            SealImpression.is_reference.is_(True),
            SealImpression.status == "active",
        )
    )
    if asset.uploaded_by != user.id and user.role != "admin" and not shared:
        raise AppError(403, "private_file", "Bạn không có quyền truy cập tệp riêng của người khác.")
    return asset


def store(db, data, filename, metadata, user, kind="document", source_metadata=None):
    sha = hashlib.sha256(data).hexdigest()
    # Reuse only original uploads belonging to this user. Each processed variant has its own provenance.
    if kind != "processed_stamp":
        existing = db.scalar(
            select(FileAsset).where(
                FileAsset.sha256 == sha, FileAsset.uploaded_by == user.id, FileAsset.kind == kind
            )
        )
        if existing:
            return existing
    ident = uuid.uuid4()
    folder = "processed" if kind == "processed_stamp" else "uploads"
    relative = f"{folder}/{user.id}/{ident}{metadata['extension']}"
    path = get_settings().storage_root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    safe_name = re.sub(r"[^\w. ()-]", "_", filename.replace("\\", "/").split("/")[-1])[:240] or "tai-lieu"
    asset = FileAsset(
        id=ident,
        kind=kind,
        original_filename=safe_name,
        media_type=metadata["media_type"],
        file_size=len(data),
        sha256=sha,
        relative_storage_path=relative,
        width=metadata.get("width"),
        height=metadata.get("height"),
        page_count=metadata.get("page_count", 1),
        uploaded_by=user.id,
        source_metadata=source_metadata or {},
    )
    db.add(asset)
    db.flush()
    return asset

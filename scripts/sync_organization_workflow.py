"""Back up the local PostgreSQL DB, migrate additively and sync the requested catalog."""

import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from app.core.config import Settings
from app.db.models import (
    FileAsset,
    Organization,
    PreprocessingRun,
    SealImpression,
    User,
)
from app.organization_catalog import sync_catalog
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url


def main():
    root = Path(__file__).resolve().parents[1]
    settings = Settings()
    url = make_url(settings.database_url.get_secret_value())
    pg_dump = shutil.which("pg_dump")
    if not pg_dump:
        candidates = sorted(
            Path("C:/Program Files/PostgreSQL").glob("*/bin/pg_dump.exe"), reverse=True
        )
        pg_dump = str(candidates[0]) if candidates else None
    if not pg_dump:
        raise SystemExit(
            "Không tìm thấy pg_dump. Chưa thay đổi CSDL; cần công cụ PostgreSQL để sao lưu trước."
        )
    folder = (root / "data/backups").resolve()
    assert folder.is_relative_to(root)
    folder.mkdir(parents=True, exist_ok=True)
    backup = folder / (
        "seal-before-org-workflow-" + datetime.now().strftime("%Y%m%d-%H%M%S") + ".dump"
    )
    env = {
        **os.environ,
        "PGHOST": url.host or "localhost",
        "PGPORT": str(url.port or 5432),
        "PGUSER": url.username or "postgres",
        "PGPASSWORD": url.password or "",
        "PGDATABASE": url.database or "seal_forensics",
    }
    result = subprocess.run(
        [pg_dump, "--format=custom", "--file", str(backup)],
        env=env,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise SystemExit(
            "Sao lưu PostgreSQL thất bại. Chưa thay đổi CSDL. Kiểm tra dịch vụ/quyền pg_dump."
        )
    print("Backup:", backup.relative_to(root))
    engine = create_engine(settings.database_url.get_secret_value())
    with engine.connect() as connection:
        before = {
            table: connection.scalar(text(f"SELECT count(*) FROM {table}"))
            for table in (
                "users",
                "file_assets",
                "source_documents",
                "seal_impressions",
                "analysis_results",
            )
        }
    config = Config(str(root / "backend/alembic.ini"))
    command.upgrade(config, "head")
    from sqlalchemy.orm import Session

    with Session(engine) as db:
        owner = db.scalar(
            select(User).where(User.role == "admin").order_by(User.created_at)
        )
        if not owner:
            raise SystemExit(
                "Không có quản trị viên để gắn danh mục. Migration đã áp dụng, chưa thêm tổ chức."
            )
        created = sync_catalog(db, owner.id)
        renamed = 0
        for asset in db.scalars(
            select(FileAsset).where(
                FileAsset.kind == "processed_stamp", FileAsset.display_name.is_(None)
            )
        ):
            impression = db.scalar(
                select(SealImpression).where(
                    SealImpression.image_asset_id == asset.id,
                    SealImpression.status != "deleted",
                )
            )
            run = db.scalar(
                select(PreprocessingRun).where(
                    PreprocessingRun.output_asset_id == asset.id
                )
            )
            source = db.get(FileAsset, run.source_asset_id) if run else None
            name = (
                Path(source.original_filename).stem
                if source
                else Path(asset.original_filename).stem
            )
            organization = (
                db.get(Organization, impression.organization_id) if impression else None
            )
            label = (
                f" ({organization.code or organization.name})" if organization else ""
            )
            asset.display_name = (
                f"{name} · trang {run.source_page if run else 1}{label}"[:230]
                + f" · {str(asset.id)[:8]}"
            )
            renamed += 1
        db.commit()
        after = {
            table: db.scalar(text(f"SELECT count(*) FROM {table}")) for table in before
        }
    assert before == after, (
        "Số bản ghi nghiệp vụ đã thay đổi ngoài dự kiến. Có bản sao lưu để đối chiếu."
    )
    engine.dispose()
    print("Organization catalog added:", ", ".join(created) or "already synchronized")
    print("Processed image display names updated:", renamed)
    print("Business record counts preserved:", after)


if __name__ == "__main__":
    main()

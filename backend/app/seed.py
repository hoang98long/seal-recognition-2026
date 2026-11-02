from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import password_hasher
from app.db.models import Organization, User
from app.db.session import SessionLocal


def seed(db):
    if get_settings().app_env != "development":
        raise RuntimeError("Không seed admin/admin trong môi trường ngoài development.")
    user = db.scalar(select(User).where(User.username == "admin"))
    if not user:
        user = User(
            username="admin",
            full_name="Quản trị viên",
            role="admin",
            password_hash=password_hasher.hash("admin"),
            must_change_password=True,
        )
        db.add(user)
        db.flush()
    for code, name in [("DEMO-01", "Đơn vị thử nghiệm DEMO 01"), ("DEMO-02", "Phòng thử nghiệm DEMO 02")]:
        if not db.scalar(select(Organization).where(Organization.code == code)):
            db.add(
                Organization(
                    code=code,
                    name=name,
                    description="Dữ liệu DEMO, không đại diện cơ quan thực tế.",
                    created_by=user.id,
                )
            )
    db.commit()


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
    print("Seed hoàn tất (idempotent). Tài khoản mới phải đổi mật khẩu ở lần đăng nhập đầu.")

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.core.security import admin, password_hasher
from app.db.models import AuthSession, User
from app.db.repositories import audit, public, record
from app.db.session import get_db
from app.schemas.common import UserCreate, UserUpdate

router = APIRouter(prefix="/users", tags=["Người dùng"])


@router.get("")
def users(user: User = Depends(admin), db: Session = Depends(get_db)):
    return [public(x) for x in db.scalars(select(User).order_by(User.username))]


@router.post("", status_code=201)
def create(body: UserCreate, user: User = Depends(admin), db: Session = Depends(get_db)):
    values = body.model_dump(exclude={"password"})
    values["username"] = values["username"].lower()
    item = User(**values, password_hash=password_hasher.hash(body.password), must_change_password=True)
    db.add(item)
    db.flush()
    audit(db, user, "user_create", "user", item.id)
    db.commit()
    return public(item)


@router.patch("/{ident}")
def update(ident: uuid.UUID, body: UserUpdate, user: User = Depends(admin), db: Session = Depends(get_db)):
    item = record(db, User, ident)
    if ident == user.id and (body.is_active is False or body.role not in {None, "admin"}):
        raise AppError(422, "self_lockout", "Không thể tự thu hồi quyền quản trị của phiên hiện tại.")
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(item, key, value)
    db.execute(delete(AuthSession).where(AuthSession.user_id == ident))
    audit(db, user, "user_update", "user", item.id)
    db.commit()
    return public(item)

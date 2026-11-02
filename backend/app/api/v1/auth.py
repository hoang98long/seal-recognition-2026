from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.security import (
    DUMMY_HASH,
    current_user,
    digest,
    limiter,
    new_session,
    password_hasher,
    verify_password,
)
from app.db.base import utcnow
from app.db.models import AuthSession, User
from app.db.repositories import audit, public
from app.db.session import get_db
from app.schemas.common import ChangePassword, Login

router = APIRouter(prefix="/auth", tags=["Tài khoản"])


def cookies(response, token, csrf, seconds):
    secure = get_settings().app_env == "production"
    response.set_cookie(
        "seal_session", token, max_age=seconds, httponly=True, secure=secure, samesite="strict", path="/"
    )
    response.set_cookie(
        "seal_csrf", csrf, max_age=seconds, httponly=False, secure=secure, samesite="strict", path="/"
    )


@router.post("/login")
def login(body: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    limiter.check(f"login:{request.client.host}", 10, 300)
    origin = request.headers.get("origin")
    if origin and origin != get_settings().frontend_origin:
        raise AppError(403, "origin", "Nguồn truy cập không được phép.")
    user = db.scalar(select(User).where(func.lower(User.username) == body.username.strip().lower()))
    valid = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if not valid or not user or not user.is_active:
        raise AppError(401, "invalid_credentials", "Tên đăng nhập hoặc mật khẩu không đúng.")
    if get_settings().app_env == "production" and (body.password == "admin" or user.must_change_password):
        raise AppError(403, "default_password", "Mật khẩu mặc định bị từ chối trong môi trường production.")
    user.last_login_at = utcnow()
    token, csrf, seconds = new_session(db, user, body.remember)
    cookies(response, token, csrf, seconds)
    audit(db, user, "login", "user", user.id)
    db.commit()
    return {"user": public(user), "csrf_token": csrf}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return public(user)


@router.post("/logout")
def logout(
    request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    db.execute(
        delete(AuthSession).where(AuthSession.token_hash == digest(request.cookies.get("seal_session", "")))
    )
    audit(db, user, "logout", "user", user.id)
    db.commit()
    response.delete_cookie("seal_session", path="/")
    response.delete_cookie("seal_csrf", path="/")
    return {"message": "Đã đăng xuất."}


@router.post("/change-password")
def change_password(
    body: ChangePassword,
    response: Response,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.old_password, user.password_hash):
        raise AppError(422, "wrong_password", "Mật khẩu hiện tại không đúng.")
    if body.new_password == body.old_password:
        raise AppError(422, "same_password", "Mật khẩu mới phải khác mật khẩu hiện tại.")
    user.password_hash = password_hasher.hash(body.new_password)
    user.must_change_password = False
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    token, csrf, seconds = new_session(db, user)
    cookies(response, token, csrf, seconds)
    audit(db, user, "password_changed", "user", user.id)
    db.commit()
    return {"user": public(user), "csrf_token": csrf}

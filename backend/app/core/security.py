import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import timedelta

from fastapi import Depends, Request
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.db.base import utcnow
from app.db.models import AuthSession, User
from app.db.session import get_db

password_hasher = PasswordHash.recommended()
DUMMY_HASH = password_hasher.hash(secrets.token_urlsafe(24))


def digest(value: str) -> str:
    return hmac.new(
        get_settings().session_secret_key.get_secret_value().encode(), value.encode(), hashlib.sha256
    ).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return password_hasher.verify(password, hashed)
    except Exception:
        return False


def new_session(db: Session, user: User, remember: bool = False):
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    seconds = 7 * 86400 if remember else 8 * 3600
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=digest(token),
            csrf_hash=digest(csrf),
            expires_at=utcnow() + timedelta(seconds=seconds),
        )
    )
    return token, csrf, seconds


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("seal_session", "")
    session = db.scalar(
        select(AuthSession).where(AuthSession.token_hash == digest(token), AuthSession.expires_at > utcnow())
    )
    user = db.get(User, session.user_id) if session else None
    if not user or not user.is_active:
        raise AppError(401, "unauthenticated", "Vui lòng đăng nhập.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        header = request.headers.get("x-csrf-token", "")
        if not header or not hmac.compare_digest(digest(header), session.csrf_hash):
            raise AppError(403, "csrf", "Phiên bảo mật hết hạn. Vui lòng đăng nhập lại.")
    if user.must_change_password and request.url.path not in {
        "/api/v1/auth/me",
        "/api/v1/auth/logout",
        "/api/v1/auth/change-password",
    }:
        raise AppError(403, "password_change_required", "Hãy đổi mật khẩu trước khi sử dụng hệ thống.")
    return user


def editor(user: User = Depends(current_user)) -> User:
    if user.role not in {"admin", "analyst"}:
        raise AppError(403, "forbidden", "Tài khoản chỉ xem không được thay đổi dữ liệu.")
    return user


def admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise AppError(403, "forbidden", "Chỉ quản trị viên được thực hiện thao tác này.")
    return user


class RateLimiter:
    def __init__(self):
        self.entries = defaultdict(deque)
        self.lock = threading.Lock()

    def check(self, key: str, limit: int, period: int):
        with self.lock:
            now = time.monotonic()
            # Keep memory bounded, including under requests from many source addresses.
            if len(self.entries) > 10000:
                self.entries = defaultdict(
                    deque, {k: v for k, v in self.entries.items() if v and v[-1] > now - 3600}
                )
            entries = self.entries[key]
            while entries and entries[0] <= now - period:
                entries.popleft()
            if len(entries) >= limit:
                raise AppError(429, "rate_limited", "Quá nhiều yêu cầu. Vui lòng thử lại sau.")
            entries.append(now)


limiter = RateLimiter()

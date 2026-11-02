import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError

from app.api.v1 import analyses, auth, documents, library, preprocessing, reports, system, users
from app.core.config import get_settings
from app.core.exceptions import AppError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)
logger = logging.getLogger("seal.requests")


@asynccontextmanager
async def lifespan(app):
    settings = get_settings()
    for name in ["uploads", "processed", "reports"]:
        (settings.storage_root / name).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Hệ thống giám định con dấu", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
    expose_headers=["X-Request-ID", "X-Image-Width", "X-Image-Height"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id, started = str(uuid.uuid4()), time.monotonic()
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if origin and origin != get_settings().frontend_origin:
            return JSONResponse(
                {"error": {"code": "origin", "message": "Nguồn truy cập không được phép."}}, status_code=403
            )
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    # Never log query strings, request bodies, credentials, or upstream exceptions.
    logger.info(
        "request_id=%s method=%s path=%s status=%s duration_ms=%d",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        round((time.monotonic() - started) * 1000),
    )
    return response


@app.exception_handler(AppError)
async def app_error(request, exc):
    return JSONResponse({"error": {"code": exc.code, "message": exc.message}}, status_code=exc.status)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Do not echo input values (passwords and file contents) into errors.
    fields = [".".join(str(x) for x in e["loc"]) for e in exc.errors()]
    return JSONResponse(
        {"error": {"code": "validation", "message": "Dữ liệu không hợp lệ: " + ", ".join(fields)}},
        status_code=422,
    )


@app.exception_handler(IntegrityError)
async def integrity_error(request, exc):
    return JSONResponse(
        {"error": {"code": "conflict", "message": "Mã đã tồn tại hoặc dữ liệu liên kết không hợp lệ."}},
        status_code=409,
    )


@app.exception_handler(OperationalError)
async def database_error(request, exc):
    return JSONResponse(
        {
            "error": {
                "code": "database_unavailable",
                "message": "Không kết nối được PostgreSQL. Kiểm tra dịch vụ và migrations.",
            }
        },
        status_code=503,
    )


for router in [
    auth.router,
    library.router,
    users.router,
    documents.router,
    preprocessing.router,
    analyses.router,
    reports.router,
    system.router,
]:
    app.include_router(router, prefix="/api/v1")

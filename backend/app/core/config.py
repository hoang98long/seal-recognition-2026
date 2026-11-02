from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_ROOT / ".env", extra="ignore")
    app_env: str = "development"
    database_url: SecretStr
    session_secret_key: SecretStr
    frontend_origin: str = "http://localhost:5173"
    api_port: int = Field(default=8000, ge=1024, le=65535)
    storage_root: Path = Path("../data")
    openai_api_key: SecretStr = SecretStr("")
    openai_model: str = "gpt-4.1"
    openai_request_timeout_seconds: float = Field(default=90, ge=5, le=600)
    openai_max_compare_candidates: int = Field(default=5, ge=1, le=5)
    openai_max_image_side: int = Field(default=2048, ge=256, le=4096)
    max_upload_mb: int = Field(default=25, ge=1, le=100)
    max_pdf_pages: int = Field(default=100, ge=1, le=300)
    max_image_pixels: int = Field(default=40_000_000, ge=4, le=100_000_000)
    pdf_render_scale: float = Field(default=2, ge=0.5, le=4)

    @field_validator("session_secret_key")
    @classmethod
    def secret_length(cls, value: SecretStr):
        if len(value.get_secret_value()) < 32 or "REPLACE_WITH" in value.get_secret_value():
            raise ValueError("SESSION_SECRET_KEY cần ít nhất 32 ký tự ngẫu nhiên.")
        return value

    @field_validator("storage_root")
    @classmethod
    def absolute_storage(cls, value: Path):
        return (BACKEND_ROOT / value).resolve() if not value.is_absolute() else value.resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()

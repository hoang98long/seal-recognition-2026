from app.core.exceptions import AppError
from app.matching.providers.openai_vision import OpenAIVisionProvider


def get_provider(name="openai_vision"):
    if name == "openai_vision":
        return OpenAIVisionProvider()
    raise AppError(422, "provider_unavailable", "Thuật toán này đang phát triển và chưa được phép chạy.")

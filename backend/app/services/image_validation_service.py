import io
import warnings
from contextlib import closing

import pypdfium2 as pdfium
from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings
from app.core.exceptions import AppError

FORMATS = {
    "PNG": ("image/png", ".png"),
    "JPEG": ("image/jpeg", ".jpg"),
    "TIFF": ("image/tiff", ".tiff"),
    "WEBP": ("image/webp", ".webp"),
}


def validate_bytes(data: bytes):
    settings = get_settings()
    if not data or len(data) > settings.max_upload_mb * 1024 * 1024:
        raise AppError(422, "file_size", f"Tệp rỗng hoặc vượt giới hạn {settings.max_upload_mb} MB.")
    try:
        if data.startswith(b"%PDF-"):
            with pdfium.PdfDocument(data) as doc:
                count = len(doc)
                if not 1 <= count <= settings.max_pdf_pages:
                    raise AppError(422, "page_limit", f"PDF phải có 1–{settings.max_pdf_pages} trang.")
                for i in range(count):
                    with closing(doc[i]) as page:
                        w, h = page.get_size()
                        if w * h * settings.pdf_render_scale**2 > settings.max_image_pixels:
                            raise AppError(422, "pixel_limit", "Trang PDF vượt giới hạn số điểm ảnh.")
                with closing(doc[0]) as page:
                    w, h = page.get_size()
            return {
                "media_type": "application/pdf",
                "extension": ".pdf",
                "width": round(w * settings.pdf_render_scale),
                "height": round(h * settings.pdf_render_scale),
                "page_count": count,
            }
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as img:
                fmt = img.format
                if fmt not in FORMATS:
                    raise AppError(422, "unsupported_file", "Chỉ chấp nhận PDF, PNG, JPEG, TIFF và WEBP.")
                frames = getattr(img, "n_frames", 1)
                if frames > settings.max_pdf_pages:
                    raise AppError(422, "page_limit", "Tệp có quá nhiều khung ảnh.")
                size = img.size
                for i in range(frames):
                    img.seek(i)
                    if img.width * img.height > settings.max_image_pixels:
                        raise AppError(422, "pixel_limit", "Ảnh vượt giới hạn số điểm ảnh.")
                    img.load()
        media, ext = FORMATS[fmt]
        return {
            "media_type": media,
            "extension": ext,
            "width": size[0],
            "height": size[1],
            "page_count": frames,
        }
    except AppError:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        pdfium.PdfiumError,
    ):
        raise AppError(
            422, "invalid_file", "Tệp ảnh/PDF bị hỏng, được mã hóa hoặc có định dạng không hợp lệ."
        ) from None

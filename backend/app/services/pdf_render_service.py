import io
import threading
from contextlib import closing

import pypdfium2 as pdfium
from PIL import Image, ImageOps

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.services.storage_service import asset_path

# PDFium is not thread safe; serialize every PDFium operation in this process.
PDF_LOCK = threading.RLock()


def load_page(asset, page=1):
    if not 1 <= page <= asset.page_count:
        raise AppError(422, "invalid_page", "Số trang/khung ảnh không hợp lệ.")
    path = asset_path(asset)
    if asset.media_type == "application/pdf":
        with PDF_LOCK, pdfium.PdfDocument(path) as doc, closing(doc[page - 1]) as pdf_page:
            bitmap = pdf_page.render(scale=get_settings().pdf_render_scale)
            try:
                return bitmap.to_pil().convert("RGB").copy()
            finally:
                bitmap.close()
    with Image.open(path) as image:
        image.seek(page - 1)
        image = ImageOps.exif_transpose(image)
        # Composite transparency onto white before color processing.
        rgba = image.convert("RGBA")
        bg = Image.new("RGBA", rgba.size, "white")
        return Image.alpha_composite(bg, rgba).convert("RGB")


def png_bytes(image):
    stream = io.BytesIO()
    image.save(stream, format="PNG")
    return stream.getvalue()

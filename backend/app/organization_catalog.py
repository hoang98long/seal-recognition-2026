"""User-requested organization catalog; does not contain seal images or AI results."""

from sqlalchemy import select

from app.db.models import Organization

CATALOG = [
    ("VPCP", "Văn phòng Chính phủ"),
    ("TTCP", "Thủ tướng Chính phủ"),
    ("BCA", "Bộ Công an"),
    ("BQP", "Bộ Quốc phòng"),
]


def sync_catalog(db, user_id):
    created = []
    for code, name in CATALOG:
        item = db.scalar(select(Organization).where(Organization.code == code))
        if not item:
            item = db.scalar(
                select(Organization).where(Organization.name == name, Organization.status != "deleted")
            )
            if item and not item.code:
                item.code = code
            elif not item:
                item = Organization(code=code, short_name=code, name=name, created_by=user_id)
                db.add(item)
                created.append(code)
    db.flush()
    return created

import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Login(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=256)
    remember: bool = False


class ChangePassword(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    old_password: str = Field(max_length=256)
    new_password: str = Field(min_length=10, max_length=256)


class UserCreate(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    username: str = Field(pattern=r"^[a-zA-Z0-9_.-]{3,80}$")
    full_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=10, max_length=256)
    role: Literal["admin", "analyst", "viewer"] = "analyst"


class UserUpdate(StrictModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    role: Literal["admin", "analyst", "viewer"] | None = None
    is_active: bool | None = None


class OrganizationIn(StrictModel):
    name: str = Field(min_length=1, max_length=500)
    code: str | None = Field(default=None, max_length=80)
    short_name: str | None = Field(default=None, max_length=200)
    parent_organization_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=5000)
    address: str | None = Field(default=None, max_length=1000)
    status: Literal["active", "inactive", "deleted"] = "active"


class DesignIn(StrictModel):
    organization_id: uuid.UUID
    name: str = Field(min_length=1, max_length=500)
    design_code: str | None = Field(default=None, max_length=80)
    seal_type: Literal["round", "rectangular", "other"] = "round"
    description: str | None = Field(default=None, max_length=5000)
    issued_at: date | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    status: Literal["active", "inactive", "deleted"] = "active"
    reference_notes: str | None = Field(default=None, max_length=5000)


class DeviceIn(StrictModel):
    seal_design_id: uuid.UUID
    internal_device_code: str | None = Field(default=None, max_length=80)
    inventory_note: str | None = Field(default=None, max_length=5000)
    active_from: date | None = None
    active_to: date | None = None
    source_confidence: Literal["unknown", "documented", "verified"] = "unknown"
    provenance_note: str | None = Field(default=None, max_length=5000)
    status: Literal["active", "inactive", "deleted"] = "active"


class ImpressionIn(StrictModel):
    seal_design_id: uuid.UUID
    image_asset_id: uuid.UUID
    seal_device_id: uuid.UUID | None = None
    source_document_id: uuid.UUID | None = None
    source_page: int | None = Field(default=None, ge=1)
    is_reference: bool = True
    capture_method: Literal["scan", "photo", "uploaded", "digital", "unknown"] = "unknown"
    image_quality_note: str | None = Field(default=None, max_length=5000)
    observed_color: str | None = Field(default=None, max_length=80)
    verification_status: Literal["unverified", "verified", "reference_only"] = "reference_only"
    note: str | None = Field(default=None, max_length=5000)
    status: Literal["active", "inactive", "deleted"] = "active"


class ReferenceIntakeIn(StrictModel):
    source_document_id: uuid.UUID | None = None
    source_page: int | None = Field(default=None, ge=1)
    image_asset_id: uuid.UUID
    organization_id: uuid.UUID | None = None
    organization_name: str | None = Field(default=None, min_length=1, max_length=500)
    seal_design_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=500)
    seal_type: Literal["round", "rectangular", "other"] = "other"
    note: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def one_organization(self):
        if bool(self.organization_id) == bool(self.organization_name):
            raise ValueError("Chọn tổ chức có sẵn hoặc nhập tên tổ chức mới.")
        if self.seal_design_id and not self.organization_id:
            raise ValueError("Mẫu có sẵn cần thuộc một tổ chức có sẵn.")
        return self


class DocumentIn(StrictModel):
    organization_id: uuid.UUID | None = None
    file_asset_id: uuid.UUID
    display_name: str = Field(min_length=1, max_length=500)
    document_no: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=5000)
    tags: list[str] = Field(default_factory=list, max_length=30)


class ReferenceUpdateIn(StrictModel):
    name: str = Field(min_length=1, max_length=500)
    note: str | None = Field(default=None, max_length=5000)
    image_asset_id: uuid.UUID | None = None


class ROI(StrictModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(ge=2)
    height: int = Field(ge=2)


class Parameters(StrictModel):
    rotation: float = Field(default=0, ge=-180, le=180)
    brightness: float = Field(default=0, ge=-100, le=100)
    contrast: float = Field(default=1, ge=0.1, le=3)
    gamma: float = Field(default=1, ge=0.1, le=3)
    saturation: float = Field(default=1, ge=0, le=3)
    sharpen: float = Field(default=0, ge=0, le=3)
    denoise: int = Field(default=0, ge=0, le=10)
    grayscale: bool = False
    threshold_mode: Literal["off", "otsu", "adaptive", "manual"] = "off"
    threshold_value: int = Field(default=127, ge=0, le=255)
    red_mask: bool = False
    hue_width: int = Field(default=15, ge=0, le=45)
    saturation_min: int = Field(default=60, ge=0, le=255)
    value_min: int = Field(default=40, ge=0, le=255)
    morphology: Literal["none", "open", "close"] = "none"
    kernel_size: int = Field(default=3, ge=1, le=9)
    invert: bool = False
    background: Literal["none", "white", "transparent", "overlay"] = "none"
    apply_mask: bool = True


class PreprocessIn(StrictModel):
    organization_id: uuid.UUID | None = None
    output_name: str | None = Field(default=None, min_length=1, max_length=200)
    source_asset_id: uuid.UUID
    page: int = Field(default=1, ge=1)
    roi: ROI
    parameters: Parameters = Field(default_factory=Parameters)
    profile_id: uuid.UUID | None = None
    roi_confirmed: bool = False
    allow_full_page: bool = False


class ProfileIn(StrictModel):
    organization_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    parameters: Parameters
    is_default: bool = False


class AssetNameIn(StrictModel):
    display_name: str = Field(min_length=1, max_length=250)


class OrganizationLinkIn(StrictModel):
    organization_id: uuid.UUID | None


class LibrarySearchIn(StrictModel):
    query_asset_id: uuid.UUID
    consent: bool
    expected_reference_count: int = Field(ge=1)
    title: str = Field(default="Tra cứu con dấu theo tổ chức", min_length=1, max_length=250)


class SearchResumeIn(StrictModel):
    consent: bool


class CandidateIn(StrictModel):
    reference_asset_id: uuid.UUID
    reference_impression_id: uuid.UUID | None = None


class AnalysisIn(StrictModel):
    title: str = Field(min_length=1, max_length=250)
    mode: Literal["pairwise", "library"] = "pairwise"
    query_asset_id: uuid.UUID
    source_document_id: uuid.UUID | None = None
    candidates: list[CandidateIn] = Field(min_length=1, max_length=5)
    processing_notes: str | None = Field(default=None, max_length=5000)


class CompareIn(StrictModel):
    consent: bool
    query_asset_id: uuid.UUID | None = None
    candidates: list[CandidateIn] | None = Field(default=None, min_length=1, max_length=5)


class NormalizedRect(StrictModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)

    @model_validator(mode="after")
    def in_bounds(self):
        if self.x + self.width > 1.000001 or self.y + self.height > 1.000001:
            raise ValueError("Vùng đánh dấu nằm ngoài ảnh.")
        return self


class AnnotationIn(StrictModel):
    label: Literal["similar", "different", "uncertain", "user_note"]
    image_role: Literal["Q", "K"]
    geometry: NormalizedRect
    note: str = Field(default="", max_length=3000)

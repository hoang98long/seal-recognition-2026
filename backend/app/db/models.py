import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Identity, Timestamps


class User(Identity, Timestamps, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('admin','analyst','viewer')", name="role"),)
    username: Mapped[str] = mapped_column(String(80), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    full_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default="analyst")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthSession(Identity, Base):
    __tablename__ = "auth_sessions"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Organization(Identity, Timestamps, Base):
    __tablename__ = "organizations"
    code: Mapped[str | None] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(Text)
    short_name: Mapped[str | None] = mapped_column(String(200))
    parent_organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id"))
    description: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class SealDesign(Identity, Timestamps, Base):
    __tablename__ = "seal_designs"
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(Text)
    design_code: Mapped[str | None] = mapped_column(String(80), unique=True)
    seal_type: Mapped[str] = mapped_column(String(30), default="round")
    description: Mapped[str | None] = mapped_column(Text)
    issued_at: Mapped[date | None] = mapped_column(Date)
    valid_from: Mapped[date | None] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)
    reference_notes: Mapped[str | None] = mapped_column(Text)


class SealDevice(Identity, Timestamps, Base):
    __tablename__ = "seal_devices"
    seal_design_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("seal_designs.id"), index=True)
    internal_device_code: Mapped[str | None] = mapped_column(String(80), unique=True)
    inventory_note: Mapped[str | None] = mapped_column(Text)
    active_from: Mapped[date | None] = mapped_column(Date)
    active_to: Mapped[date | None] = mapped_column(Date)
    source_confidence: Mapped[str] = mapped_column(String(30), default="unknown")
    provenance_note: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="active")


class FileAsset(Identity, Base):
    __tablename__ = "file_assets"
    # Deduplication only within one owner; identical bytes never grant another user access.
    kind: Mapped[str] = mapped_column(String(40), index=True)
    original_filename: Mapped[str] = mapped_column(String(250))
    display_name: Mapped[str | None] = mapped_column(String(250))
    media_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    relative_storage_path: Mapped[str] = mapped_column(Text, unique=True)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    page_count: Mapped[int] = mapped_column(Integer, default=1)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    source_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)


class SourceDocument(Identity, Base):
    __tablename__ = "source_documents"
    file_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("file_assets.id"), unique=True)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    display_name: Mapped[str] = mapped_column(Text)
    document_no: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    page_count: Mapped[int] = mapped_column(Integer)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    tags: Mapped[list] = mapped_column(JSONB, default=list)


class SealImpression(Identity, Timestamps, Base):
    __tablename__ = "seal_impressions"
    seal_design_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("seal_designs.id"), index=True)
    seal_device_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("seal_devices.id"))
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), index=True)
    image_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("file_assets.id"), index=True)
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("source_documents.id"))
    source_page: Mapped[int | None] = mapped_column(Integer)
    is_reference: Mapped[bool] = mapped_column(Boolean, default=True)
    capture_method: Mapped[str] = mapped_column(String(30), default="unknown")
    image_quality_note: Mapped[str | None] = mapped_column(Text)
    observed_color: Mapped[str | None] = mapped_column(String(80))
    verification_status: Mapped[str] = mapped_column(String(30), default="reference_only")
    note: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class PreprocessingProfile(Identity, Timestamps, Base):
    __tablename__ = "preprocessing_profiles"
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    parameters: Mapped[dict] = mapped_column(JSONB)
    version: Mapped[int] = mapped_column(Integer, default=1)


class PreprocessingRun(Identity, Base):
    __tablename__ = "preprocessing_runs"
    source_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("file_assets.id"), index=True)
    output_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("file_assets.id"), index=True)
    profile_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("preprocessing_profiles.id"))
    source_page: Mapped[int] = mapped_column(Integer, default=1)
    roi_geometry: Mapped[dict] = mapped_column(JSONB)
    parameters: Mapped[dict] = mapped_column(JSONB)
    pipeline_version: Mapped[str] = mapped_column(String(50))
    initiated_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class AnalysisSession(Identity, Timestamps, Base):
    __tablename__ = "analysis_sessions"
    title: Mapped[str] = mapped_column(String(250))
    mode: Mapped[str] = mapped_column(String(20))
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("source_documents.id"))
    query_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("file_assets.id"))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processing_notes: Mapped[str | None] = mapped_column(Text)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_provider: Mapped[str | None] = mapped_column(String(40))


class AnalysisCandidate(Identity, Base):
    __tablename__ = "analysis_candidates"
    analysis_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analysis_sessions.id"), index=True)
    reference_impression_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("seal_impressions.id"))
    reference_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("file_assets.id"))
    selection_method: Mapped[str] = mapped_column(String(30))
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=True)


class AnalysisResult(Identity, Base):
    __tablename__ = "analysis_results"
    __table_args__ = (CheckConstraint("visual_similarity_score BETWEEN 0 AND 100", name="score_range"),)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analysis_sessions.id"), index=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analysis_candidates.id"), index=True)
    provider: Mapped[str] = mapped_column(String(40), index=True)
    model_name: Mapped[str] = mapped_column(String(120), index=True)
    provider_version: Mapped[str] = mapped_column(String(40))
    prompt_version: Mapped[str] = mapped_column(String(50))
    result_status: Mapped[str] = mapped_column(String(30))
    visual_similarity_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    verdict: Mapped[str] = mapped_column(String(40))
    confidence_label: Mapped[str | None] = mapped_column(String(20))
    structured_result: Mapped[dict] = mapped_column(JSONB, default=dict)
    narrative: Mapped[str | None] = mapped_column(Text)
    quality_flags: Mapped[list] = mapped_column(JSONB, default=list)
    request_id_provider: Mapped[str | None] = mapped_column(String(200))
    token_usage: Mapped[dict | None] = mapped_column(JSONB)
    estimated_cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    error_code: Mapped[str | None] = mapped_column(String(80))
    error_summary: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    is_uncalibrated: Mapped[bool] = mapped_column(Boolean, default=True)
    input_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)


class AnnotationRegion(Identity, Base):
    __tablename__ = "annotation_regions"
    analysis_result_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analysis_results.id"), index=True)
    label: Mapped[str] = mapped_column(String(30))
    geometry: Mapped[dict] = mapped_column(JSONB)
    image_role: Mapped[str] = mapped_column(String(1))
    source: Mapped[str] = mapped_column(String(20), default="user")
    note: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class AuditLog(Identity, Base):
    __tablename__ = "audit_logs"
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[uuid.UUID | None]
    sanitized_details: Mapped[dict] = mapped_column(JSONB, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(80))

"""KYC/Compliance models for identity verification."""

from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class KycStatus(str, PyEnum):
    """Status of a KYC verification request."""

    UNVERIFIED = "unverified"  # No documents submitted yet
    PENDING = "pending"        # Documents submitted, awaiting review
    VERIFIED = "verified"      # Approved by admin
    REJECTED = "rejected"      # Rejected by admin


class DocumentType(str, PyEnum):
    """Accepted identity document types."""

    PASSPORT = "passport"
    NATIONAL_ID = "national_id"
    DRIVERS_LICENSE = "drivers_license"


class KycVerification(Base, TimestampMixin):
    """Identity verification record for a user."""

    __tablename__ = "kyc_verifications"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, nullable=False, index=True
    )
    status: Mapped[KycStatus] = mapped_column(
        String(20), default=KycStatus.UNVERIFIED, nullable=False
    )

    # Identity document
    document_type: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True
    )
    document_number: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )
    document_front_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )
    document_back_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )

    # Selfie / liveness check
    selfie_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )

    # Personal information
    full_name: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True
    )
    date_of_birth: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True  # YYYY-MM-DD
    )
    nationality: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )
    address: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )

    # Admin review
    rejection_reason: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    user = relationship("User", backref="kyc_verification", uselist=False)

    def __repr__(self) -> str:
        return f"<KycVerification {self.user_id}: {self.status.value}>"

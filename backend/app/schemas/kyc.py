"""KYC/Compliance schemas for identity verification."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class KycSubmitRequest(BaseModel):
    """Submit KYC verification documents."""

    document_type: str = Field(..., pattern=r"^(passport|national_id|drivers_license)$")
    document_number: str = Field(..., min_length=3, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=200)
    date_of_birth: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    nationality: str = Field(..., min_length=2, max_length=100)
    address: str = Field(..., min_length=5, max_length=500)


class KycStatusResponse(BaseModel):
    """Current KYC verification status."""

    id: str
    status: str
    document_type: Optional[str] = None
    full_name: Optional[str] = None
    rejection_reason: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class KycAdminListItem(BaseModel):
    """KYC verification record for admin review list."""

    id: str
    user_id: str
    user_email: str
    user_username: str
    status: str
    document_type: Optional[str] = None
    full_name: Optional[str] = None
    nationality: Optional[str] = None
    submitted_at: Optional[datetime] = None


class KycAdminDetail(BaseModel):
    """Detailed KYC record for admin review."""

    id: str
    user_id: str
    user_email: str
    user_username: str
    status: str
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    document_front_url: Optional[str] = None
    document_back_url: Optional[str] = None
    selfie_url: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    nationality: Optional[str] = None
    address: Optional[str] = None
    rejection_reason: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None

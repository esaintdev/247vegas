"""KYC/Compliance API endpoints.

Covers user flows:
- Submit identity documents
- Check verification status
- Upload document images

Admin flows:
- List pending verifications
- View detailed KYC record
- Approve or reject verification
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, get_session, require_admin, require_permission
from app.core.config import settings
from app.models.user import User
from app.models.kyc import KycVerification, KycStatus, DocumentType
from app.services.audit import log_admin_action
from app.schemas.kyc import (
    KycAdminDetail,
    KycAdminListItem,
    KycStatusResponse,
    KycSubmitRequest,
)

router = APIRouter(prefix="/kyc", tags=["KYC"])

UPLOAD_DIR = settings.BASE_DIR / "uploads" / "kyc"


# ── User Endpoints ──────────────────────────────────────────────────


@router.get("/status", response_model=KycStatusResponse)
async def get_kyc_status(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get the current user's KYC verification status."""
    result = await session.execute(
        select(KycVerification).where(KycVerification.user_id == user.id)
    )
    kyc = result.scalar_one_or_none()

    if not kyc:
        # Return default unverified status
        return KycStatusResponse(
            id="",
            status=KycStatus.UNVERIFIED.value,
        )

    return kyc


@router.post("/submit", response_model=KycStatusResponse,
             status_code=status.HTTP_201_CREATED)
async def submit_kyc(
    payload: KycSubmitRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Submit KYC documents for verification."""
    # Check if already submitted or verified
    result = await session.execute(
        select(KycVerification).where(KycVerification.user_id == user.id)
    )
    existing = result.scalar_one_or_none()

    if existing and existing.status == KycStatus.VERIFIED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identity already verified",
        )
    if existing and existing.status == KycStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification already pending review",
        )

    now = datetime.now(timezone.utc)

    if existing:
        # Update existing record (re-submit after rejection)
        existing.status = KycStatus.PENDING
        existing.document_type = payload.document_type
        existing.document_number = payload.document_number
        existing.full_name = payload.full_name
        existing.date_of_birth = payload.date_of_birth
        existing.nationality = payload.nationality
        existing.address = payload.address
        existing.rejection_reason = None
        existing.submitted_at = now
        existing.reviewed_at = None
        existing.reviewed_by = None
        kyc = existing
    else:
        # Create new verification record
        kyc = KycVerification(
            user_id=user.id,
            status=KycStatus.PENDING,
            document_type=payload.document_type,
            document_number=payload.document_number,
            full_name=payload.full_name,
            date_of_birth=payload.date_of_birth,
            nationality=payload.nationality,
            address=payload.address,
            submitted_at=now,
        )
        session.add(kyc)

    await session.flush()
    return kyc


@router.post("/upload/{field}")
async def upload_document(
    field: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Upload a KYC document image (front, back, or selfie).

    Args:
        field: One of 'front', 'back', 'selfie'
        file: Image file (jpg, png, pdf) up to 10MB
    """
    valid_fields = {"front": "document_front_url",
                    "back": "document_back_url",
                    "selfie": "selfie_url"}
    if field not in valid_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid field. Must be one of: {', '.join(valid_fields)}",
        )

    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/jpg", "application/pdf"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: JPEG, PNG, PDF",
        )

    # Validate file size (10MB max)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum 10MB",
        )

    # Find or create KYC record
    result = await session.execute(
        select(KycVerification).where(KycVerification.user_id == user.id)
    )
    kyc = result.scalar_one_or_none()
    if not kyc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submit KYC details before uploading documents",
        )

    # Save file
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{user.id}_{field}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{file_ext}"
    filepath = UPLOAD_DIR / filename

    with open(filepath, "wb") as f:
        f.write(contents)

    # Update KYC record
    field_name = valid_fields[field]
    setattr(kyc, field_name, str(filepath))
    await session.flush()

    return {"url": str(filepath), "filename": filename}


# ── Admin Endpoints ─────────────────────────────────────────────────


@router.get("/admin/pending", response_model=List[KycAdminListItem])
async def list_pending_kyc(
    status_filter: Optional[str] = None,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:kyc")),
    session: AsyncSession = Depends(get_session),
):
    """List all KYC verifications (filtered by status)."""
    query = (
        select(KycVerification, User.email, User.username)
        .join(User, KycVerification.user_id == User.id)
    )

    if status_filter:
        query = query.where(KycVerification.status == status_filter)
    else:
        query = query.where(KycVerification.status == KycStatus.PENDING)

    query = query.order_by(KycVerification.submitted_at.desc().nullslast())
    result = await session.execute(query)
    rows = result.all()

    return [
        KycAdminListItem(
            id=row.KycVerification.id,
            user_id=row.KycVerification.user_id,
            user_email=row.email,
            user_username=row.username,
            status=row.KycVerification.status.value,
            document_type=row.KycVerification.document_type,
            full_name=row.KycVerification.full_name,
            nationality=row.KycVerification.nationality,
            submitted_at=row.KycVerification.submitted_at,
        )
        for row in rows
    ]


@router.get("/admin/{kyc_id}", response_model=KycAdminDetail)
async def get_kyc_detail(
    kyc_id: str,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:kyc")),
    session: AsyncSession = Depends(get_session),
):
    """Get detailed KYC record for admin review."""
    result = await session.execute(
        select(KycVerification, User.email, User.username)
        .join(User, KycVerification.user_id == User.id)
        .where(KycVerification.id == kyc_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="KYC record not found")

    kyc = row.KycVerification
    return KycAdminDetail(
        id=kyc.id,
        user_id=kyc.user_id,
        user_email=row.email,
        user_username=row.username,
        status=kyc.status.value,
        document_type=kyc.document_type,
        document_number=kyc.document_number,
        document_front_url=kyc.document_front_url,
        document_back_url=kyc.document_back_url,
        selfie_url=kyc.selfie_url,
        full_name=kyc.full_name,
        date_of_birth=kyc.date_of_birth,
        nationality=kyc.nationality,
        address=kyc.address,
        rejection_reason=kyc.rejection_reason,
        submitted_at=kyc.submitted_at,
        reviewed_at=kyc.reviewed_at,
    )


@router.post("/admin/{kyc_id}/approve")
async def approve_kyc(
    kyc_id: str,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:kyc")),
    session: AsyncSession = Depends(get_session),
):
    """Approve a pending KYC verification."""
    result = await session.execute(
        select(KycVerification).where(KycVerification.id == kyc_id).with_for_update()
    )
    kyc = result.scalar_one_or_none()
    if not kyc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="KYC record not found")
    if kyc.status != KycStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"KYC is {kyc.status.value}, not pending")

    kyc.status = KycStatus.VERIFIED
    kyc.reviewed_at = datetime.now(timezone.utc)
    kyc.reviewed_by = admin.id

    # Also mark user as verified
    user_result = await session.execute(
        select(User).where(User.id == kyc.user_id)
    )
    user = user_result.scalar_one_or_none()
    if user:
        user.is_verified = True

    await log_admin_action(
        session, admin, "approve_kyc",
        target_type="kyc", target_id=kyc_id,
        details={"user_id": kyc.user_id},
    )
    await session.flush()
    return {"status": "ok", "message": "Identity verified successfully"}


@router.post("/admin/{kyc_id}/reject")
async def reject_kyc(
    kyc_id: str,
    reason: str,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:kyc")),
    session: AsyncSession = Depends(get_session),
):
    """Reject a pending KYC verification with a reason."""
    result = await session.execute(
        select(KycVerification).where(KycVerification.id == kyc_id).with_for_update()
    )
    kyc = result.scalar_one_or_none()
    if not kyc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="KYC record not found")
    if kyc.status != KycStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"KYC is {kyc.status.value}, not pending")

    kyc.status = KycStatus.REJECTED
    kyc.rejection_reason = reason
    kyc.reviewed_at = datetime.now(timezone.utc)
    kyc.reviewed_by = admin.id

    await log_admin_action(
        session, admin, "reject_kyc",
        target_type="kyc", target_id=kyc_id,
        details={"user_id": kyc.user_id, "reason": reason},
    )
    await session.flush()
    return {"status": "ok", "message": "Identity verification rejected"}

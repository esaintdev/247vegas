"""Audit logging service — tracks every admin action for compliance."""

from __future__ import annotations

import json
from typing import Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User
from pydantic import BaseModel


class AuditLogEntryResponse(BaseModel):
    id: str
    admin_id: str
    admin_username: str
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: str


async def log_admin_action(
    session: AsyncSession,
    admin: User,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Record an admin action in the audit log."""
    entry = AuditLog(
        admin_id=admin.id,
        admin_username=admin.username,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=json.dumps(details) if details else None,
        ip_address=ip_address,
    )
    session.add(entry)
    await session.flush()
    return entry


async def get_audit_logs(
    session: AsyncSession,
    limit: int = 50,
    offset: int = 0,
    action_filter: Optional[str] = None,
    admin_id_filter: Optional[str] = None,
) -> list[AuditLogEntryResponse]:
    """Fetch audit log entries with optional filters."""
    query = select(AuditLog).order_by(AuditLog.timestamp.desc())

    if action_filter:
        query = query.where(AuditLog.action == action_filter)
    if admin_id_filter:
        query = query.where(AuditLog.admin_id == admin_id_filter)

    query = query.offset(offset).limit(limit)
    result = await session.execute(query)
    entries = result.scalars().all()

    return [
        AuditLogEntryResponse(
            id=e.id,
            admin_id=e.admin_id,
            admin_username=e.admin_username,
            action=e.action,
            target_type=e.target_type,
            target_id=e.target_id,
            details=e.details,
            ip_address=e.ip_address,
            timestamp=e.timestamp.isoformat(),
        )
        for e in entries
    ]

"""Health-check endpoint for monitoring and load balancers."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Return a simple health-check response."""
    return {"status": "ok", "service": "casino-platform"}

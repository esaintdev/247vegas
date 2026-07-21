"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.api.v1.router import router as api_v1_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Handle application startup/shutdown lifecycle."""
    # Startup: database connection pool is created on first use
    # Redis connection can be initialised here
    yield
    # Shutdown: database engine will be disposed
    from app.core.database import engine
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS & Security Middleware ───────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],  # TODO: Restrict to specific domains in production via settings
)


@app.middleware("http")
async def maintenance_mode_middleware(request: Request, call_next: AsyncGenerator):
    """Block non-admin requests when maintenance mode is enabled."""
    path = request.url.path

    # Always allow: health, docs, auth/login/register, webhooks, admin, announcements
    allowed_prefixes = (
        "/health", "/docs", "/redoc", "/openapi.json",
        "/api/v1/auth/", "/api/v1/webhooks/",
        "/api/v1/admin/",
        "/api/v1/settings/announcement",
    )
    if any(path.startswith(p) for p in allowed_prefixes):
        return await call_next(request)

    # Check maintenance mode from DB
    try:
        from app.core.database import async_session_factory
        from app.models.platform_settings import PlatformSettings

        async with async_session_factory() as session:
            result = await session.execute(select(PlatformSettings))
            settings_row = result.scalar_one_or_none()
            if settings_row and settings_row.maintenance_mode:
                return JSONResponse(
                    status_code=503,
                    content={
                        "detail": "maintenance",
                        "message": settings_row.maintenance_message
                                   or "We are currently undergoing maintenance. Please check back shortly.",
                    },
                )
    except Exception:
        pass  # If DB check fails, allow the request through

    return await call_next(request)


# ── Routers ─────────────────────────────────────────────────────────
app.include_router(api_v1_router)


@app.get("/")
async def root() -> dict:
    """Root endpoint — API information."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }

"""Top-level router that aggregates all v1 endpoint routers."""

from fastapi import APIRouter

from app.api.v1.endpoints import admin, analytics, auth, baccarat, blackjack, bonus_admin, crash, health, kyc, notifications, poker, roulette, settings_admin, slots, wallet, webhooks

router = APIRouter(prefix="/api/v1")

router.include_router(health.router)
router.include_router(auth.router)
router.include_router(wallet.router)
router.include_router(blackjack.router)
router.include_router(roulette.router)
router.include_router(slots.router)
router.include_router(crash.router)
router.include_router(baccarat.router)
router.include_router(poker.router)
router.include_router(admin.router)
router.include_router(kyc.router)
router.include_router(notifications.router)
router.include_router(bonus_admin.router)
router.include_router(settings_admin.router)
router.include_router(settings_admin.public_router)
router.include_router(analytics.router)
router.include_router(webhooks.router)

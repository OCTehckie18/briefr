"""
Briefr Meeting Bot Scheduler
------------------------------
Uses APScheduler to poll the meetings collection every 60 seconds for upcoming
or recently missed bot-enabled meetings and dispatches them to the Node.js bot
microservice.

A meeting is dispatched when:
  - meetingLink is set (non-null)
  - scheduledAt is within the next 5 minutes or the recent overdue grace window
  - botStatus is "pending" (not yet picked up)
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.db import meetings_col, users_col
from app.services.auth import create_access_token

log = logging.getLogger(__name__)

LOOKAHEAD_MINUTES = 5  # Dispatch bot this many minutes before scheduledAt

_scheduler: AsyncIOScheduler | None = None


async def _poll_and_dispatch():
    """Check for meetings due within the next LOOKAHEAD_MINUTES and launch the bot."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=settings.BOT_LOOKBACK_MINUTES)
    window_end = now + timedelta(minutes=LOOKAHEAD_MINUTES)

    query = {
        "meetingLink": {"$ne": None, "$exists": True},
        "scheduledAt": {"$gte": window_start, "$lte": window_end},
        "botStatus": "pending",
    }

    async for meeting in meetings_col.find(query):
        meeting_id = str(meeting["_id"])
        meeting_url = meeting["meetingLink"]
        scheduled_at = meeting.get("scheduledAt")
        meeting_date = (
            scheduled_at.strftime("%Y-%m-%d")
            if scheduled_at
            else now.strftime("%Y-%m-%d")
        )

        log.info(f"[Scheduler] Dispatching bot for meeting {meeting_id} at {meeting_url}")

        # The bot calls authenticated backend endpoints when it updates status
        # and submits the final transcript. Mint a token for an existing admin
        # user instead of starting the bot with an empty Authorization header.
        admin = await users_col.find_one({"role": "admin"})
        if not admin:
            log.error("[Scheduler] Cannot start bot: no admin user exists")
            await meetings_col.update_one(
                {"_id": meeting["_id"]},
                {"$set": {"botStatus": "failed"}},
            )
            continue

        backend_token = create_access_token(
            str(admin["_id"]),
            admin.get("role", "admin"),
            expires_minutes=settings.BOT_TOKEN_TTL_MINUTES,
        )

        # Mark as joining immediately to prevent duplicate dispatches
        await meetings_col.update_one(
            {"_id": meeting["_id"]},
            {"$set": {"botStatus": "joining"}},
        )

        try:
            # Get a fresh admin token from the settings for the bot callback
            # The bot will use this token when calling /api/bot/transcript-ready
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{settings.BOT_SERVICE_URL}/start-bot",
                    json={
                        "meetingUrl": meeting_url,
                        "meetingId": meeting_id,
                        "meetingDate": meeting_date,
                        "backendUrl": settings.BACKEND_SERVICE_URL,
                        "backendToken": backend_token,
                    },
                )
                if resp.status_code < 300:
                    log.info(f"[Scheduler] Bot started for {meeting_id}")
                else:
                    log.error(
                        f"[Scheduler] Bot service error for {meeting_id}: "
                        f"HTTP {resp.status_code} — {resp.text}"
                    )
                    # Revert status so it can be retried
                    await meetings_col.update_one(
                        {"_id": meeting["_id"]},
                        {"$set": {"botStatus": "pending"}},
                    )

        except httpx.ConnectError:
            log.error(
                f"[Scheduler] Bot service not reachable at {settings.BOT_SERVICE_URL}. "
                f"Is 'node bot/server.js' running?"
            )
            await meetings_col.update_one(
                {"_id": meeting["_id"]},
                {"$set": {"botStatus": "failed"}},
            )
        except Exception as e:
            log.error(f"[Scheduler] Unexpected error dispatching {meeting_id}: {e}")
            await meetings_col.update_one(
                {"_id": meeting["_id"]},
                {"$set": {"botStatus": "failed"}},
            )


def start_scheduler():
    """Create and start the APScheduler. Called once during app lifespan startup."""
    global _scheduler
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _poll_and_dispatch,
        trigger="interval",
        seconds=60,
        id="meeting_bot_poll",
        replace_existing=True,
    )
    _scheduler.start()
    log.info("[Scheduler] Meeting bot scheduler started (60s interval).")


def stop_scheduler():
    """Gracefully shut down the scheduler. Called during app lifespan shutdown."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("[Scheduler] Meeting bot scheduler stopped.")

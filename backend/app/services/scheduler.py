"""
Briefr Meeting Bot Scheduler
------------------------------
Uses APScheduler to poll the meetings collection every 60 seconds for upcoming
bot-enabled meetings and dispatches them to the Node.js bot microservice.

A meeting is dispatched when:
  - meetingLink is set (non-null)
  - scheduledAt is within the next 5 minutes
  - botStatus is "pending" (not yet picked up)
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.db import meetings_col

log = logging.getLogger(__name__)

BOT_SERVICE_URL = "http://localhost:3001"
LOOKAHEAD_MINUTES = 5  # Dispatch bot this many minutes before scheduledAt

_scheduler: AsyncIOScheduler | None = None


async def _poll_and_dispatch():
    """Check for meetings due within the next LOOKAHEAD_MINUTES and launch the bot."""
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(minutes=LOOKAHEAD_MINUTES)

    query = {
        "meetingLink": {"$ne": None, "$exists": True},
        "scheduledAt": {"$gte": now, "$lte": window_end},
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
                    f"{BOT_SERVICE_URL}/start-bot",
                    json={
                        "meetingUrl": meeting_url,
                        "meetingId": meeting_id,
                        "meetingDate": meeting_date,
                        "backendUrl": f"http://localhost:8000",
                        "backendToken": "",  # Bot uses internal auth; update if needed
                    },
                )
                if resp.status_code == 200:
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
                f"[Scheduler] Bot service not reachable at {BOT_SERVICE_URL}. "
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

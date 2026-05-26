"""
Web Push notifications.
Uses VAPID keys to send push to subscribed browsers.
Alerts: threat detected, low battery, link loss, mission complete.
"""
import json
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.models.user import User

logger = structlog.get_logger()
router = APIRouter()

# In-memory subscription store (use Redis in production)
_subscriptions: dict[str, list[dict]] = {}  # user_id → list of push subscriptions


class PushSubscription(BaseModel):
    endpoint:    str
    keys:        dict   # {p256dh, auth}
    user_agent:  str = ""


class PushPayload(BaseModel):
    title:  str
    body:   str
    icon:   str = "/icon-192.png"
    badge:  str = "/icon-72.png"
    tag:    str = "skyforge-alert"
    data:   dict = {}


@router.post("/subscribe")
async def subscribe(
    payload:      PushSubscription,
    current_user: User = Depends(get_current_user),
):
    """Register browser push subscription for the current user."""
    uid   = current_user.id
    subs  = _subscriptions.setdefault(uid, [])
    # Dedup by endpoint
    existing = next((s for s in subs if s["endpoint"] == payload.endpoint), None)
    if not existing:
        subs.append(payload.model_dump())
        logger.info("push.subscribed", user_id=uid, endpoint=payload.endpoint[:40])
    return {"subscribed": True, "count": len(subs)}


@router.delete("/subscribe")
async def unsubscribe(
    payload:      PushSubscription,
    current_user: User = Depends(get_current_user),
):
    """Unregister push subscription."""
    uid   = current_user.id
    subs  = _subscriptions.get(uid, [])
    _subscriptions[uid] = [s for s in subs if s["endpoint"] != payload.endpoint]
    return {"unsubscribed": True}


@router.get("/vapid-public-key")
async def vapid_public_key():
    """Return VAPID public key for browser subscription."""
    from app.core.config import get_settings
    settings = get_settings()
    key = getattr(settings, "vapid_public_key", "")
    if not key:
        raise HTTPException(501, "Push notifications not configured (VAPID_PUBLIC_KEY not set)")
    return {"key": key}


async def push_to_user(user_id: str, payload: PushPayload) -> int:
    """
    Send push notification to all subscriptions of a user.
    Returns count of successful sends.
    Note: requires pywebpush + VAPID keys configured.
    """
    subs = _subscriptions.get(user_id, [])
    if not subs:
        return 0

    sent = 0
    dead: list[str] = []

    for sub in subs:
        try:
            from pywebpush import webpush, WebPushException
            from app.core.config import get_settings
            settings = get_settings()
            webpush(
                subscription_info = sub,
                data              = json.dumps({
                    "title": payload.title,
                    "body":  payload.body,
                    "icon":  payload.icon,
                    "badge": payload.badge,
                    "tag":   payload.tag,
                    "data":  payload.data,
                }),
                vapid_private_key = getattr(settings, "vapid_private_key", ""),
                vapid_claims      = {"sub": f"mailto:{getattr(settings, 'vapid_email', 'admin@skyforge.app')}"},
            )
            sent += 1
        except ImportError:
            logger.warning("push.pywebpush_not_installed")
            break
        except Exception as e:
            if "410" in str(e) or "404" in str(e):
                dead.append(sub["endpoint"])
            else:
                logger.error("push.send_error", error=str(e))

    # Clean dead subscriptions
    if dead:
        _subscriptions[user_id] = [s for s in subs if s["endpoint"] not in dead]

    return sent

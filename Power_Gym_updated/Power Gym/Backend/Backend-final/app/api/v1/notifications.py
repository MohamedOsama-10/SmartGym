# app/api/v1/notifications.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── Helper used by other modules ─────────────────────────────────────────────

def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    type: str = "system",
    link: Optional[str] = None,
):
    """Create a notification for a user. Call db.commit() after this."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
    )
    db.add(notif)
    return notif


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateNotificationBody(BaseModel):
    title: str
    message: str
    type: str = "system"
    link: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
        .limit(100)
        .all()
    )
    return [_to_dict(n) for n in notifs]


@router.post("/", status_code=201)
def create_notification_endpoint(
    body: CreateNotificationBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Frontend can POST to persist a notification for the current user."""
    n = create_notification(db, current_user.id, body.title, body.message, body.type, body.link)
    db.commit()
    db.refresh(n)
    return _to_dict(n)


@router.put("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


@router.put("/{notif_id}/read")
def mark_one_read(
    notif_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return _to_dict(n)


@router.delete("/")
def clear_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(Notification.user_id == current_user.id).delete()
    db.commit()
    return {"message": "All notifications cleared"}


@router.delete("/{notif_id}")
def delete_notification(
    notif_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(n)
    db.commit()
    return {"message": "Notification deleted"}


# ── Serializer ────────────────────────────────────────────────────────────────

def _to_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "user_id": n.user_id,
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "is_read": n.is_read,
        "link": n.link,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }

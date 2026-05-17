# app/api/v1/chat.py
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.conversation import Conversation, ChatMessage
from app.utils.cloudinary_upload import upload_file as cloudinary_upload_file, validate_image

logger = logging.getLogger(__name__)

CHAT_MEDIA_DIR = os.path.join("uploads", "chat")

router = APIRouter(prefix="/chat", tags=["Chat"])

ALLOWED_CHAT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_CHAT_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


class MessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


def _get_initials(name: str) -> str:
    parts = (name or "?").split()[:2]
    return "".join(w[0] for w in parts if w).upper() or "?"


# ── Contacts ──────────────────────────────────────────────────────────────────

@router.get("/contacts")
def get_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of people the current user can chat with."""
    if current_user.role == "coach":
        rows = db.execute(text("""
            SELECT DISTINCT u.id, u.full_name, c.avatar_url
            FROM customers c
            JOIN users u ON c.user_id = u.id
            WHERE
                c.assigned_coach_id IN (
                    SELECT id FROM coaches WHERE user_id = :coach_user_id
                )
                OR c.id IN (
                    SELECT b.customer_id FROM bookings b
                    JOIN coaches co ON b.coach_id = co.id
                    WHERE co.user_id = :coach_user_id
                )
                OR c.id IN (
                    SELECT s.customer_id FROM subscriptions s
                    JOIN coach_packages cp ON s.coach_package_id = cp.id
                    JOIN coaches co ON cp.coach_id = co.id
                    WHERE co.user_id = :coach_user_id AND s.status = 'active'
                )
        """), {"coach_user_id": current_user.id}).fetchall()

        contacts = [
            {
                "id": r.id,
                "name": r.full_name,
                "avatar_url": r.avatar_url,
                "role": "customer",
                "avatar": _get_initials(r.full_name),
            }
            for r in rows
        ]

        admin_rows = db.query(User).filter(
            User.role.in_(["admin", "owner"]),
            User.id != current_user.id,
            User.is_active == True,
        ).order_by(User.full_name).all()

        for u in admin_rows:
            photo_url = None
            try:
                p = db.execute(
                    text("SELECT profile_photo_path FROM admin_profiles WHERE admin_id = :uid"),
                    {"uid": u.id}
                ).fetchone()
                if p and p.profile_photo_path and p.profile_photo_path.startswith("http"):
                    photo_url = p.profile_photo_path
            except Exception:
                pass
            contacts.append({
                "id": u.id,
                "name": u.full_name or u.email,
                "avatar_url": photo_url,
                "role": u.role,
                "avatar": _get_initials(u.full_name or u.email),
            })

        return contacts

    elif current_user.role == "user":
        rows = db.execute(text("""
            SELECT DISTINCT u.id, u.full_name, co.specialty, co.avatar_url
            FROM coaches co
            JOIN users u ON co.user_id = u.id
            WHERE co.id IN (
                SELECT assigned_coach_id FROM customers
                WHERE user_id = :user_id AND assigned_coach_id IS NOT NULL
                UNION
                SELECT b.coach_id FROM bookings b
                JOIN customers c ON b.customer_id = c.id
                WHERE c.user_id = :user_id
                UNION
                SELECT cp.coach_id FROM subscriptions s
                JOIN coach_packages cp ON s.coach_package_id = cp.id
                JOIN customers c ON s.customer_id = c.id
                WHERE c.user_id = :user_id AND s.status = 'active'
            )
        """), {"user_id": current_user.id}).fetchall()

        return [
            {
                "id": r.id,
                "name": r.full_name,
                "role": "coach",
                "specialty": r.specialty,
                "avatar": _get_initials(r.full_name),
                "avatar_url": r.avatar_url,
            }
            for r in rows
        ]

    elif current_user.role in ("admin", "owner"):
        users = db.query(User).filter(
            User.id != current_user.id,
            User.is_active == True,
        ).order_by(User.role, User.full_name).all()

        result = []
        for u in users:
            av_row = None
            try:
                if u.role == "coach":
                    av_row = db.execute(text("SELECT avatar_url FROM coaches WHERE user_id = :uid"), {"uid": u.id}).fetchone()
                elif u.role == "user":
                    av_row = db.execute(text("SELECT avatar_url FROM customers WHERE user_id = :uid"), {"uid": u.id}).fetchone()
            except Exception:
                pass
            result.append({
                "id": u.id,
                "name": u.full_name,
                "role": u.role,
                "avatar": _get_initials(u.full_name),
                "avatar_url": av_row.avatar_url if av_row else None,
            })
        return result

    return []


# ── Conversations ──────────────────────────────────────────────────────────────

@router.get("/conversations")
def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all conversations for the current user, deduplicated."""
    convs = db.query(Conversation).filter(
        (Conversation.coach_user_id == current_user.id) |
        (Conversation.customer_user_id == current_user.id)
    ).order_by(Conversation.created_at.desc()).all()

    result = []
    seen_participants = set()

    for conv in convs:
        participant_id = (
            conv.customer_user_id
            if current_user.id == conv.coach_user_id
            else conv.coach_user_id
        )
        if participant_id in seen_participants:
            continue
        seen_participants.add(participant_id)

        participant = db.query(User).filter(User.id == participant_id).first()
        if not participant:
            continue

        last_msg = (
            db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == conv.id)
            .order_by(ChatMessage.created_at.desc())
            .first()
        )

        unread_count = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.conversation_id == conv.id,
                ChatMessage.sender_user_id != current_user.id,
                ChatMessage.is_read == False,
            )
            .count()
        )

        # Fetch avatar from role-specific table
        avatar_url = None
        try:
            if participant.role == "coach":
                av = db.execute(text("SELECT avatar_url FROM coaches WHERE user_id = :uid"), {"uid": participant.id}).fetchone()
                avatar_url = av.avatar_url if av else None
            elif participant.role in ("owner", "admin"):
                ap = db.execute(text("SELECT profile_photo_path FROM admin_profiles WHERE admin_id = :uid"), {"uid": participant.id}).fetchone()
                if ap and ap.profile_photo_path and ap.profile_photo_path.startswith("http"):
                    avatar_url = ap.profile_photo_path
                elif participant.role == "owner":
                    av = db.execute(text("SELECT avatar_url FROM owners WHERE user_id = :uid"), {"uid": participant.id}).fetchone()
                    avatar_url = av.avatar_url if av else None
                else:
                    av = db.execute(text("SELECT avatar_url FROM admins WHERE user_id = :uid"), {"uid": participant.id}).fetchone()
                    avatar_url = av.avatar_url if av else None
            else:
                av = db.execute(text("SELECT avatar_url FROM customers WHERE user_id = :uid"), {"uid": participant.id}).fetchone()
                avatar_url = av.avatar_url if av else None
        except Exception:
            pass

        result.append({
            "id": conv.id,
            "coach_user_id": conv.coach_user_id,
            "customer_user_id": conv.customer_user_id,
            "participant": {
                "id": participant.id,
                "name": participant.full_name,
                "role": participant.role,
                "avatar": _get_initials(participant.full_name),
                "avatar_url": avatar_url,
                "status": "offline",
            },
            "lastMessage": {
                "text": last_msg.text if last_msg else "",
                "timestamp": (
                    last_msg.created_at.isoformat() if last_msg
                    else conv.created_at.isoformat()
                ),
                "senderId": last_msg.sender_user_id if last_msg else None,
                "isRead": last_msg.is_read if last_msg else True,
            },
            "unreadCount": unread_count,
            "muted": False,
        })

    return result


@router.post("/conversations/with/{contact_user_id}")
def get_or_create_conversation(
    contact_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get an existing conversation with a contact, or create one."""
    if contact_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot start a conversation with yourself")

    contact = db.query(User).filter(User.id == contact_user_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Normalize roles so (A,B) and (B,A) always map to the same row
    if current_user.role in ("admin", "owner"):
        coach_user_id = current_user.id
        customer_user_id = contact_user_id
    elif contact.role in ("admin", "owner"):
        coach_user_id = contact_user_id
        customer_user_id = current_user.id
    elif current_user.role == "coach":
        coach_user_id = current_user.id
        customer_user_id = contact_user_id
    else:
        coach_user_id = contact_user_id
        customer_user_id = current_user.id

    conv = db.query(Conversation).filter(
        Conversation.coach_user_id == coach_user_id,
        Conversation.customer_user_id == customer_user_id,
    ).first()

    if not conv:
        try:
            conv = Conversation(coach_user_id=coach_user_id, customer_user_id=customer_user_id)
            db.add(conv)
            db.commit()
            db.refresh(conv)
        except IntegrityError:
            db.rollback()
            conv = db.query(Conversation).filter(
                Conversation.coach_user_id == coach_user_id,
                Conversation.customer_user_id == customer_user_id,
            ).first()
            if not conv:
                raise HTTPException(status_code=500, detail="Could not create conversation")

    if not conv:
        raise HTTPException(status_code=500, detail="Could not create or find conversation")

    return {"id": conv.id}


# ── Messages ───────────────────────────────────────────────────────────────────

def _assert_conv_access(conv: Conversation, current_user: User):
    """Raise 403 if user is not a participant in the conversation."""
    if current_user.role not in ("admin", "owner") and current_user.id not in [
        conv.coach_user_id, conv.customer_user_id
    ]:
        raise HTTPException(status_code=403, detail="Not authorized to access this conversation")


@router.get("/conversations/{conv_id}/messages")
def get_messages(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all messages in a conversation, in chronological order."""
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_conv_access(conv, current_user)

    # Determine the cleared_at cutoff for this user
    if current_user.id == conv.coach_user_id:
        cleared_at = conv.coach_cleared_at
    else:
        cleared_at = conv.customer_cleared_at

    query = db.query(ChatMessage).filter(ChatMessage.conversation_id == conv_id)
    if cleared_at:
        query = query.filter(ChatMessage.created_at > cleared_at)
    msgs = query.order_by(ChatMessage.created_at.asc()).all()

    # Mark messages from the other side as read
    db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conv_id,
        ChatMessage.sender_user_id != current_user.id,
        ChatMessage.is_read == False,
    ).update({"is_read": True})
    db.commit()

    return [
        {
            "id": m.id,
            "senderId": m.sender_user_id,
            "text": m.text or "",
            "media_url": m.media_url,
            "timestamp": (m.created_at or datetime.now(timezone.utc)).isoformat(),
            "type": "media" if m.media_url else "text",
            "isRead": True,  # we just marked them read above
        }
        for m in msgs
    ]


@router.post("/conversations/{conv_id}/messages")
def send_message(
    conv_id: int,
    message: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a text message in a conversation."""
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_conv_access(conv, current_user)

    if not message.text or not message.text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    msg = ChatMessage(
        conversation_id=conv_id,
        sender_user_id=current_user.id,
        text=message.text.strip(),
        is_read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return {
        "id": msg.id,
        "senderId": msg.sender_user_id,
        "text": msg.text or "",
        "media_url": None,
        "timestamp": (msg.created_at or datetime.now(timezone.utc)).isoformat(),
        "type": "text",
        "isRead": msg.is_read,
    }


@router.post("/conversations/{conv_id}/upload")
async def upload_chat_image(
    conv_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload an image and send it as a message. Max 5 MB, images only."""
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_conv_access(conv, current_user)

    # Validate file type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CHAT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{content_type}' not allowed. Use JPEG, PNG, WebP or GIF."
        )

    file_data = await file.read()

    # Validate file size
    if len(file_data) > MAX_CHAT_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum allowed size is 5 MB.")

    try:
        ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
        filename = f"{uuid.uuid4().hex}{ext}"
        media_url = cloudinary_upload_file(file_data, "chat", filename, content_type=content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chat image upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload image")

    msg = ChatMessage(
        conversation_id=conv_id,
        sender_user_id=current_user.id,
        text=None,
        media_url=media_url,
        is_read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return {
        "id": msg.id,
        "senderId": msg.sender_user_id,
        "text": "",
        "media_url": msg.media_url,
        "timestamp": (msg.created_at or datetime.now(timezone.utc)).isoformat(),
        "type": "media",
        "isRead": msg.is_read,
    }


@router.put("/conversations/{conv_id}/read")
def mark_conversation_read(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all messages from the other participant as read."""
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_conv_access(conv, current_user)

    db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conv_id,
        ChatMessage.sender_user_id != current_user.id,
        ChatMessage.is_read == False,
    ).update({"is_read": True})
    db.commit()

    return {"message": "Messages marked as read"}


@router.delete("/conversations/{conv_id}")
def delete_conversation(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a conversation and all its messages."""
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_conv_access(conv, current_user)

    db.query(ChatMessage).filter(ChatMessage.conversation_id == conv_id).delete()
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}


@router.delete("/conversations/{conv_id}/messages")
def clear_conversation_messages(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear messages in a conversation for the requesting user only.
    The other participant's view is unaffected — messages are hidden by
    tracking a per-user cleared_at timestamp and filtering on the frontend.
    Since chat_messages has no per-user visibility column, we implement this
    by recording the cleared timestamp in the conversation and letting the
    GET /messages endpoint filter accordingly.
    """
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_conv_access(conv, current_user)

    # Record the cleared_at time for this participant so GET /messages can filter.
    # We store it as a column on the conversation. If the column doesn't exist yet
    # (schema not migrated) we fall back to deleting all — same old behaviour but
    # won't silently break.
    now = datetime.now(timezone.utc)
    try:
        if current_user.id == conv.coach_user_id:
            db.execute(
                text("UPDATE conversations SET coach_cleared_at = :ts WHERE id = :cid"),
                {"ts": now, "cid": conv_id}
            )
        else:
            db.execute(
                text("UPDATE conversations SET customer_cleared_at = :ts WHERE id = :cid"),
                {"ts": now, "cid": conv_id}
            )
        db.commit()
    except Exception:
        # Columns don't exist yet (migration pending) — fall back gracefully
        db.rollback()
        logger.warning(
            f"clear_conversation_messages: cleared_at columns missing on conversations table. "
            f"Run the migration to add coach_cleared_at and customer_cleared_at. "
            f"Falling back to full delete for conv {conv_id}."
        )
        db.query(ChatMessage).filter(ChatMessage.conversation_id == conv_id).delete()
        db.commit()

    return {"message": "Messages cleared"}

# app/api/v1/users.py
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current authenticated user info."""
    return UserResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        phone=current_user.phone,
        created_at=current_user.created_at,
    )


@router.get("/me/profile")
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's avatar_url — used by the chat window to show
    the sender's own avatar. Works for all roles."""
    from sqlalchemy import text
    avatar_url = None
    try:
        if current_user.role == "coach":
            row = db.execute(
                text("SELECT avatar_url FROM coaches WHERE user_id = :uid"),
                {"uid": current_user.id}
            ).fetchone()
            avatar_url = row.avatar_url if row else None
        elif current_user.role == "user":
            row = db.execute(
                text("SELECT avatar_url FROM customers WHERE user_id = :uid"),
                {"uid": current_user.id}
            ).fetchone()
            avatar_url = row.avatar_url if row else None
        elif current_user.role == "admin":
            row = db.execute(
                text("SELECT avatar_url FROM admins WHERE user_id = :uid"),
                {"uid": current_user.id}
            ).fetchone()
            avatar_url = row.avatar_url if row else None
        elif current_user.role == "owner":
            row = db.execute(
                text("SELECT avatar_url FROM owners WHERE user_id = :uid"),
                {"uid": current_user.id}
            ).fetchone()
            avatar_url = row.avatar_url if row else None
    except Exception:
        pass

    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "avatar_url": avatar_url,
    }

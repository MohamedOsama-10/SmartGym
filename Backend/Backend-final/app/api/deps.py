#D:\gym_system\Gym_Backend\app\api\deps.py
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.models.token_blacklist import TokenBlacklist
from app.config import settings


def get_token_from_header(authorization: str = Header(...)) -> str:
    """Extract token from Authorization header"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme"
        )
    return authorization.replace("Bearer ", "")


def get_current_user(
    token: str = Depends(get_token_from_header),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Check if token is blacklisted
    blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.token == token).first()
    if blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked"
        )

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    return user


# ✅ BUG 1 FIXED: All role checks use lowercase to match DB values
def require_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "owner":  # ✅ lowercase
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can perform this action"
        )
    return current_user


def require_coach(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "coach":  # ✅ lowercase
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,  # ✅ BUG 2 FIXED: was missing status_code + detail
            detail="Only coaches can perform this action"
        )
    return current_user


def require_customer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "user":  # ✅ DB stores 'user' not 'customer'
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can perform this action"
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ✅ BUG 1 FIXED: was checking "COACH","OWNER" (uppercase) — DB stores lowercase
def require_coach_or_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["coach", "owner"]:  # ✅ lowercase
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches or owners can perform this action"
        )
    return current_user


def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    if not authorization:
        return None

    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")

        if email is None:
            return None

        blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.token == token).first()
        if blacklisted:
            return None

        user = db.query(User).filter(User.email == email).first()
        return user

    except JWTError:
        return None
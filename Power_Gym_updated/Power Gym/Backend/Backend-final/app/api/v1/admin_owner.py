# app/api/v1/admin_owner.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.api.deps import get_current_user, require_owner
from app.models.user import User
from app.models.admin import Admin
from app.models.owner import Owner
from app.schemas.admin_owner import (
    AdminProfileUpdate,
    AdminProfileResponse,
    AdminWithUser,
    OwnerProfileUpdate,
    OwnerProfileResponse,
    OwnerWithUser
)

router = APIRouter(prefix="/staff", tags=["Staff Management"])


# ==================== DEPENDENCY: require_admin ====================
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to check if user is admin"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can perform this action"
        )
    return current_user


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admins/me", response_model=AdminProfileResponse)
def get_my_admin_profile(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get current admin's profile"""
    if not current_user.admin_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin profile not found"
        )
    return current_user.admin_profile


@router.put("/admins/me", response_model=AdminProfileResponse)
def update_my_admin_profile(
    profile_data: AdminProfileUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update current admin's profile"""
    if not current_user.admin_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin profile not found"
        )

    update_dict = profile_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(current_user.admin_profile, key, value)

    db.commit()
    db.refresh(current_user.admin_profile)
    return current_user.admin_profile


@router.get("/admins", response_model=List[AdminWithUser])
def list_all_admins(
    current_user: User = Depends(require_owner),  # Only owners can view all admins
    db: Session = Depends(get_db)
):
    """List all admins with their profiles (OWNER only)"""
    admins = db.query(User).filter(User.role == "admin").all()
    return admins


# ==================== OWNER ENDPOINTS ====================

@router.get("/owners/me", response_model=OwnerProfileResponse)
def get_my_owner_profile(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Get current owner's profile"""
    if not current_user.owner_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner profile not found"
        )
    return current_user.owner_profile


@router.put("/owners/me", response_model=OwnerProfileResponse)
def update_my_owner_profile(
    profile_data: OwnerProfileUpdate,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Update current owner's profile"""
    if not current_user.owner_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner profile not found"
        )

    update_dict = profile_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(current_user.owner_profile, key, value)

    db.commit()
    db.refresh(current_user.owner_profile)
    return current_user.owner_profile


@router.get("/owners", response_model=List[OwnerWithUser])
def list_all_owners(
    current_user: User = Depends(require_admin),  # Admins can view owners
    db: Session = Depends(get_db)
):
    """List all owners with their profiles"""
    owners = db.query(User).filter(User.role == "owner").all()
    return owners
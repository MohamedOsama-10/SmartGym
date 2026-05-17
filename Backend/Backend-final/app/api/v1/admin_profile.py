# app/api/v1/admin_profile.py
# Full admin profile + password change + photo upload + reports
#
# Run SQL: update_admin_profiles_table.sql

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Request
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Date
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel
import bcrypt
import os
import shutil
from app.utils.cloudinary_upload import upload_file as cloudinary_upload_file, delete_file as cloudinary_delete_file
import logging

from app.database import Base, get_db
from app.api.deps import get_current_user  # Changed from require_admin
from app.models.user import User

router = APIRouter(tags=["Admin Profile & Reports"])
logger = logging.getLogger(__name__)

# ✅ NEW: Flexible role checker that accepts multiple roles
class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles
    
    def __call__(self, current_user: User = Depends(get_current_user)):
        logger.info(f"Checking role for user {current_user.id}: {current_user.role}")
        logger.info(f"Allowed roles: {self.allowed_roles}")
        
        if current_user.role not in self.allowed_roles:
            logger.error(f"User {current_user.id} has role '{current_user.role}', not in {self.allowed_roles}")
            raise HTTPException(
                status_code=403, 
                detail=f"Operation not permitted. Required roles: {self.allowed_roles}, your role: {current_user.role}"
            )
        return current_user

# ✅ Create role checkers for different permission levels
require_admin_or_owner = RoleChecker(["admin", "owner"])  # Accepts both admin and owner
require_admin_only = RoleChecker(["admin"])
require_owner_only = RoleChecker(["owner"])

class AdminProfile(Base):
    __tablename__ = "admin_profiles"
    id                                = Column(Integer, primary_key=True, autoincrement=True)
    admin_id                          = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name                         = Column(String(200), nullable=True)
    email                             = Column(String(200), nullable=True)
    phone                             = Column(String(50), nullable=True)
    date_of_birth                     = Column(Date, nullable=True)
    gender                            = Column(String(20), nullable=True)
    gym_branch                        = Column(String(200), nullable=True)
    address                           = Column(String(500), nullable=True)
    emergency_contact_name            = Column(String(200), nullable=True)
    emergency_contact_phone           = Column(String(50), nullable=True)
    emergency_contact_relationship    = Column(String(100), nullable=True)
    profile_photo_path                = Column(String(500), nullable=True)
    updated_at                        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AdminReport(Base):
    __tablename__ = "admin_reports"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    admin_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name        = Column(String(200), nullable=False)
    type        = Column(String(100), nullable=False, default="Custom")
    period      = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

class ProfileOut(BaseModel):
    full_name: Optional[str] = None; email: Optional[str] = None; phone: Optional[str] = None
    date_of_birth: Optional[str] = None; gender: Optional[str] = None; gym_branch: Optional[str] = None
    address: Optional[str] = None; emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None; emergency_contact_relationship: Optional[str] = None
    profile_photo_url: Optional[str] = None
    class Config: from_attributes = True

class ReportIn(BaseModel):
    name: str; type: Optional[str] = "Custom"; period: Optional[str] = None; description: Optional[str] = None

class ReportOut(BaseModel):
    id: int; name: str; type: str; period: Optional[str] = None; description: Optional[str] = None; created_at: datetime
    class Config: from_attributes = True

class PasswordChange(BaseModel):
    current_password: str; new_password: str

# ✅ UPDATED: Use flexible role checker that allows both admin and owner
@router.get("/admin/profile/", response_model=ProfileOut)
def get_profile(
    request: Request, 
    current_user: User = Depends(require_admin_or_owner),  # Changed from require_admin
    db: Session = Depends(get_db)
):
    """Get admin/owner profile with photo URL"""
    logger.info(f"Getting profile for user {current_user.id} with role {current_user.role}")
    
    p = db.query(AdminProfile).filter(AdminProfile.admin_id == current_user.id).first()
    base = str(request.base_url).rstrip("/")
    
    if not p: 
        return ProfileOut(email=current_user.email)
    
    return ProfileOut(
        full_name=p.full_name, 
        email=p.email or current_user.email, 
        phone=p.phone,
        date_of_birth=str(p.date_of_birth) if p.date_of_birth else None, 
        gender=p.gender, 
        gym_branch=p.gym_branch, 
        address=p.address,
        emergency_contact_name=p.emergency_contact_name, 
        emergency_contact_phone=p.emergency_contact_phone,
        emergency_contact_relationship=p.emergency_contact_relationship,
        profile_photo_url=p.profile_photo_path if p.profile_photo_path and p.profile_photo_path.startswith("http") else None,
    )

# ✅ UPDATED: Use flexible role checker
@router.put("/admin/profile/")
async def save_profile(
    request: Request,
    full_name: Optional[str] = Form(None), 
    email: Optional[str] = Form(None), 
    phone: Optional[str] = Form(None),
    date_of_birth: Optional[str] = Form(None), 
    gender: Optional[str] = Form(None), 
    gym_branch: Optional[str] = Form(None),
    address: Optional[str] = Form(None), 
    emergency_contact_name: Optional[str] = Form(None),
    emergency_contact_phone: Optional[str] = Form(None), 
    emergency_contact_relationship: Optional[str] = Form(None),
    profile_photo: Optional[UploadFile] = File(None), 
    current_user: User = Depends(require_admin_or_owner),  # Changed from require_admin
    db: Session = Depends(get_db),
):
    """Save full profile (including photo if provided)"""
    logger.info(f"Saving profile for user {current_user.id} with role {current_user.role}")
    
    p = db.query(AdminProfile).filter(AdminProfile.admin_id == current_user.id).first()
    if not p: 
        p = AdminProfile(admin_id=current_user.id)
        db.add(p)
    
    if full_name is not None:
        p.full_name = full_name
    if email is not None:
        p.email = email
    if phone is not None:
        p.phone = phone
    if date_of_birth is not None:
        p.date_of_birth = date_of_birth
    if gender is not None:
        p.gender = gender
    if gym_branch is not None:
        p.gym_branch = gym_branch
    if address is not None:
        p.address = address
    if emergency_contact_name is not None:
        p.emergency_contact_name = emergency_contact_name
    if emergency_contact_phone is not None:
        p.emergency_contact_phone = emergency_contact_phone
    if emergency_contact_relationship is not None:
        p.emergency_contact_relationship = emergency_contact_relationship
    
    if profile_photo and profile_photo.filename:
        os.makedirs("uploads/profiles", exist_ok=True)
        ext = os.path.splitext(profile_photo.filename)[1] or ".jpg"
        filename = f"admin_{current_user.id}_{int(datetime.now().timestamp())}{ext}"
        with open(f"uploads/profiles/{filename}", "wb") as f: 
            shutil.copyfileobj(profile_photo.file, f)
        photo_url = cloudinary_upload_file(profile_photo.file, "profiles", filename)
    p.profile_photo_path = photo_url
    
    db.commit()
    db.refresh(p)
    
    base = str(request.base_url).rstrip("/")
    return {
        "message": "Profile saved successfully",
        "profile_photo_url": p.profile_photo_path if p.profile_photo_path and p.profile_photo_path.startswith("http") else None,
        "full_name": p.full_name,
        "email": p.email or current_user.email,
    }

# ✅ UPDATED: Use flexible role checker
@router.post("/admin/profile/photo")
async def upload_profile_photo(
    request: Request,
    profile_photo: UploadFile = File(...),
    current_user: User = Depends(require_admin_or_owner),  # Changed from require_admin
    db: Session = Depends(get_db),
):
    """Upload profile photo immediately (standalone endpoint)"""
    logger.info(f"Photo upload request from user {current_user.id} with role {current_user.role}")
    
    if not profile_photo.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Get or create profile
    p = db.query(AdminProfile).filter(AdminProfile.admin_id == current_user.id).first()
    if not p:
        p = AdminProfile(admin_id=current_user.id)
        db.add(p)
    
    # Upload to Cloudinary
    ext = os.path.splitext(profile_photo.filename)[1] or ".jpg"
    filename = f"admin_{current_user.id}_{int(datetime.now().timestamp())}{ext}"
    
    # Delete old photo from Cloudinary if exists
    if p.profile_photo_path and p.profile_photo_path.startswith("http"):
        try:
            cloudinary_delete_file(p.profile_photo_path)
        except Exception as e:
            logger.warning(f"Failed to delete old Cloudinary photo: {e}")
    
    # Upload new photo to Cloudinary
    photo_url = cloudinary_upload_file(profile_photo.file, "profiles", filename)
    
    # Update database with Cloudinary URL
    p.profile_photo_path = photo_url
    db.commit()
    db.refresh(p)
    
    logger.info(f"Photo uploaded successfully to Cloudinary: {photo_url}")
    
    return {
        "message": "Photo uploaded successfully",
        "profile_photo_url": photo_url,
    }

@router.delete("/admin/profile/photo", status_code=204)
def delete_profile_photo(
    current_user: User = Depends(require_admin_or_owner),
    db: Session = Depends(get_db),
):
    """Remove profile photo"""
    p = db.query(AdminProfile).filter(AdminProfile.admin_id == current_user.id).first()
    if p and p.profile_photo_path:
        if p.profile_photo_path.startswith("http"):
            try:
                cloudinary_delete_file(p.profile_photo_path)
            except Exception as e:
                logger.warning(f"Failed to delete Cloudinary photo: {e}")
        p.profile_photo_path = None
        db.commit()
    return None

# ✅ UPDATED: Use flexible role checker
@router.put("/admin/change-password/")
def change_password(
    data: PasswordChange, 
    current_user: User = Depends(require_admin_or_owner),  # Changed from require_admin
    db: Session = Depends(get_db)
):
    """Change admin/owner password"""
    if not bcrypt.checkpw(data.current_password.encode('utf-8'), current_user.password_hash.encode('utf-8')):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    current_user.password_hash = bcrypt.hashpw(data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db.commit()
    
    return {"message": "Password changed successfully"}

# ✅ UPDATED: Use flexible role checker
@router.get("/admin/reports/", response_model=List[ReportOut])
def list_reports(
    current_user: User = Depends(require_admin_or_owner),  # Changed from require_admin
    db: Session = Depends(get_db)
):
    """List all reports for current admin/owner"""
    return db.query(AdminReport).filter(AdminReport.admin_id == current_user.id).order_by(AdminReport.created_at.desc()).all()

# ✅ UPDATED: Use flexible role checker
@router.post("/admin/reports/", response_model=ReportOut, status_code=201)
def create_report(
    data: ReportIn, 
    current_user: User = Depends(require_admin_or_owner),  # Changed from require_admin
    db: Session = Depends(get_db)
):
    """Create new report"""
    r = AdminReport(
        admin_id=current_user.id, 
        name=data.name, 
        type=data.type or "Custom", 
        period=data.period, 
        description=data.description
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r

# ✅ UPDATED: Use flexible role checker
@router.delete("/admin/reports/{report_id}", status_code=204)
def delete_report(
    report_id: int, 
    current_user: User = Depends(require_admin_or_owner),  # Changed from require_admin
    db: Session = Depends(get_db)
):
    """Delete a report"""
    r = db.query(AdminReport).filter(AdminReport.id == report_id, AdminReport.admin_id == current_user.id).first()
    if not r: 
        raise HTTPException(status_code=404, detail="Report not found")
    
    db.delete(r)
    db.commit()
    return None

# ── Photo lookup by user ID (used by chat to show profile photos) ──────────
@router.get("/admin/users/{user_id}/photo")
def get_user_photo(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the profile_photo_url for any user by their ID.
    Queries admin_profiles table (covers admins and owners).
    Returns {"profile_photo_url": "..."} or {"profile_photo_url": null}.
    """
    p = db.query(AdminProfile).filter(AdminProfile.admin_id == user_id).first()
    if not p or not p.profile_photo_path:
        return {"profile_photo_url": None}
    base = str(request.base_url).rstrip("/")
    photo_url = p.profile_photo_path if p.profile_photo_path and p.profile_photo_path.startswith("http") else None
    return {"profile_photo_url": photo_url}

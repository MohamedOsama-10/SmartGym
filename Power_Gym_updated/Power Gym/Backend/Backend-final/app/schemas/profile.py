#D:\gym_system\Gym_Backend\app\schemas\profile.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime


# ==================== COACH PROFILE ====================

class CoachProfileUpdate(BaseModel):
    experience_years: Optional[int] = Field(None, ge=0)
    hourly_rate: Optional[float] = Field(None, ge=0)
    rate: Optional[float] = Field(None, ge=0, le=5)
    gym_id: Optional[int] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None
    is_available: Optional[bool] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    linkedin: Optional[str] = None
    youtube: Optional[str] = None

    class Config:
        extra = "ignore"


# ── Certification ────────────────────────────────────────────────────────────

class CertificationCreate(BaseModel):
    name: str
    issuer: Optional[str] = None
    date_obtained: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None


class CertificationResponse(BaseModel):
    id: int
    name: str
    issuer: Optional[str] = None
    date_obtained: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None
    verified: bool = False

    class Config:
        from_attributes = True


# ── Education ────────────────────────────────────────────────────────────────

class EducationCreate(BaseModel):
    degree: str
    institution: str
    graduation_year: Optional[int] = None
    field_of_study: Optional[str] = None


class EducationResponse(BaseModel):
    id: int
    degree: str
    institution: str
    graduation_year: Optional[int] = None
    field_of_study: Optional[str] = None

    class Config:
        from_attributes = True


# ── Experience ────────────────────────────────────────────────────────────────

class ExperienceCreate(BaseModel):
    position: str
    company: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    current: bool = False


class ExperienceResponse(BaseModel):
    id: int
    position: str
    company: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    current: bool = False

    class Config:
        from_attributes = True


# ── Full Coach Response ───────────────────────────────────────────────────────

class CoachProfileResponse(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    phone: Optional[str] = None
    gym_id: Optional[int] = None
    experience_years: Optional[int] = None
    hourly_rate: Optional[float] = None
    rate: Optional[float] = None
    rating: Optional[float] = 0.0
    total_reviews: Optional[int] = 0
    total_clients: Optional[int] = 0
    success_stories: Optional[int] = 0
    specialty: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    is_available: Optional[bool] = True
    # Social media — named to match what the frontend expects
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    linkedin: Optional[str] = None
    youtube: Optional[str] = None
    cv_url: Optional[str] = None
    # Nested lists
    certifications: List[CertificationResponse] = []
    education: List[EducationResponse] = []
    experience: List[ExperienceResponse] = []

    class Config:
        from_attributes = True

# ==================== CUSTOMER PROFILE (React) ====================

class CustomerProfileUpdate(BaseModel):
    """Update customer profile - matches React UserProfile"""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    weight_goal: Optional[float] = None
    goal: Optional[str] = None
    bio: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    email_updates_enabled: Optional[bool] = None
    public_profile: Optional[bool] = None
    
    # ✅ Configure the model to allow None values
    class Config:
        extra = "forbid"  # Don't allow extra fields
        validate_assignment = True


class CustomerProfileResponse(BaseModel):
    """Customer profile response - matches React exactly"""
    id: int
    user_id: int
    name: str  # full_name
    email: str
    phone: Optional[str]
    date_of_birth: Optional[date]
    gender: Optional[str]
    height: Optional[float]
    weight: Optional[float]
    weight_goal: Optional[float] = None
    goal: Optional[str]
    bio: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    emergency_contact_relationship: Optional[str]
    notifications_enabled: bool
    email_updates_enabled: bool
    public_profile: bool
    avatar_url: Optional[str]
    assigned_coach_name: Optional[str] = None
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==================== FULL CUSTOMER (Other Pages) ====================

class CustomerFullResponse(BaseModel):
    """Full customer profile with all fields"""
    id: int
    user_id: int
    full_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    gym_id: Optional[int]
    membership_id: Optional[str]
    assigned_coach_id: Optional[int]
    joined_date: Optional[date]
    height: Optional[float]
    weight: Optional[float]
    goal: Optional[str]
    weight_goal: Optional[float]
    date_of_birth: Optional[date]
    gender: Optional[str]
    bio: Optional[str]
    avatar_url: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    emergency_contact_relationship: Optional[str]
    notifications_enabled: Optional[bool]
    email_updates_enabled: Optional[bool]
    public_profile: Optional[bool]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class CustomerFullUpdate(BaseModel):
    """Update any customer field"""
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gym_id: Optional[int] = None
    membership_id: Optional[str] = None
    assigned_coach_id: Optional[int] = None
    joined_date: Optional[date] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    goal: Optional[str] = None
    weight_goal: Optional[float] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    email_updates_enabled: Optional[bool] = None
    public_profile: Optional[bool] = None


# ==================== AVATAR UPLOAD ====================

class AvatarUploadResponse(BaseModel):
    avatar_url: str
    message: str = "Avatar updated successfully"
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any

# ==================== GYM ====================

class GymCreate(BaseModel):
    """Create new gym"""
    name: str = Field(..., min_length=1, max_length=100)
    location: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    status: Optional[str] = "Active"


class GymUpdate(BaseModel):
    """Update gym"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    location: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    status: Optional[str] = None


class GymResponse(BaseModel):
    """Gym response"""
    id: int
    name: str
    location: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = "Active"
    image_url: Optional[str] = None
    description: Optional[str] = None
    total_members: Optional[int] = 0
    active_members: Optional[int] = 0
    total_coaches: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True


class GymCoachResponse(BaseModel):
    """Coach at a gym - COMPLETE SCHEMA for CoachDirectory.jsx"""
    id: int
    name: str
    email: str
    experience_years: Optional[int] = 0
    hourly_rate: Optional[float] = 0.0
    rate: Optional[float] = 0.0
    
    # Additional fields required by CoachDirectory.jsx
    specialty: Optional[str] = "General Fitness"
    specialties: Optional[List[str]] = []
    bio: Optional[str] = "Experienced fitness coach dedicated to helping clients reach their goals."
    certifications: Optional[List[Any]] = []
    languages: Optional[List[str]] = ["English"]
    education: Optional[str] = ""
    availability_text: Optional[str] = "Contact for availability"
    rating: Optional[float] = 4.5
    total_reviews: Optional[int] = 0
    total_clients: Optional[int] = 0
    max_clients: Optional[int] = 20
    current_clients: Optional[int] = 0
    is_available: Optional[bool] = True
    is_featured: Optional[bool] = False
    avatar: Optional[str] = "CO"
    avatar_url: Optional[str] = None
    cv_url: Optional[str] = None

    class Config:
        from_attributes = True

class GymBookingResponse(BaseModel):
    """Booking at a gym"""
    id: int
    customer_name: str
    coach_name: str
    session_time: datetime
    status: str
    created_at: datetime
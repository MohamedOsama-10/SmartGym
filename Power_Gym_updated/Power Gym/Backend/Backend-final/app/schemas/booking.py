#D:\gym_system\Gym_Backend\app\schemas\booking.py
from pydantic import BaseModel, validator
from datetime import datetime, date, time
from typing import Optional
from enum import Enum


# ==================== COACH AVAILABILITY ====================

class AvailabilityCreate(BaseModel):
    date: date
    start_time: time
    end_time: time

    @validator('end_time')
    def end_time_after_start_time(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v


class AvailabilityUpdate(BaseModel):
    date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_available: Optional[bool] = None


class AvailabilityResponse(BaseModel):
    id: int
    coach_id: int
    specific_date: date
    start_time: time
    end_time: time
    is_available: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== BOOKINGS ====================

class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    ATTENDED = "attended"
    MISSED = "missed"
    UPCOMING = "upcoming"
    RESCHEDULED = "rescheduled"


class BookingCreate(BaseModel):
    coach_id: int
    availability_slot_id: int
    customer_notes: Optional[str] = None
    session_type: Optional[str] = "pt"  # ADD THIS


class BookingUpdate(BaseModel):
    status: BookingStatus
    coach_notes: Optional[str] = None


class BookingResponse(BaseModel):
    id: int
    customer_id: int
    coach_id: Optional[int]
    availability_slot_id: Optional[int]
    gym_id: Optional[int]
    subscription_id: Optional[int] = None
    
    session_date: date
    session_time: time
    
    session_type: Optional[str] = None
    title: Optional[str] = None
    duration_minutes: int = 60
    
    status: str
    customer_notes: Optional[str]
    coach_notes: Optional[str]
    branch: Optional[str] = None
    
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class BookingDetailResponse(BaseModel):
    id: int
    customer_name: str
    customer_email: str
    coach_name: str
    coach_email: str

    session_date: date
    session_time: time

    status: str
    customer_notes: Optional[str]
    coach_notes: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==================== RESCHEDULE SCHEMAS ====================

class RescheduleRequest(BaseModel):
    new_availability_slot_id: int
    new_coach_id: Optional[int] = None
    reschedule_reason: Optional[str] = None


class CoachRescheduleRequest(BaseModel):
    new_availability_slot_id: int
    reschedule_reason: Optional[str] = None
    notify_customer: bool = True


# ==================== COACH PROFILE ====================

class CoachProfileResponse(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    experience_years: Optional[int]
    hourly_rate: Optional[float]
    total_bookings: int = 0

    class Config:
        from_attributes = True
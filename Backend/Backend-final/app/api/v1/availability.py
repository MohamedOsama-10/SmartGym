# app/api/v1/availability.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from app.database import get_db
from app.api.deps import get_current_user, require_coach
from app.models.user import User
from app.models.coach import Coach
from app.models.coach_availability import CoachAvailability
from app.schemas.booking import (
    AvailabilityCreate,
    AvailabilityUpdate,
    AvailabilityResponse
)

router = APIRouter(prefix="/coach/availability", tags=["Coach Availability"])


@router.post("/", response_model=AvailabilityResponse, status_code=status.HTTP_201_CREATED)
def create_availability(
    availability_data: AvailabilityCreate,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """
    Create new availability slot (COACH only)
    """
    # Get coach profile
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach profile not found"
        )
    
    # Check for overlapping slots - FIXED: specific_date instead of date
    existing = db.query(CoachAvailability).filter(
        CoachAvailability.coach_id == coach.id,
        CoachAvailability.specific_date == availability_data.date,
        CoachAvailability.is_active == True
    ).all()
    
    for slot in existing:
        # Check if times overlap
        if not (availability_data.end_time <= slot.start_time or 
                availability_data.start_time >= slot.end_time):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Time slot overlaps with existing availability ({slot.start_time}-{slot.end_time})"
            )
    
    # Create availability slot - FIXED: specific_date and is_active
    new_slot = CoachAvailability(
        coach_id=coach.id,
        specific_date=availability_data.date,
        start_time=availability_data.start_time,
        end_time=availability_data.end_time,
        is_active=True
    )
    
    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)
    
    return new_slot


@router.get("/", response_model=List[AvailabilityResponse])
def get_my_availability(
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """
    Get all availability slots for current coach
    """
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach profile not found"
        )
    
    slots = db.query(CoachAvailability).filter(
        CoachAvailability.coach_id == coach.id
    ).order_by(CoachAvailability.specific_date, CoachAvailability.start_time).all()
    
    return slots


@router.get("/coach/{coach_id}", response_model=List[AvailabilityResponse])
def get_coach_availability(
    coach_id: int,
    available_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get availability slots for a specific coach (for customers to view)
    """
    query = db.query(CoachAvailability).filter(
        CoachAvailability.coach_id == coach_id
    )
    
    if available_only:
        query = query.filter(CoachAvailability.is_active == True)
    
    slots = query.order_by(
        CoachAvailability.specific_date,
        CoachAvailability.start_time
    ).all()
    
    return slots


@router.put("/{slot_id}", response_model=AvailabilityResponse)
def update_availability(
    slot_id: int,
    update_data: AvailabilityUpdate,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """
    Update availability slot (COACH only - can only update their own slots)
    """
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach profile not found"
        )
    
    # Get slot and verify ownership
    slot = db.query(CoachAvailability).filter(
        CoachAvailability.id == slot_id,
        CoachAvailability.coach_id == coach.id
    ).first()
    
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability slot not found or you don't have permission"
        )
    
    # Update fields
    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(slot, key, value)
    
    db.commit()
    db.refresh(slot)
    
    return slot


@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability(
    slot_id: int,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """
    Delete availability slot (COACH only)
    """
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach profile not found"
        )
    
    slot = db.query(CoachAvailability).filter(
        CoachAvailability.id == slot_id,
        CoachAvailability.coach_id == coach.id
    ).first()
    
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability slot not found"
        )
    
    # Check if slot has bookings
    from app.models.booking import Booking
    bookings = db.query(Booking).filter(
        Booking.availability_slot_id == slot_id,
        Booking.status.in_(["pending", "confirmed", "upcoming"])
    ).count()
    
    if bookings > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete slot with active bookings"
        )
    
    db.delete(slot)
    db.commit()
    
    return None
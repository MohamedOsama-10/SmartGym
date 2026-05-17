# app/api/v1/bookings.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, date, time  # FIXED: Added datetime import
from pydantic import BaseModel
from app.database import get_db
from app.api.deps import get_current_user, require_customer, require_coach, require_owner
from app.models.user import User
from app.models.customer import Customer
from app.models.coach import Coach
from app.models.gym import Gym
from app.models.coach_availability import CoachAvailability
from app.models.booking import Booking
from sqlalchemy import text
from app.schemas.booking import (
    BookingCreate,
    BookingUpdate,
    BookingResponse,
    BookingDetailResponse,
    BookingStatus
)

router = APIRouter(prefix="/bookings", tags=["Bookings"])


# ==================== RESCHEDULE SCHEMAS ====================

class RescheduleRequest(BaseModel):
    new_availability_slot_id: int
    new_coach_id: Optional[int] = None
    reschedule_reason: Optional[str] = None


class CoachRescheduleRequest(BaseModel):
    new_availability_slot_id: int
    reschedule_reason: Optional[str] = None
    notify_customer: bool = True


# ==================== BOOKING CREATE ====================

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_booking(
    booking_data: BookingCreate,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """Create new booking (CUSTOMER only)"""
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer profile not found")

    # Verify availability slot
    slot = db.query(CoachAvailability).filter(
        CoachAvailability.id == booking_data.availability_slot_id,
        CoachAvailability.coach_id == booking_data.coach_id,
        CoachAvailability.is_active == True
    ).first()

    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability slot not found or not available"
        )

    # FIXED: slot.specific_date instead of slot.date
    session_date = slot.specific_date
    session_time_val = slot.start_time

    # Prevent booking past dates
    session_datetime = datetime.combine(session_date, session_time_val)
    if session_datetime < datetime.now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot book sessions in the past"
        )

    # Check if slot is already booked
    existing_booking = db.query(Booking).filter(
        Booking.availability_slot_id == slot.id,
        Booking.status.in_(["pending", "confirmed", "upcoming"])
    ).first()

    if existing_booking:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This time slot is already booked"
        )

    # Check customer double-booking at same date+time
    customer_conflict = db.query(Booking).filter(
        Booking.customer_id == customer.id,
        Booking.session_date == session_date,
        Booking.session_time == session_time_val,
        Booking.status.in_(["pending", "confirmed", "upcoming"])
    ).first()

    if customer_conflict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a booking at this time with another coach"
        )

    # Get coach's gym_id
    coach = db.query(Coach).filter(Coach.id == booking_data.coach_id).first()

    # Auto-assign active subscription
    from app.models.subscription import Subscription
    active_sub = db.query(Subscription).filter(
        Subscription.customer_id == customer.id,
        Subscription.status == "active"
    ).first()

    new_booking = Booking(
        customer_id=customer.id,
        coach_id=booking_data.coach_id,
        availability_slot_id=slot.id,
        gym_id=coach.gym_id if coach else None,
        subscription_id=active_sub.id if active_sub else None,
        session_date=session_date,
        session_time=session_time_val,
        status="upcoming",
        customer_notes=booking_data.customer_notes
    )

    db.add(new_booking)
    slot.is_active = False  # Mark slot as booked
    db.commit()
    db.refresh(new_booking)

    return serialize_booking(db, new_booking)


# ==================== SERIALIZER ====================

def serialize_booking(db: Session, booking: Booking):
    """Helper function to serialize booking with all frontend-required fields"""
    coach = db.query(Coach).filter(Coach.id == booking.coach_id).first() if booking.coach_id else None
    coach_user = db.query(User).filter(User.id == coach.user_id).first() if coach else None
    gym = db.query(Gym).filter(Gym.id == booking.gym_id).first() if booking.gym_id else None
    
    return {
        "id": booking.id,
        "title": booking.session_type or "Gym Session",
        "session_type": booking.session_type or "gym",
        "session_date": booking.session_date.isoformat() if booking.session_date else None,
        "session_time": str(booking.session_time) if booking.session_time else None,
        "status": booking.status,
        "subscription_id": booking.subscription_id,
        "duration_minutes": 60,
        "trainer_name": coach_user.full_name if coach_user else None,
        "coach": {
            "id": coach.id if coach else None,
            "user": {
                "full_name": coach_user.full_name if coach_user else None,
                "email": coach_user.email if coach_user else None
            }
        } if coach else None,
        "branch": gym.name if gym else "Main Branch",
        "gym": {
            "id": gym.id if gym else None,
            "name": gym.name if gym else "Main Branch"
        },
        "customer_notes": booking.customer_notes,
        "notes": booking.customer_notes,
        "coach_notes": booking.coach_notes,
        "created_at": booking.created_at.isoformat() if booking.created_at else None,
        "availability_slot_id": booking.availability_slot_id
    }


# ==================== GET BOOKINGS ====================

@router.get("/my-bookings")
def get_my_bookings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    booking_status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """Get all bookings for current customer with frontend-compatible data"""
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")

    query = db.query(Booking).filter(Booking.customer_id == customer.id)

    if booking_status:
        valid_statuses = ["pending", "confirmed", "cancelled", "upcoming", "attended", "missed", "rescheduled"]
        normalized = booking_status.lower()
        if normalized not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status")
        query = query.filter(Booking.status == normalized)

    if date_from:
        query = query.filter(Booking.session_date >= date_from)
    if date_to:
        query = query.filter(Booking.session_date <= date_to)

    offset = (page - 1) * limit
    bookings = query.order_by(Booking.session_date.desc(), Booking.session_time.desc()).offset(offset).limit(limit).all()

    return [serialize_booking(db, b) for b in bookings]


@router.get("/coach-bookings")
def get_coach_bookings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    booking_status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Get all bookings for current coach"""
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach profile not found")

    query = db.query(Booking).filter(Booking.coach_id == coach.id)

    if booking_status:
        query = query.filter(Booking.status == booking_status.lower())
    if date_from:
        query = query.filter(Booking.session_date >= date_from)
    if date_to:
        query = query.filter(Booking.session_date <= date_to)

    offset = (page - 1) * limit
    bookings = query.order_by(Booking.session_date.desc()).offset(offset).limit(limit).all()

    return [serialize_booking(db, b) for b in bookings]


@router.get("/all")
def get_all_bookings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    booking_status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Get all bookings (OWNER only)"""
    query = db.query(Booking)

    if booking_status:
        query = query.filter(Booking.status == booking_status.lower())
    if date_from:
        query = query.filter(Booking.session_date >= date_from)
    if date_to:
        query = query.filter(Booking.session_date <= date_to)

    offset = (page - 1) * limit
    bookings = query.order_by(Booking.session_date.desc()).offset(offset).limit(limit).all()

    result = []
    for booking in bookings:
        customer = db.query(Customer).filter(Customer.id == booking.customer_id).first()
        customer_user = db.query(User).filter(User.id == customer.user_id).first() if customer else None
        
        coach = db.query(Coach).filter(Coach.id == booking.coach_id).first()
        coach_user = db.query(User).filter(User.id == coach.user_id).first() if coach else None

        result.append({
            "id": booking.id,
            "customer_name": customer_user.full_name if customer_user else "Unknown",
            "customer_email": customer_user.email if customer_user else "Unknown",
            "coach_name": coach_user.full_name if coach_user else "Unknown",
            "coach_email": coach_user.email if coach_user else "Unknown",
            "session_date": booking.session_date.isoformat() if booking.session_date else None,
            "session_time": str(booking.session_time) if booking.session_time else None,
            "status": booking.status,
            "customer_notes": booking.customer_notes,
            "coach_notes": booking.coach_notes,
            "created_at": booking.created_at.isoformat() if booking.created_at else None
        })

    return result


# ==================== CANCEL BOOKING ====================

@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """Cancel booking (CUSTOMER only)"""
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer profile not found")

    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.customer_id == customer.id
    ).first()

    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.status not in ["pending", "confirmed", "upcoming"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel booking with status: {booking.status}"
        )

    booking.status = "cancelled"
    booking.cancelled_at = datetime.utcnow()

    # Re-open the availability slot
    slot = db.query(CoachAvailability).filter(
        CoachAvailability.id == booking.availability_slot_id
    ).first()
    if slot:
        slot.is_active = True

    db.commit()
    db.refresh(booking)
    return serialize_booking(db, booking)


# ==================== CONFIRM BOOKING ====================

@router.put("/{booking_id}/confirm")
def confirm_booking(
    booking_id: int,
    coach_notes: str = None,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Confirm booking (COACH only)"""
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach profile not found")

    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.coach_id == coach.id
    ).first()

    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot confirm a cancelled booking"
        )

    if booking.status not in ["pending", "upcoming"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm booking with status: {booking.status}"
        )

    booking.status = "confirmed"
    if coach_notes:
        booking.coach_notes = coach_notes

    db.commit()
    db.refresh(booking)
    return serialize_booking(db, booking)


# ==================== COMPLETE BOOKING ====================

@router.put("/{booking_id}/complete")
def complete_booking(
    booking_id: int,
    coach_notes: str = None,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Mark booking as completed/attended (COACH only)"""
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach profile not found")

    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.coach_id == coach.id
    ).first()

    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.status != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Can only complete confirmed bookings. Current status: {booking.status}"
        )

    booking.status = "attended"
    if coach_notes:
        booking.coach_notes = coach_notes

    db.commit()
    db.refresh(booking)
    return serialize_booking(db, booking)


# ==================== MARK MISSED ====================

@router.put("/{booking_id}/miss")
def mark_booking_missed(
    booking_id: int,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Mark booking as missed (COACH only)"""
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach profile not found")

    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.coach_id == coach.id
    ).first()

    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.status not in ["confirmed", "upcoming"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot mark as missed. Current status: {booking.status}"
        )

    booking.status = "missed"
    db.commit()
    db.refresh(booking)
    return serialize_booking(db, booking)


# ==================== RESCHEDULE BOOKING (CUSTOMER) ====================

@router.post("/{booking_id}/reschedule", status_code=status.HTTP_200_OK)
def reschedule_booking(
    booking_id: int,
    reschedule_data: RescheduleRequest,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Reschedule booking to new time slot (CUSTOMER only)
    """
    # Get customer
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")

    # Get original booking
    original_booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.customer_id == customer.id
    ).first()

    if not original_booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Validate status
    if original_booking.status not in ["pending", "confirmed", "upcoming"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reschedule booking with status: {original_booking.status}"
        )

    # Check if booking is in the past
    original_session_datetime = datetime.combine(original_booking.session_date, original_booking.session_time)
    if original_session_datetime < datetime.now():
        raise HTTPException(status_code=400, detail="Cannot reschedule past bookings")

    # Get new slot
    new_slot = db.query(CoachAvailability).filter(
        CoachAvailability.id == reschedule_data.new_availability_slot_id
    ).first()

    if not new_slot:
        # Get available slots for better error message
        available_slots = db.query(CoachAvailability).filter(
            CoachAvailability.is_active == True
        ).limit(5).all()
        
        slot_list = ", ".join([f"ID {s.id} ({s.specific_date} {s.start_time})" for s in available_slots])
        
        raise HTTPException(
            status_code=404, 
            detail=f"Slot {reschedule_data.new_availability_slot_id} not found. Available slots: {slot_list}"
        )

    # Check if slot is already booked
    if not new_slot.is_active:
        raise HTTPException(
            status_code=400,
            detail=f"Slot {new_slot.id} is already booked or inactive"
        )

    # Determine coach
    new_coach_id = reschedule_data.new_coach_id or original_booking.coach_id or new_slot.coach_id
    
    # Verify coach exists
    new_coach = db.query(Coach).filter(Coach.id == new_coach_id).first()
    if not new_coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    # Check for double-booking at new time
    existing_conflict = db.query(Booking).filter(
        Booking.customer_id == customer.id,
        Booking.id != booking_id,
        Booking.session_date == new_slot.specific_date,
        Booking.session_time == new_slot.start_time,
        Booking.status.in_(["pending", "confirmed", "upcoming"])
    ).first()

    if existing_conflict:
        raise HTTPException(
            status_code=400,
            detail="You already have another booking at this time"
        )

    # Get original slot to free it up
    original_slot = db.query(CoachAvailability).filter(
        CoachAvailability.id == original_booking.availability_slot_id
    ).first()

    # === DATABASE OPERATIONS ===

    # 1. Mark original booking as 'rescheduled'
    original_booking.status = "rescheduled"
    original_booking.cancellation_reason = f"Rescheduled to slot {new_slot.id}. Reason: {reschedule_data.reschedule_reason or 'No reason provided'}"
    original_booking.cancelled_at = datetime.utcnow()
    original_booking.updated_at = datetime.utcnow()

    # 2. Free up original slot
    if original_slot:
        original_slot.is_active = True
        original_slot.updated_at = datetime.utcnow()

    # 3. Create NEW booking for rescheduled session
    new_booking = Booking(
        customer_id=customer.id,
        coach_id=new_coach_id,
        availability_slot_id=new_slot.id,
        gym_id=new_coach.gym_id if new_coach else original_booking.gym_id,
        subscription_id=original_booking.subscription_id,
        session_date=new_slot.specific_date,
        session_time=new_slot.start_time,
        status="upcoming",
        customer_notes=f"Rescheduled from booking #{booking_id}. {original_booking.customer_notes or ''}",
        session_type=original_booking.session_type,
        title=original_booking.title,
        duration_minutes=original_booking.duration_minutes
    )

    # 4. Mark new slot as unavailable
    new_slot.is_active = False
    new_slot.updated_at = datetime.utcnow()

    db.add(new_booking)
    db.commit()
    db.refresh(original_booking)
    db.refresh(new_booking)

    return {
        "message": "Booking rescheduled successfully",
        "original_booking": {
            "id": original_booking.id,
            "status": original_booking.status,
            "old_date": original_booking.session_date.isoformat(),
            "old_time": str(original_booking.session_time)
        },
        "new_booking": serialize_booking(db, new_booking),
        "rescheduled_at": datetime.utcnow().isoformat()
    }


# ==================== RESCHEDULE BOOKING (COACH) ====================

@router.post("/{booking_id}/coach-reschedule", status_code=status.HTTP_200_OK)
def coach_reschedule_booking(
    booking_id: int,
    reschedule_data: CoachRescheduleRequest,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """
    Coach reschedules a customer's booking
    - Original booking marked as 'rescheduled'
    - New booking created automatically
    """
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach profile not found")

    # Get booking - must belong to this coach
    original_booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.coach_id == coach.id
    ).first()

    if not original_booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found or not assigned to you")

    if original_booking.status not in ["confirmed", "upcoming", "pending"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reschedule booking with status: {original_booking.status}"
        )

    # Get new slot - must be coach's own slot
    new_slot = db.query(CoachAvailability).filter(
        CoachAvailability.id == reschedule_data.new_availability_slot_id,
        CoachAvailability.coach_id == coach.id,
        CoachAvailability.is_active == True
    ).first()

    if not new_slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability slot not found, not available, or not your slot"
        )

    # Check customer doesn't have conflict at new time
    existing_conflict = db.query(Booking).filter(
        Booking.customer_id == original_booking.customer_id,
        Booking.id != booking_id,
        Booking.session_date == new_slot.specific_date,
        Booking.session_time == new_slot.start_time,
        Booking.status.in_(["pending", "confirmed", "upcoming"])
    ).first()

    if existing_conflict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer already has another booking at this time"
        )

    # === DATABASE OPERATIONS ===

    # 1. Mark original as rescheduled
    original_booking.status = "rescheduled"
    original_booking.cancellation_reason = f"Coach rescheduled to slot {new_slot.id}. Reason: {reschedule_data.reschedule_reason or 'Schedule change'}"
    original_booking.coach_notes = f"Rescheduled by coach. {original_booking.coach_notes or ''}"
    original_booking.cancelled_at = datetime.utcnow()

    # 2. Free original slot
    original_slot = db.query(CoachAvailability).filter(
        CoachAvailability.id == original_booking.availability_slot_id
    ).first()
    if original_slot:
        original_slot.is_active = True

    # 3. Create new booking
    new_booking = Booking(
        customer_id=original_booking.customer_id,
        coach_id=coach.id,
        availability_slot_id=new_slot.id,
        gym_id=coach.gym_id or original_booking.gym_id,
        subscription_id=original_booking.subscription_id,
        session_date=new_slot.specific_date,
        session_time=new_slot.start_time,
        status="confirmed",
        customer_notes=original_booking.customer_notes,
        coach_notes=f"Rescheduled from booking #{booking_id} by coach. {reschedule_data.reschedule_reason or ''}",
        session_type=original_booking.session_type,
        title=original_booking.title,
        duration_minutes=original_booking.duration_minutes
    )

    # 4. Mark new slot unavailable
    new_slot.is_active = False

    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)

    return {
        "message": "Booking rescheduled by coach successfully",
        "original_booking_id": original_booking.id,
        "new_booking": serialize_booking(db, new_booking),
        "customer_notified": reschedule_data.notify_customer
    }


# ==================== UPDATE BOOKING NOTES ====================

@router.put("/{booking_id}/notes")
def update_booking_notes(
    booking_id: int,
    notes_data: dict,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """Update customer notes for a booking"""
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.customer_id == customer.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking.customer_notes = notes_data.get('customer_notes')
    db.commit()
    db.refresh(booking)
    
    return serialize_booking(db, booking)
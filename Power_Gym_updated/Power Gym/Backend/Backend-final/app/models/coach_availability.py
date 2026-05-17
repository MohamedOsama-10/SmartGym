# app/models/coach_availability.py
from sqlalchemy import Column, Integer, Date, Time, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class CoachAvailability(Base):
    __tablename__ = "coach_availability"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    coach_id = Column(Integer, ForeignKey("coaches.id", ondelete="CASCADE"), nullable=False)
    
    # Use specific_date instead of date
    specific_date = Column(Date, nullable=True)
    day_of_week = Column(Integer, nullable=False)  # 1-7 for Monday-Sunday
    
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    
    slot_duration_minutes = Column(Integer, default=60)
    max_bookings_per_slot = Column(Integer, default=1)
    
    is_recurring = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)  # Use is_active instead of is_available
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    coach = relationship("Coach", back_populates="availability_slots")
    bookings = relationship("Booking", back_populates="availability_slot")
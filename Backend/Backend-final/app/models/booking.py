from sqlalchemy import Column, Integer, String, DateTime, Date, Time, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    coach_id = Column(Integer, ForeignKey("coaches.id"), nullable=True)
    availability_slot_id = Column(Integer, ForeignKey("coach_availability.id"), nullable=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)

    session_date = Column(Date, nullable=False)
    session_time = Column(Time, nullable=False)

    session_type = Column(String(20), nullable=True)
    title = Column(String(200), nullable=True)
    duration_minutes = Column(Integer, default=60)
    status = Column(String(20), nullable=False, default="upcoming")

    branch = Column(String(100), nullable=True)
    trainer_name = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    customer_notes = Column(Text, nullable=True)
    coach_notes = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    customer = relationship("Customer", back_populates="bookings")
    coach = relationship("Coach", back_populates="bookings")
    gym = relationship("Gym", back_populates="bookings")
    availability_slot = relationship("CoachAvailability")
    subscription = relationship("Subscription", back_populates="bookings")
    review = relationship("Review", back_populates="booking", uselist=False)
    # REMOVED: review relationship - it's created automatically by backref in Review model
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from app.database import Base

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    coach_id = Column(Integer, ForeignKey("coaches.id"), nullable=False)
    
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships - using back_populates (requires defining on both sides)
    booking = relationship("Booking", back_populates="review")
    customer = relationship("Customer", back_populates="reviews")
    coach = relationship("Coach", back_populates="reviews")
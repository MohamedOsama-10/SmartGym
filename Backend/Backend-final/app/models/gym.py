# app/models/gym.py
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Gym(Base):
    __tablename__ = "gyms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    image_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    total_members = Column(Integer, default=0)
    active_members = Column(Integer, default=0)
    total_coaches = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    customers = relationship("Customer", back_populates="gym", cascade="all, delete-orphan")
    coaches = relationship("Coach", back_populates="gym", cascade="all, delete-orphan")
    admins = relationship("Admin", back_populates="gym", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="gym", cascade="all, delete-orphan")

    @property
    def status(self) -> str:
        return "Active" if self.is_active else "Inactive"
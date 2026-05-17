from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, Boolean, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class CoachEducation(Base):
    __tablename__ = "coach_education"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    coach_id = Column(Integer, ForeignKey("coaches.id", ondelete="CASCADE"), nullable=False)
    degree = Column(String(100), nullable=False)
    institution = Column(String(200), nullable=False)
    field_of_study = Column(String(100), nullable=True)
    start_year = Column(Integer, nullable=True)
    end_year = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    coach = relationship("Coach", back_populates="education")


class CoachExperience(Base):
    __tablename__ = "coach_experience"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    coach_id = Column(Integer, ForeignKey("coaches.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    company = Column(String(200), nullable=False)
    location = Column(String(200), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_current = Column(Boolean, default=False)
    description = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    coach = relationship("Coach", back_populates="experience")


class Coach(Base):
    __tablename__ = "coaches"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=True)
    specialty = Column(String(100), nullable=True)
    experience_years = Column(Integer, nullable=True)
    hourly_rate = Column(Float, nullable=True)
    rating = Column(Float, default=0.0)
    total_reviews = Column(Integer, default=0)
    max_clients = Column(Integer, default=30)
    current_clients = Column(Integer, default=0)
    is_featured = Column(Boolean, default=False)
    is_available = Column(Boolean, default=True)
    cv_url = Column(String(500), nullable=True)
    social_facebook = Column(String(200), nullable=True)
    social_instagram = Column(String(200), nullable=True)
    social_twitter = Column(String(200), nullable=True)
    social_linkedin = Column(String(200), nullable=True)
    social_youtube = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="coach_profile")
    gym = relationship("Gym", back_populates="coaches")
    assigned_customers = relationship("Customer", back_populates="assigned_coach")
    availability_slots = relationship("CoachAvailability", back_populates="coach", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="coach")
    reviews = relationship("Review", back_populates="coach")
    
    # Updated relationships - use Certification from certification.py
    # In coach.py Coach class, change this line:
    certifications = relationship("Certification", back_populates="coach", cascade="all, delete-orphan", lazy="dynamic")
    education = relationship("CoachEducation", back_populates="coach", cascade="all, delete-orphan", lazy="dynamic")
    experience = relationship("CoachExperience", back_populates="coach", cascade="all, delete-orphan", lazy="dynamic")
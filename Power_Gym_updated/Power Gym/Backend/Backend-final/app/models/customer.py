# app/models/customer.py
from sqlalchemy import Column, Integer, Float, String, ForeignKey, Date, Boolean, DateTime, Text
from sqlalchemy.orm import relationship, validates
from app.database import Base
from datetime import datetime

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Gym association
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=True)
    
    # Body metrics
    height = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    goal = Column(String(50), nullable=True)
    weight_goal = Column(Float, nullable=True)
    
    # Membership info
    membership_id = Column(String(50), nullable=True)
    assigned_coach_id = Column(Integer, ForeignKey("coaches.id"), nullable=True)
    joined_date = Column(Date, nullable=True)
    
    # Profile info
    full_name = Column(String(255), nullable=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    
    # Emergency contact
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_relationship = Column(String(50), nullable=True)
    
    # Preferences
    notifications_enabled = Column(Boolean, nullable=True, default=True)
    email_updates_enabled = Column(Boolean, nullable=True, default=True)
    public_profile = Column(Boolean, nullable=True, default=False)
    
    # Profile fields
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="customer_profile")
    gym = relationship("Gym", back_populates="customers")
    assigned_coach = relationship("Coach", foreign_keys=[assigned_coach_id])
    bookings = relationship("Booking", back_populates="customer", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="customer", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="customer")
    meals = relationship("Meal", back_populates="customer", cascade="all, delete-orphan")
    meal_logs = relationship("MealLog", back_populates="customer", cascade="all, delete-orphan")
    nutrition_goal = relationship("NutritionGoal", back_populates="customer", uselist=False)
    
    # Validators
    @validates('goal')
    def validate_goal(self, key, value):
        if value is None or value == '':
            return None
        allowed_goals = ['weight-loss', 'muscle-gain', 'maintenance', 'endurance', 'flexibility']
        if value not in allowed_goals:
            raise ValueError(f"Goal must be one of: {', '.join(allowed_goals)}")
        return value
    
    @validates('height', 'weight', 'weight_goal')
    def validate_numeric_fields(self, key, value):
        if value == 0 or value == 0.0:
            return None
        return value
# app/models/meal.py
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Time, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Meal(Base):
    __tablename__ = "meals"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    
    # Meal details
    name = Column(String(200), nullable=False)
    type = Column(String(20), nullable=False)  # breakfast, lunch, dinner, snack
    calories = Column(Integer, nullable=False)
    protein = Column(Float, nullable=False)
    carbs = Column(Float, nullable=False)
    fats = Column(Float, nullable=False)
    image_url = Column(String(500), nullable=True)
    ingredients = Column(Text, nullable=True)  # JSON string or comma-separated
    
    is_favorite = Column(Boolean, default=False)
    is_custom = Column(Boolean, default=True)  # True if user-created, False if system
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    customer = relationship("Customer", back_populates="meals")
    meal_logs = relationship("MealLog", back_populates="meal", cascade="all, delete-orphan")


class MealLog(Base):
    __tablename__ = "meal_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    meal_id = Column(Integer, ForeignKey("meals.id", ondelete="NO ACTION"), nullable=False)
    
    servings = Column(Float, default=1.0)
    log_date = Column(Date, nullable=False)  # Added
    log_time = Column(Time, nullable=False)  # Added
    logged_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    customer = relationship("Customer", back_populates="meal_logs")
    meal = relationship("Meal", back_populates="meal_logs")


class NutritionGoal(Base):
    __tablename__ = "nutrition_goals"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    calories = Column(Integer, default=2500)
    protein = Column(Float, default=180)
    carbs = Column(Float, default=250)
    fats = Column(Float, default=80)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship
    customer = relationship("Customer", back_populates="nutrition_goal")

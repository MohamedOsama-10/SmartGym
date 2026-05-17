from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base

class MembershipPlan(Base):
    __tablename__ = "membership_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, nullable=True)
    name = Column(String(100), nullable=False)
    period = Column(String(50), nullable=True)
    price = Column(Float, nullable=False)
    original_price = Column(Float, nullable=True)
    savings = Column(Float, nullable=True)
    sessions = Column(String(50), nullable=True)  # Keep as String for flexibility, or change to Integer if needed
    price_per_session = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    features = Column(Text, nullable=True)
    is_popular = Column(Boolean, default=False)
    color = Column(String(20), default="blue")
    icon = Column(String(10), default="📅")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.sysdatetime())
    updated_at = Column(DateTime, default=func.sysdatetime(), onupdate=func.sysdatetime())
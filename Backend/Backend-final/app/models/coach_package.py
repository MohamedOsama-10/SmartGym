from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class CoachPackage(Base):
    __tablename__ = "coach_packages"

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("coaches.id"), nullable=False)
    package_name = Column(String(100), nullable=False)
    period = Column(String(50), nullable=True)
    sessions = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    original_price = Column(Float, nullable=True)
    savings = Column(Float, nullable=True)
    price_per_session = Column(Float, nullable=True)
    features = Column(Text, nullable=True)
    is_popular = Column(Boolean, default=False)
    color = Column(String(20), default="blue")
    is_active = Column(Boolean, default=True)
    status = Column(String(20), default="pending")
    rejection_reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=func.sysdatetime())
    updated_at = Column(DateTime, default=func.sysdatetime(), onupdate=func.sysdatetime())
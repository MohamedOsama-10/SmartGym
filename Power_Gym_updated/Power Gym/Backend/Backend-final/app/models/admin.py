# app/models/admin.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    gym_id = Column(Integer, ForeignKey("gyms.id", ondelete="SET NULL"), nullable=True)
    
    # Admin-specific fields
    department = Column(String(100), nullable=True)
    permissions = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    employee_id = Column(String(50), unique=True, nullable=True)
    hire_date = Column(DateTime, nullable=True)
    is_super_admin = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="admin_profile")
    gym = relationship("Gym", back_populates="admins")
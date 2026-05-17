from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    
    # Foreign keys - ONE of these should be set, not both
    plan_id = Column(Integer, ForeignKey("membership_plans.id"), nullable=True)
    coach_package_id = Column(Integer, ForeignKey("coach_packages.id"), nullable=True)  # ADD THIS LINE
    
    # Plan details (denormalized for display)
    plan_name = Column(String(100), nullable=False, default="Basic Plan")
    plan_type = Column(String(50), nullable=True)  # 'gym' or 'coach_package'
    
    # Pricing
    price = Column(Float, default=0.0)
    billing_cycle = Column(String(20), default="monthly")
    
    # Dates
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Status
    status = Column(String(20), default="active")  # active, expired, cancelled
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    sessions_remaining = Column(Integer, nullable=True, default=0)

    # Relationships
    customer = relationship("Customer", back_populates="subscriptions")
    plan = relationship("MembershipPlan", foreign_keys=[plan_id])  # Specify foreign_keys
    coach_package = relationship("CoachPackage", foreign_keys=[coach_package_id])  # ADD THIS
    bookings = relationship("Booking", back_populates="subscription")
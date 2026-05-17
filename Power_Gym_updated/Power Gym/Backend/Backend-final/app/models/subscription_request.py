from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class SubscriptionRequest(Base):
    __tablename__ = "subscription_requests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("membership_plans.id"), nullable=True)
    coach_package_id = Column(Integer, ForeignKey("coach_packages.id"), nullable=True)
    plan_name = Column(String(100), nullable=False)
    requested_price = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)       # discount amount in currency
    discount_pct = Column(Float, default=0.0)   # discount as percentage
    final_price = Column(Float, nullable=True)
    status = Column(String(20), default="pending")  # pending, approved, rejected
    notes = Column(String(500), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("Customer", foreign_keys=[customer_id])
    approver = relationship("User", foreign_keys=[approved_by])

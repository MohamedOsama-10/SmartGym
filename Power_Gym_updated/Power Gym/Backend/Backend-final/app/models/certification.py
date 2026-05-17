#D:\gym_system\Gym_Backend\app\models\certification.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Certification(Base):
    __tablename__ = "coach_certifications"  # Changed from "certifications" to "coach_certifications"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    coach_id = Column(Integer, ForeignKey("coaches.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)  # Changed from "name" to "title"
    issuing_organization = Column(String(200), nullable=True)
    issue_date = Column(DateTime(timezone=True), nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    credential_id = Column(String(100), nullable=True)
    is_verified = Column(Boolean, default=False)  # Added missing column
    certificate_url = Column(String(500), nullable=True)  # Added missing column
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
# In certification.py, make sure this line exists:
    coach = relationship("Coach", back_populates="certifications")
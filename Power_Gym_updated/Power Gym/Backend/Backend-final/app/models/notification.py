# app/models/notification.py
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, String, UnicodeText
from sqlalchemy.sql import func
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), default="system")   # system | subscription | workout | package | booking | message
    title = Column(String(200), nullable=False)
    message = Column(UnicodeText, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    link = Column(String(500), nullable=True)      # frontend route e.g. /workouts
    created_at = Column(DateTime(timezone=True), server_default=func.now())

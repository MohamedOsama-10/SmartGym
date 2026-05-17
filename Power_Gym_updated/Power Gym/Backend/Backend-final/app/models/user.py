# app/models/user.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(255), nullable=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    role = Column(String(20), nullable=False)  # admin, owner, coach, user
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Role-based profile relationships
    coach_profile = relationship("Coach", back_populates="user", uselist=False)
    customer_profile = relationship("Customer", back_populates="user", uselist=False)
    admin_profile = relationship("Admin", back_populates="user", uselist=False)
    owner_profile = relationship("Owner", back_populates="user", uselist=False)

    # Chat relationships
    coach_conversations = relationship(
        "Conversation",
        foreign_keys="Conversation.coach_user_id",
        back_populates="coach",
    )
    customer_conversations = relationship(
        "Conversation",
        foreign_keys="Conversation.customer_user_id",
        back_populates="customer",
    )
    sent_messages = relationship(
        "ChatMessage",
        foreign_keys="ChatMessage.sender_user_id",
        back_populates="sender",
    )

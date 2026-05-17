# app/models/conversation.py
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, UnicodeText
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # FIXED: Use NO ACTION for one foreign key to avoid multiple cascade paths
    coach_user_id = Column(Integer, ForeignKey("users.id", ondelete="NO ACTION"), nullable=False)
    customer_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Per-user clear timestamps — when a user clears their chat, we record the
    # time here. GET /messages filters out messages older than this timestamp
    # for that user, so the other participant's view is unaffected.
    coach_cleared_at = Column(DateTime(timezone=True), nullable=True)
    customer_cleared_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan")
    coach = relationship("User", foreign_keys=[coach_user_id], back_populates="coach_conversations")
    customer = relationship("User", foreign_keys=[customer_user_id], back_populates="customer_conversations")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    
    # FIXED: Use NO ACTION to avoid cascade conflicts
    sender_user_id = Column(Integer, ForeignKey("users.id", ondelete="NO ACTION"), nullable=False)
    
    text = Column(UnicodeText, nullable=True)
    media_url = Column(UnicodeText, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_user_id], back_populates="sent_messages")

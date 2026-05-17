# D:\gym_system\Gym_Backend\app\models\models_with_relationships.py
from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Coach(Base):
    __tablename__ = "coaches"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=True)
    experience_years = Column(Integer)
    hourly_rate = Column(Float)
    rate = Column(Float)
    
    # Relationships
    user = relationship("User", back_populates="coach_profile")
    gym = relationship("Gym")
    availability_slots = relationship("CoachAvailability", back_populates="coach", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="coach")


# app/models/customer.py
from sqlalchemy import Column, Integer, Float, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    height = Column(Float)
    weight = Column(Float)
    goal = Column(String(255))
    weight_goal = Column(Float)
    
    # Relationships
    user = relationship("User", back_populates="customer_profile")
    bookings = relationship("Booking", back_populates="customer", cascade="all, delete-orphan")


# app/models/user.py (UPDATED - add relationships)
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(100))
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)  # OWNER, COACH, CUSTOMER
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships (one user can have one profile based on role)
    coach_profile = relationship("Coach", back_populates="user", uselist=False)
    customer_profile = relationship("Customer", back_populates="user", uselist=False)


# app/models/gym.py
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Gym(Base):
    __tablename__ = "gyms"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100))
    location = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
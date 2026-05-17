from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from enum import Enum
from typing import Optional

class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    COACH = "coach"
    USER = "user"

class UserSignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value):
        if isinstance(value, str):
            value = value.strip().lower()
        return value

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: UserRole
    
    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value):
        if isinstance(value, str):
            value = value.strip().lower()
        return value

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    phone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class MessageResponse(BaseModel):
    message: str
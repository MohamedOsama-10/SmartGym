from pydantic import BaseModel, Field, validator, EmailStr
from typing import Optional, Literal
from datetime import datetime


class UserSignupRequest(BaseModel):
    full_name: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: Literal['user', 'coach', 'owner', 'admin'] = 'user'
    
    # Optional fields - will be stored in Customer table, not User
    phone: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    weight_goal: Optional[float] = None
    goal: Optional[str] = None

    @validator('goal')
    def validate_goal(cls, v):
        if not v or v == '':
            return None
        allowed = ['weight-loss', 'muscle-gain', 'maintenance', 'endurance', 'flexibility']
        if v and v not in allowed:
            raise ValueError(f"Invalid goal. Must be one of: {', '.join(allowed)}")
        return v

    @validator('height', 'weight', 'weight_goal')
    def validate_numeric_fields(cls, v):
        if v == 0 or v == 0.0:
            return None
        return v


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict
    
    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    phone: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
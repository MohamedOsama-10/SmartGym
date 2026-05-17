from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ==================== ADMIN SCHEMAS ====================

class AdminProfileBase(BaseModel):
    department: Optional[str] = Field(None, max_length=100)
    permissions: Optional[str] = None  # JSON string
    phone: Optional[str] = Field(None, max_length=50)
    employee_id: Optional[str] = Field(None, max_length=50)
    hire_date: Optional[datetime] = None
    is_super_admin: bool = False
    gym_id: Optional[int] = None  # NEW: Allow assigning/changing gym


class AdminProfileCreate(AdminProfileBase):
    pass


class AdminProfileUpdate(AdminProfileBase):
    pass


class AdminProfileResponse(AdminProfileBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AdminWithUser(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    created_at: datetime
    admin_profile: Optional[AdminProfileResponse] = None

    class Config:
        from_attributes = True


# ==================== OWNER SCHEMAS ====================

class OwnerProfileBase(BaseModel):
    company_name: Optional[str] = Field(None, max_length=255)
    business_registration: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    emergency_contact: Optional[str] = None  # JSON string


class OwnerProfileCreate(OwnerProfileBase):
    pass


class OwnerProfileUpdate(OwnerProfileBase):
    pass


class OwnerProfileResponse(OwnerProfileBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class OwnerWithUser(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    created_at: datetime
    owner_profile: Optional[OwnerProfileResponse] = None

    class Config:
        from_attributes = True
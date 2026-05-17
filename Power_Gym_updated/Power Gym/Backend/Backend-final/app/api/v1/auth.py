#D:\gym_system\Gym_Backend\app\api\v1\auth.py


from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from datetime import datetime, timedelta
from app.database import get_db
from app.schemas.auth import (
    UserSignupRequest, 
    UserResponse, 
    UserLoginRequest, 
    TokenResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse
)
from app.models.user import User
from app.models.customer import Customer
from app.models.coach import Coach
from app.models.admin import Admin
from app.models.owner import Owner
from app.models.token_blacklist import TokenBlacklist
from app.core.security import (
    hash_password, 
    verify_password, 
    create_access_token,
    create_refresh_token,
    create_reset_token,
    verify_reset_token,
    verify_refresh_token
)
from app.services.email_service import send_reset_password_email
from jose import jwt, JWTError
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── TEMPORARY: hash generator — REMOVE AFTER USE ─────────────────────────────
@router.get("/make-hash")
def make_hash(password: str):
    """Temporary endpoint to generate a bcrypt hash. Remove after use."""
    return {"hash": hash_password(password)}
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: UserSignupRequest, db: Session = Depends(get_db)):
    """
    Register a new user with manual profile creation.
    Handles duplicate key errors gracefully.
    ✅ FIXED: Properly handles phone number in both users and customers tables
    """
    try:
        # Check if email exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # ✅ Validate membership_id — required for members, must match a pre-created record
        membership_id = getattr(user_data, 'membership_id', None)
        role_check = user_data.role.value if hasattr(user_data.role, 'value') else user_data.role
        if role_check == "user" and not membership_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Membership ID is required. Please enter the ID provided by your gym admin."
            )
        if membership_id:
            membership_id = str(membership_id).strip()
            # Check in customers table (member pre-created by admin)
            customer_match = db.query(Customer).filter(
                Customer.membership_id == membership_id
            ).first()
            # Check in users table as placeholder (staff pre-created by admin)
            placeholder_pattern = f"PENDING_{membership_id}_%@system.gym"
            staff_match = db.query(User).filter(
                User.email.like(placeholder_pattern)
            ).first()

            if not customer_match and not staff_match:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Membership ID not found. Please check your ID or contact your gym admin."
                )

            # Check if already claimed
            if customer_match:
                owner = db.query(User).filter(User.id == customer_match.user_id).first()
                if owner and owner.email and "@system.gym" not in owner.email:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="This Membership ID has already been claimed. Please log in instead."
                    )
            if staff_match and "@system.gym" not in staff_match.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This Staff ID has already been claimed. Please log in instead."
                )
        
        # Get role value
        role_value = user_data.role.value if hasattr(user_data.role, 'value') else user_data.role
        
        # ✅ CRITICAL FIX: Extract phone and clean it
        phone_value = getattr(user_data, 'phone', None)
        if phone_value:
            phone_value = phone_value.strip() if phone_value.strip() else None
        
        print(f"📞 Signup - Phone received: '{phone_value}'")
        
        # Create new user with phone
        new_user = User(
            full_name=user_data.full_name,
            email=user_data.email,
            password_hash=hash_password(user_data.password),
            role=role_value,
            phone=phone_value  # ✅ Phone is now saved to users table
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Store ID and email before any other queries
        user_id = new_user.id
        user_email = new_user.email
        user_phone = new_user.phone  # ✅ Get phone from saved user
        
        print(f"✅ Created user {user_email} with phone: '{user_phone}'")
        
        # ✅ If membership_id provided, link new user to the pre-created placeholder record
        membership_id = getattr(user_data, 'membership_id', None)
        if membership_id:
            membership_id = str(membership_id).strip()
            # Link customer record
            pre_customer = db.query(Customer).filter(Customer.membership_id == membership_id).first()
            if pre_customer:
                pre_user = db.query(User).filter(User.id == pre_customer.user_id).first()
                if pre_user:
                    # Transfer data to the pre-created user instead of using new_user
                    pre_user.full_name = user_data.full_name
                    pre_user.email = user_data.email
                    pre_user.password_hash = hash_password(user_data.password)
                    pre_user.is_active = True
                    pre_customer.full_name = user_data.full_name
                    pre_customer.email = user_data.email
                    db.delete(new_user)  # Remove the newly created duplicate
                    db.commit()
                    db.refresh(pre_user)
                    return {
                        "id": pre_user.id,
                        "full_name": pre_user.full_name,
                        "email": pre_user.email,
                        "role": pre_user.role,
                        "phone": pre_user.phone,
                        "is_active": True,
                        "created_at": pre_user.created_at,
                    }
            # Link staff placeholder record
            placeholder_pattern = f"PENDING_{membership_id}_%@system.gym"
            pre_staff = db.query(User).filter(User.email.like(placeholder_pattern)).first()
            if pre_staff:
                pre_staff.full_name = user_data.full_name
                pre_staff.email = user_data.email
                pre_staff.password_hash = hash_password(user_data.password)
                pre_staff.is_active = True
                db.delete(new_user)  # Remove the newly created duplicate
                db.commit()
                db.refresh(pre_staff)
                return {
                    "id": pre_staff.id,
                    "full_name": pre_staff.full_name,
                    "email": pre_staff.email,
                    "role": pre_staff.role,
                    "phone": pre_staff.phone,
                    "is_active": True,
                    "created_at": pre_staff.created_at,
                }

        # Create profile based on role with duplicate key handling
        if role_value == "coach":
            _ensure_profile_exists(db, "coaches", user_id, user_email, {
                "experience_years": 0,
                "hourly_rate": 0.0,
                "gym_id": None
            })
        
        elif role_value == "user":
            # ✅ CRITICAL FIX: Pass user_phone and other data to customer creation
            _ensure_customer_profile_exists(db, user_id, user_email, user_phone, user_data)
        
        elif role_value == "owner":
            _ensure_profile_exists(db, "owners", user_id, user_email, {
                "company_name": "My Gym",
                "business_registration": None,
                "emergency_contact": None
            })
        
        elif role_value == "admin":
            _ensure_profile_exists(db, "admins", user_id, user_email, {
                "gym_id": None,
                "department": "General",
                "permissions": None,
                "employee_id": None,
                "hire_date": None,
                "is_super_admin": 0
            })
        
        return {
            "id": user_id,
            "full_name": new_user.full_name,
            "email": user_email,
            "role": new_user.role,
            "phone": user_phone,  # ✅ Return phone in response
            "is_active": True,
            "created_at": new_user.created_at
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating user: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating user: {str(e)}"
        )


def _ensure_profile_exists(db: Session, table_name: str, user_id: int, user_email: str, default_values: dict):
    """
    Helper function to ensure a profile exists.
    Uses TRY/CATCH to handle duplicate key errors gracefully.
    """
    # Build the INSERT statement dynamically
    columns = ["user_id"] + list(default_values.keys()) + ["created_at"]
    values_placeholders = [":user_id"] + [f":{k}" for k in default_values.keys()] + ["SYSDATETIMEOFFSET()"]
    
    # Use TRY/CATCH to handle duplicate key errors
    sql = text(f"""
        BEGIN TRY
            INSERT INTO {table_name} ({', '.join(columns)})
            VALUES ({', '.join(values_placeholders)});
        END TRY
        BEGIN CATCH
            IF ERROR_NUMBER() = 2627 -- Duplicate key error
                PRINT 'Profile already exists for user {user_id}, skipping...';
            ELSE
                THROW;
        END CATCH;
    """)
    
    params = {"user_id": user_id}
    params.update(default_values)
    
    try:
        db.execute(sql, params)
        db.commit()
        print(f"✅ Created {table_name} profile for user {user_email}")
    except Exception as e:
        # Check if it's a duplicate key error
        if "2627" in str(e) or "duplicate key" in str(e).lower():
            print(f"⚠️ {table_name} profile already exists for user {user_email}, continuing...")
            db.rollback()
        else:
            raise


def _ensure_customer_profile_exists(db: Session, user_id: int, user_email: str, user_phone: str, user_data: UserSignupRequest):
    """
    Create customer profile with ALL fields including phone from users table.
    ✅ FIXED: Properly syncs phone from users to customers
    """
    # Extract signup data
    height = getattr(user_data, 'height', None)
    weight = getattr(user_data, 'weight', None)
    weight_goal = getattr(user_data, 'weight_goal', None)
    goal = getattr(user_data, 'goal', None)

    # ✅ Use phone from users table (already saved and cleaned)
    print(f"📞 Creating customer profile with phone: '{user_phone}'")
    
    # Check if profile exists
    existing = db.query(Customer).filter(Customer.user_id == user_id).first()
    if existing:
        print(f"⚠️ Customer profile already exists for user {user_email}, updating...")
        # Update existing profile
        existing.phone = user_phone  # ✅ Sync phone
        existing.full_name = user_data.full_name
        existing.email = user_data.email
        if height is not None:
            existing.height = height
        if weight is not None:
            existing.weight = weight
        if weight_goal is not None:
            existing.weight_goal = weight_goal
        if goal is not None:
            existing.goal = goal
        db.commit()
        print(f"✅ Updated customer profile with phone: '{user_phone}'")
        return

    # Create new profile
    try:
        insert_sql = text("""
            INSERT INTO customers (
                user_id, gym_id, height, weight, goal, weight_goal,
                membership_id, assigned_coach_id, joined_date,
                full_name, email, phone,
                date_of_birth, gender, bio, avatar_url,
                emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                notifications_enabled, email_updates_enabled, public_profile, created_at, updated_at
            ) VALUES (
                :user_id, NULL, :height, :weight, :goal, :weight_goal,
                NULL, NULL, NULL,
                :full_name, :email, :phone,
                NULL, NULL, NULL, NULL,
                NULL, NULL, NULL,
                1, 1, 0, SYSDATETIMEOFFSET(), NULL
            )
        """)

        db.execute(insert_sql, {
            "user_id": user_id,
            "height": height,
            "weight": weight,
            "weight_goal": weight_goal,
            "goal": goal,
            "full_name": user_data.full_name,
            "email": user_data.email,
            "phone": user_phone  # ✅ Use phone from users table
        })
        db.commit()
        print(f"✅ Created customer profile for user {user_email} with phone: '{user_phone}'")
        
    except IntegrityError:
        db.rollback()
        print(f"⚠️ Customer profile already exists (duplicate key), updating...")
        existing = db.query(Customer).filter(Customer.user_id == user_id).first()
        if existing:
            existing.phone = user_phone
            existing.full_name = user_data.full_name
            existing.email = user_data.email
            if height is not None:
                existing.height = height
            if weight is not None:
                existing.weight = weight
            if weight_goal is not None:
                existing.weight_goal = weight_goal
            if goal is not None:
                existing.goal = goal
            db.commit()
            print(f"✅ Updated customer profile with phone: '{user_phone}'")


class ClaimAccountRequest(BaseModel):
    membership_id: str
    full_name: str
    email: str
    password: str


@router.post("/claim-account", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def claim_account(data: ClaimAccountRequest, db: Session = Depends(get_db)):
    """
    A pre-registered member or staff (coach/admin) claims their account using
    the ID assigned by admin (membership_id for members, staff_id for coaches).
    """
    from sqlalchemy import or_

    user = None
    customer = None

    # 1. Try member flow: Customer.membership_id
    customer = db.query(Customer).filter(Customer.membership_id == data.membership_id).first()
    if customer:
        user = db.query(User).filter(User.id == customer.user_id).first()
    else:
        # 2. Try staff flow: User with placeholder email PENDING_{id}_%@system.gym
        # Use LIKE to find the placeholder email for this staff_id
        placeholder_pattern = f"PENDING_{data.membership_id}_%@system.gym"
        user = db.query(User).filter(User.email.like(placeholder_pattern)).first()

    if not user:
        raise HTTPException(
            status_code=400,
            detail="ID not found. Please check with your gym admin."
        )

    # If already claimed (real email set)
    if user.email and "@system.gym" not in user.email:
        raise HTTPException(
            status_code=400,
            detail="This ID has already been claimed. Please log in instead."
        )

    # Check new email isn't already used by someone else
    existing = db.query(User).filter(User.email == data.email, User.id != user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    # Claim the account
    user.full_name = data.full_name
    user.email = data.email
    user.password_hash = hash_password(data.password)
    user.is_active = True

    # Sync member record if applicable
    if customer:
        customer.full_name = data.full_name
        customer.email = data.email

    # Sync coach record if applicable
    if user.role == "coach":
        coach = db.query(Coach).filter(Coach.user_id == user.id).first()
        if coach:
            coach.is_available = True

    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role}
    )
    refresh_token = create_refresh_token(
        data={"sub": user.email, "user_id": user.id}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "phone": user.phone,
            "is_active": True,
            "created_at": user.created_at,
        },
    }


@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Login user and return JWT access token + refresh token
    """
    # Find user by email
    user = db.query(User).filter(User.email == login_data.email).first()
    
    # Check if user exists
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role}
    )
    
    # Create refresh token
    refresh_token = create_refresh_token(
        data={"sub": user.email, "user_id": user.id}
    )
    
    # Return user as a dictionary, not SQLAlchemy model
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "phone": user.phone,
            "is_active": True,
            "created_at": user.created_at
        }
    }


@router.post("/refresh", response_model=dict)
def refresh_access_token(refresh_token: str, db: Session = Depends(get_db)):
    """
    Generate new access token using refresh token
    """
    # Verify refresh token
    email = verify_refresh_token(refresh_token)
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    # Check if refresh token is blacklisted
    blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.token == refresh_token).first()
    if blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked"
        )
    
    # Get user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Create new access token
    new_access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role}
    )
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }


@router.post("/logout", response_model=MessageResponse)
def logout(
    authorization: str = Header(...),
    refresh_token: str = None,
    db: Session = Depends(get_db)
):
    """
    Logout user by blacklisting their access token and refresh token
    """
    try:
        # Extract access token from "Bearer <token>"
        access_token = authorization.replace("Bearer ", "")
        
        # Decode access token — allow expired tokens so logout always works
        try:
            payload = jwt.decode(
                access_token, settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": False}
            )
            exp_timestamp = payload.get("exp")
            expires_at = datetime.fromtimestamp(exp_timestamp) if exp_timestamp else datetime.utcnow()
        except JWTError:
            # Completely invalid token — nothing to blacklist, just succeed
            return {"message": "Successfully logged out"}

        # Blacklist access token
        blacklisted_access = TokenBlacklist(
            token=access_token,
            expires_at=expires_at
        )
        db.add(blacklisted_access)

        # Blacklist refresh token if provided
        if refresh_token:
            try:
                refresh_payload = jwt.decode(
                    refresh_token, settings.SECRET_KEY,
                    algorithms=[settings.ALGORITHM],
                    options={"verify_exp": False}
                )
                refresh_exp = refresh_payload.get("exp")
                refresh_expires_at = datetime.fromtimestamp(refresh_exp) if refresh_exp else datetime.utcnow()
                blacklisted_refresh = TokenBlacklist(
                    token=refresh_token,
                    expires_at=refresh_expires_at
                )
                db.add(blacklisted_refresh)
            except JWTError:
                pass

        db.commit()

        return {"message": "Successfully logged out"}

    except Exception:
        db.rollback()
        return {"message": "Successfully logged out"}


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """Send password reset email to user"""
    # Find user by email
    user = db.query(User).filter(User.email == request.email).first()
    
    # Always return success (don't reveal if email exists for security)
    if not user:
        return {
            "message": "If your email is registered, you will receive a password reset link"
        }
    
    # Create reset token
    reset_token = create_reset_token(user.email)
    
    # Send email
    email_sent = send_reset_password_email(
        email=user.email,
        token=reset_token,
        user_name=user.full_name
    )
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send reset email. Please try again later."
        )
    
    return {
        "message": "If your email is registered, you will receive a password reset link"
    }


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Reset user password using token from email"""
    # Verify token
    email = verify_reset_token(request.token)
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Find user
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password
    user.password_hash = hash_password(request.new_password)
    db.commit()
    
    return {"message": "Password successfully reset"}

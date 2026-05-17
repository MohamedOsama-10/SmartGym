# app/api/v1/profile.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import date, datetime
import os
import uuid
import shutil
from app.utils.cloudinary_upload import upload_file as cloudinary_upload_file, delete_file as cloudinary_delete_file
from PIL import Image
import imghdr

from app.database import get_db
from app.api.deps import get_current_user, require_coach, require_customer
from app.models.user import User
from app.models.coach import Coach, CoachEducation, CoachExperience
from app.models.certification import Certification
from app.models.customer import Customer
from app.models.booking import Booking
from app.models.review import Review
from sqlalchemy import func as sql_func, distinct
from app.schemas.profile import (
    CoachProfileUpdate,
    CustomerProfileUpdate,
    CoachProfileResponse,
    CustomerProfileResponse,
    AvatarUploadResponse,
    CertificationCreate,
    CertificationResponse,
    EducationCreate,
    EducationResponse,
    ExperienceCreate,
    ExperienceResponse,
)

router = APIRouter(prefix="/users/me", tags=["User Profile"])


# ==================== COACH ENDPOINTS ====================

def _get_coach_extra(db: Session, coach_id: int) -> dict:
    """Read migration-added columns (avatar_url, bio) safely via raw SQL."""
    try:
        row = db.execute(
            text("SELECT avatar_url, bio FROM coaches WHERE id = :cid"),
            {"cid": coach_id}
        ).fetchone()
        if row:
            return {"avatar_url": row.avatar_url, "bio": row.bio}
    except Exception:
        pass
    return {"avatar_url": None, "bio": None}


def _build_coach_response(db: Session, coach: Coach, current_user: User) -> CoachProfileResponse:
    """Build a full CoachProfileResponse including certifications, education, experience."""
    extra = _get_coach_extra(db, coach.id)

    # Certifications
    certs = db.query(Certification).filter(Certification.coach_id == coach.id).all()
    cert_list = [
        CertificationResponse(
            id=c.id,
            name=c.title or "",
            issuer=c.issuing_organization,
            date_obtained=c.issue_date.strftime("%Y-%m-%d") if c.issue_date else None,
            expiry_date=c.expiry_date.strftime("%Y-%m-%d") if c.expiry_date else None,
            credential_id=c.credential_id,
            verified=c.is_verified or False,
        )
        for c in certs
    ]

    # Education
    edu_rows = db.query(CoachEducation).filter(CoachEducation.coach_id == coach.id).all()
    edu_list = [
        EducationResponse(
            id=e.id,
            degree=e.degree,
            institution=e.institution,
            graduation_year=e.end_year,
            field_of_study=e.field_of_study,
        )
        for e in edu_rows
    ]

    # Experience
    exp_rows = db.query(CoachExperience).filter(CoachExperience.coach_id == coach.id).all()
    exp_list = [
        ExperienceResponse(
            id=ex.id,
            position=ex.title,
            company=ex.company,
            start_date=ex.start_date.isoformat() if ex.start_date else None,
            end_date=ex.end_date.isoformat() if ex.end_date else None,
            description=ex.description,
            current=ex.is_current or False,
        )
        for ex in exp_rows
    ]

    # Compute real metrics from actual data
    # Total distinct clients (customers with any active or attended booking)
    total_clients = db.query(sql_func.count(distinct(Booking.customer_id))).filter(
        Booking.coach_id == coach.id,
        Booking.status.in_(["upcoming", "confirmed", "attended"])
    ).scalar() or 0

    # Success stories = attended sessions
    success_stories = db.query(sql_func.count(Booking.id)).filter(
        Booking.coach_id == coach.id,
        Booking.status == "attended"
    ).scalar() or 0

    # Average rating from reviews table
    avg_rating = db.query(sql_func.avg(Review.rating)).filter(
        Review.coach_id == coach.id
    ).scalar()
    avg_rating = round(float(avg_rating), 1) if avg_rating else 0.0

    # Total reviews count
    total_reviews = db.query(sql_func.count(Review.id)).filter(
        Review.coach_id == coach.id
    ).scalar() or 0

    return CoachProfileResponse(
        id=coach.id,
        user_id=coach.user_id,
        name=current_user.full_name,
        email=current_user.email,
        phone=current_user.phone,
        gym_id=coach.gym_id,
        specialty=coach.specialty,
        experience_years=coach.experience_years,
        hourly_rate=coach.hourly_rate,
        rating=avg_rating,
        total_reviews=total_reviews,
        total_clients=total_clients,
        success_stories=success_stories,
        is_available=coach.is_available,
        instagram=coach.social_instagram,
        facebook=coach.social_facebook,
        linkedin=coach.social_linkedin,
        youtube=coach.social_youtube,
        cv_url=coach.cv_url,
        bio=extra["bio"],
        avatar_url=extra["avatar_url"],
        certifications=cert_list,
        education=edu_list,
        experience=exp_list,
    )


def _get_or_create_coach(db: Session, user: User) -> Coach:
    """Get existing coach record or create a blank one."""
    coach = db.query(Coach).filter(Coach.user_id == user.id).first()
    if coach:
        return coach
    coach = Coach(user_id=user.id)
    db.add(coach)
    db.commit()
    db.refresh(coach)
    print(f"✅ Auto-created coach profile for user {user.email}")
    return coach


@router.get("/coach-profile", response_model=CoachProfileResponse)
def get_coach_profile(
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Get current coach's full profile"""
    coach = _get_or_create_coach(db, current_user)
    return _build_coach_response(db, coach, current_user)


@router.put("/coach-profile", response_model=CoachProfileResponse)
def update_coach_profile(
    profile_data: CoachProfileUpdate,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Update current coach's profile"""
    coach = _get_or_create_coach(db, current_user)

    data = profile_data.model_dump(exclude_unset=True)

    # Fields that live in the Coach ORM model
    model_fields = {
        "specialty", "experience_years", "hourly_rate", "is_available",
        "rate", "gym_id",
    }
    social_map = {
        "instagram": "social_instagram",
        "facebook":  "social_facebook",
        "linkedin":  "social_linkedin",
        "youtube":   "social_youtube",
    }

    for key, val in data.items():
        if key in model_fields:
            setattr(coach, key, val)
        elif key in social_map:
            setattr(coach, social_map[key], val)

    # Update phone in users table
    if "phone" in data and data["phone"] is not None:
        current_user.phone = data["phone"]

    db.commit()
    db.refresh(coach)

    # Update bio via raw SQL (migration-added column)
    if "bio" in data:
        try:
            db.execute(
                text("UPDATE coaches SET bio = :bio WHERE id = :cid"),
                {"bio": data["bio"], "cid": coach.id}
            )
            db.commit()
        except Exception as e:
            print(f"⚠️ Could not update bio: {e}")

    return _build_coach_response(db, coach, current_user)


# ── Certifications ────────────────────────────────────────────────────────────

@router.post("/certifications", response_model=CertificationResponse)
def add_certification(
    cert: CertificationCreate,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Add a certification to the coach's profile"""
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

    issue_dt = None
    if cert.date_obtained:
        try:
            issue_dt = datetime.strptime(cert.date_obtained, "%Y-%m-%d")
        except ValueError:
            pass

    expiry_dt = None
    if cert.expiry_date:
        try:
            expiry_dt = datetime.strptime(cert.expiry_date, "%Y-%m-%d")
        except ValueError:
            pass

    new_cert = Certification(
        coach_id=coach.id,
        title=cert.name,
        issuing_organization=cert.issuer,
        issue_date=issue_dt,
        expiry_date=expiry_dt,
        credential_id=cert.credential_id,
        is_verified=False,
    )
    db.add(new_cert)
    db.commit()
    db.refresh(new_cert)

    return CertificationResponse(
        id=new_cert.id,
        name=new_cert.title,
        issuer=new_cert.issuing_organization,
        date_obtained=new_cert.issue_date.strftime("%Y-%m-%d") if new_cert.issue_date else None,
        expiry_date=new_cert.expiry_date.strftime("%Y-%m-%d") if new_cert.expiry_date else None,
        credential_id=new_cert.credential_id,
        verified=new_cert.is_verified or False,
    )


@router.delete("/certifications/{cert_id}")
def delete_certification(
    cert_id: int,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

    cert = db.query(Certification).filter(
        Certification.id == cert_id, Certification.coach_id == coach.id
    ).first()
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certification not found")

    db.delete(cert)
    db.commit()
    return {"message": "Certification deleted"}


# ── Education ─────────────────────────────────────────────────────────────────

@router.post("/education", response_model=EducationResponse)
def add_education(
    edu: EducationCreate,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

    new_edu = CoachEducation(
        coach_id=coach.id,
        degree=edu.degree,
        institution=edu.institution,
        field_of_study=edu.field_of_study,
        end_year=edu.graduation_year,
    )
    db.add(new_edu)
    db.commit()
    db.refresh(new_edu)

    return EducationResponse(
        id=new_edu.id,
        degree=new_edu.degree,
        institution=new_edu.institution,
        graduation_year=new_edu.end_year,
        field_of_study=new_edu.field_of_study,
    )


@router.delete("/education/{edu_id}")
def delete_education(
    edu_id: int,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

    edu = db.query(CoachEducation).filter(
        CoachEducation.id == edu_id, CoachEducation.coach_id == coach.id
    ).first()
    if not edu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Education entry not found")

    db.delete(edu)
    db.commit()
    return {"message": "Education entry deleted"}


# ── Experience ────────────────────────────────────────────────────────────────

@router.post("/experience", response_model=ExperienceResponse)
def add_experience(
    exp: ExperienceCreate,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

    start_dt = None
    if exp.start_date:
        try:
            start_dt = date.fromisoformat(exp.start_date)
        except ValueError:
            pass

    end_dt = None
    if exp.end_date and not exp.current:
        try:
            end_dt = date.fromisoformat(exp.end_date)
        except ValueError:
            pass

    new_exp = CoachExperience(
        coach_id=coach.id,
        title=exp.position,
        company=exp.company,
        start_date=start_dt,
        end_date=end_dt,
        description=exp.description,
        is_current=exp.current,
    )
    db.add(new_exp)
    db.commit()
    db.refresh(new_exp)

    return ExperienceResponse(
        id=new_exp.id,
        position=new_exp.title,
        company=new_exp.company,
        start_date=new_exp.start_date.isoformat() if new_exp.start_date else None,
        end_date=new_exp.end_date.isoformat() if new_exp.end_date else None,
        description=new_exp.description,
        current=new_exp.is_current or False,
    )


@router.delete("/experience/{exp_id}")
def delete_experience(
    exp_id: int,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

    exp = db.query(CoachExperience).filter(
        CoachExperience.id == exp_id, CoachExperience.coach_id == coach.id
    ).first()
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experience entry not found")

    db.delete(exp)
    db.commit()
    return {"message": "Experience entry deleted"}


@router.post("/coach-avatar", response_model=AvatarUploadResponse)
async def upload_coach_avatar(
    request: Request,
    avatar: UploadFile = File(...),
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Upload coach avatar image"""
    try:
        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
        if avatar.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
            )

        max_size = 5 * 1024 * 1024
        contents = await avatar.read()
        if len(contents) > max_size:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large. Maximum: 5MB")

        await avatar.seek(0)

        file_ext = os.path.splitext(avatar.filename)[1].lower() or '.jpg'
        unique_filename = f"coach_{uuid.uuid4()}{file_ext}"

        upload_dir = os.path.join("uploads", "avatars")
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, unique_filename)
        temp_path = file_path + '.tmp'

        try:
            avatar_data = avatar.file.read()
            if not validate_image_file(temp_path):
                os.remove(temp_path)
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image file")
            os.rename(temp_path, file_path)
        except HTTPException:
            raise
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error saving file: {str(e)}")

        base_url = str(request.base_url).rstrip('/')
        avatar_url = cloudinary_upload_file(avatar_data, "avatars", unique_filename)

        coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
        if not coach:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach profile not found")

        # Use raw SQL to update avatar_url (column added via migration, not in ORM model)
        db.execute(
            text("UPDATE coaches SET avatar_url = :url WHERE id = :cid"),
            {"url": avatar_url, "cid": coach.id}
        )
        db.commit()

        print(f"✅ Coach avatar uploaded: {avatar_url}")
        return AvatarUploadResponse(avatar_url=avatar_url, message="Coach avatar updated successfully")

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Coach avatar upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/owner-profile")
def get_owner_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get avatar_url for the current admin or owner"""
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    table = "owners" if current_user.role == "owner" else "admins"
    row = db.execute(text(f"SELECT avatar_url FROM {table} WHERE user_id = :uid"), {"uid": current_user.id}).fetchone()
    return {"avatar_url": row.avatar_url if row else None}


@router.post("/owner-avatar", response_model=AvatarUploadResponse)
async def upload_owner_avatar(
    request: Request,
    avatar: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload avatar for owner or admin role"""
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    contents = await avatar.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large. Maximum: 5MB")

    file_ext = os.path.splitext(avatar.filename or "")[1].lower() or ".jpg"
    unique_filename = f"{current_user.role}_{uuid.uuid4()}{file_ext}"
    upload_dir = os.path.join("uploads", "avatars")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    base_url = str(request.base_url).rstrip("/")
    avatar_url = f"{base_url}/uploads/avatars/{unique_filename}"

    if current_user.role == "owner":
        exists = db.execute(text("SELECT 1 FROM owners WHERE user_id = :uid"), {"uid": current_user.id}).fetchone()
        if exists:
            db.execute(text("UPDATE owners SET avatar_url = :url WHERE user_id = :uid"), {"url": avatar_url, "uid": current_user.id})
        else:
            db.execute(text("INSERT INTO owners (user_id, avatar_url) VALUES (:uid, :url)"), {"uid": current_user.id, "url": avatar_url})
    else:
        exists = db.execute(text("SELECT 1 FROM admins WHERE user_id = :uid"), {"uid": current_user.id}).fetchone()
        if exists:
            db.execute(text("UPDATE admins SET avatar_url = :url WHERE user_id = :uid"), {"url": avatar_url, "uid": current_user.id})
        else:
            db.execute(text("INSERT INTO admins (user_id, avatar_url) VALUES (:uid, :url)"), {"uid": current_user.id, "url": avatar_url})
    db.commit()

    return AvatarUploadResponse(avatar_url=avatar_url, message="Avatar updated successfully")


@router.post("/coach-cv")
async def upload_coach_cv(
    request: Request,
    cv: UploadFile = File(...),
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Upload coach CV/resume (PDF or Word doc)"""
    allowed_types = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if cv.content_type not in allowed_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF or Word documents are allowed")

    contents = await cv.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large. Maximum: 10MB")

    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach profile not found")

    file_ext = os.path.splitext(cv.filename)[1].lower() or ".pdf"
    unique_filename = f"cv_{uuid.uuid4()}{file_ext}"
    upload_dir = os.path.join("uploads", "cvs")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    base_url = str(request.base_url).rstrip("/")
    cv_url = f"{base_url}/uploads/cvs/{unique_filename}"

    coach.cv_url = cv_url
    db.commit()

    return {"cv_url": cv_url, "filename": cv.filename, "message": "CV uploaded successfully"}


# ==================== CUSTOMER PROFILE ENDPOINTS ====================

def _get_or_create_customer_profile(db: Session, user_id: int, user_email: str):
    """
    Get existing customer profile or create new one.
    ✅ FIXED: Proper race condition handling - retries SELECT after IntegrityError
    """
    # First, try to get existing profile
    customer = db.query(Customer).filter(Customer.user_id == user_id).first()
    if customer:
        return customer
    
    # Try to create new profile with ALL columns from your schema
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
                :user_id, NULL, NULL, NULL, NULL, NULL,
                NULL, NULL, NULL,
                NULL, NULL, NULL,
                NULL, NULL, NULL, NULL,
                NULL, NULL, NULL,
                1, 1, 0, SYSDATETIMEOFFSET(), NULL
            )
        """)
        
        db.execute(insert_sql, {"user_id": user_id})
        db.commit()
        print(f"✅ Created customer profile for user {user_email}")
        
        customer = db.query(Customer).filter(Customer.user_id == user_id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve newly created customer profile"
            )
        return customer
        
    except IntegrityError as e:
        # ✅ FIX: Another request created the profile while we were trying
        # Roll back THIS transaction, then fetch in a fresh query
        db.rollback()
        print(f"⚠️ Customer profile already exists for user {user_email}, fetching existing...")
        
        # ✅ CRITICAL: Expire all cached objects so the next query hits the database
        db.expire_all()
        
        # ✅ FIX: Retry SELECT in a fresh state
        customer = db.query(Customer).filter(Customer.user_id == user_id).first()
        if customer:
            return customer
        else:
            # This should never happen - log detailed error
            print(f"❌ CRITICAL: IntegrityError occurred but SELECT still returns NULL for user_id={user_id}")
            print(f"❌ This indicates a race condition bug or database inconsistency")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve customer profile after race condition"
            )
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating customer profile: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating customer profile: {str(e)}"
        )


@router.get("/profile", response_model=CustomerProfileResponse)
def get_customer_profile(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Get current customer's full profile
    Matches React UserProfile component data structure exactly
    """
    try:
        # Get or create profile (handles all edge cases)
        customer = _get_or_create_customer_profile(db, current_user.id, current_user.email)
        
        # ✅ CRITICAL FIX: Sync data from users table to customers table
        needs_update = False
        
        # Sync phone from users to customers if empty
        if current_user.phone and not customer.phone:
            customer.phone = current_user.phone
            needs_update = True
            print(f"📞 Syncing phone from users to customers: '{customer.phone}'")
        
        # Sync full_name
        if current_user.full_name and current_user.full_name != customer.full_name:
            customer.full_name = current_user.full_name
            needs_update = True
            print(f"👤 Syncing full_name to customers: '{customer.full_name}'")
        
        # Sync email
        if current_user.email != customer.email:
            customer.email = current_user.email
            needs_update = True
            print(f"📧 Syncing email to customers: '{customer.email}'")
        
        # Commit if any updates were made
        if needs_update:
            db.commit()
            db.refresh(customer)
            print(f"✅ Synced user data to customer profile")
        
        print(f"📊 Customer data: {customer}")
        print(f"📊 Date of birth: {customer.date_of_birth}")
        print(f"📊 Gender: {customer.gender}")
        print(f"📊 Avatar URL: {customer.avatar_url}")
        print(f"📊 Phone: {customer.phone}")
        
        # ✅ Build response - use customer.phone (which is now synced)
        # Fetch assigned coach name (via assigned_coach_id, bookings, or active package sub)
        assigned_coach_name = None
        try:
            coach_row = db.execute(text("""
                SELECT TOP 1 u.full_name
                FROM coaches co
                JOIN users u ON co.user_id = u.id
                WHERE co.id IN (
                    SELECT assigned_coach_id FROM customers
                    WHERE user_id = :uid AND assigned_coach_id IS NOT NULL
                    UNION
                    SELECT b.coach_id FROM bookings b
                    JOIN customers c ON b.customer_id = c.id
                    WHERE c.user_id = :uid
                    UNION
                    SELECT cp.coach_id FROM subscriptions s
                    JOIN coach_packages cp ON s.coach_package_id = cp.id
                    JOIN customers c ON s.customer_id = c.id
                    WHERE c.user_id = :uid AND s.status = 'active'
                )
            """), {"uid": current_user.id}).fetchone()
            if coach_row:
                assigned_coach_name = coach_row[0]
        except Exception:
            pass

        response = CustomerProfileResponse(
            # User data
            id=customer.id,
            user_id=customer.user_id,
            name=current_user.full_name,
            email=current_user.email,
            phone=customer.phone or current_user.phone,  # ✅ Prefer customer.phone
            # Profile data - Direct attribute access
            date_of_birth=customer.date_of_birth,
            gender=customer.gender,
            height=customer.height,
            weight=customer.weight,
            weight_goal=customer.weight_goal,
            goal=customer.goal,
            bio=customer.bio,
            # Emergency contact
            emergency_contact_name=customer.emergency_contact_name,
            emergency_contact_phone=customer.emergency_contact_phone,
            emergency_contact_relationship=customer.emergency_contact_relationship,
            # Preferences
            notifications_enabled=customer.notifications_enabled,
            email_updates_enabled=customer.email_updates_enabled,
            public_profile=customer.public_profile,
            # Avatar
            avatar_url=customer.avatar_url,
            assigned_coach_name=assigned_coach_name,
            # Metadata
            created_at=customer.created_at,
            updated_at=customer.updated_at
        )

        print(f"✅ Response built successfully")
        return response
        
    except Exception as e:
        print(f"❌ Error in get_customer_profile: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching profile: {str(e)}"
        )


@router.put("/profile", response_model=CustomerProfileResponse)
def update_customer_profile(
    profile_data: CustomerProfileUpdate,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Update current customer's full profile
    Matches React UserProfile component
    """
    try:
        # Ensure profile exists first
        customer = _get_or_create_customer_profile(db, current_user.id, current_user.email)
        
        # ✅ CRITICAL FIX: Handle phone update in BOTH tables
        if profile_data.phone is not None:
            # Update in users table
            current_user.phone = profile_data.phone
            # Update in customers table
            customer.phone = profile_data.phone
            print(f"📞 Updated phone in both users and customers tables: '{profile_data.phone}'")
        
        # Handle full_name update on User model
        if profile_data.full_name is not None:
            current_user.full_name = profile_data.full_name
            customer.full_name = profile_data.full_name  # ✅ Also update in customers
        
        # Update Customer fields (exclude fields that belong to User table)
        update_data = profile_data.model_dump(exclude_unset=True, exclude={'full_name', 'phone'})
        
        # Convert empty strings to None
        for field, value in update_data.items():
            if value == '':
                update_data[field] = None
        
        for field, value in update_data.items():
            if value is not None:
                setattr(customer, field, value)
        
        db.commit()
        db.refresh(customer)
        db.refresh(current_user)
        
        # ✅ Build response with synced data
        return CustomerProfileResponse(
            # User data
            id=customer.id,
            user_id=customer.user_id,
            name=current_user.full_name,
            email=current_user.email,
            phone=customer.phone or current_user.phone,  # ✅ Prefer customer.phone
            # Profile data
            date_of_birth=customer.date_of_birth,
            gender=customer.gender,
            height=customer.height,
            weight=customer.weight,
            weight_goal=customer.weight_goal,
            goal=customer.goal,
            bio=customer.bio,
            # Emergency contact
            emergency_contact_name=customer.emergency_contact_name,
            emergency_contact_phone=customer.emergency_contact_phone,
            emergency_contact_relationship=customer.emergency_contact_relationship,
            # Preferences
            notifications_enabled=customer.notifications_enabled,
            email_updates_enabled=customer.email_updates_enabled,
            public_profile=customer.public_profile,
            # Avatar
            avatar_url=customer.avatar_url,
            # Metadata
            created_at=customer.created_at,
            updated_at=customer.updated_at
        )
    except Exception as e:
        print(f"❌ Error in update_customer_profile: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating profile: {str(e)}"
        )


# Legacy endpoint alias for backward compatibility
@router.get("/customer-profile", response_model=CustomerProfileResponse)
def get_customer_profile_legacy(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """Legacy endpoint - redirects to /profile"""
    return get_customer_profile(current_user, db)


@router.put("/customer-profile", response_model=CustomerProfileResponse)
def update_customer_profile_legacy(
    profile_data: CustomerProfileUpdate,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """Legacy endpoint - redirects to /profile"""
    return update_customer_profile(profile_data, current_user, db)


# ==================== AVATAR UPLOAD ====================

def validate_image_file(file_path: str) -> bool:
    """Validate that file is a valid image"""
    try:
        with Image.open(file_path) as img:
            img.verify()
        return True
    except:
        return False


@router.post("/avatar-test", response_model=dict)
async def test_avatar_upload(
    file: UploadFile = File(...)
):
    """
    Test endpoint to check file upload without authentication
    """
    try:
        if not file:
            return {"error": "No file provided"}
        
        return {
            "filename": file.filename,
            "content_type": file.content_type,
            "file_size": len(await file.read())
        }
    except Exception as e:
        return {"error": str(e)}


@router.post("/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    request: Request,
    avatar: UploadFile = File(None),
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Upload customer avatar
    Max file size: 5MB
    Allowed types: image/jpeg, image/png, image/webp
    """
    try:
        # Check if file exists
        if not avatar or not avatar.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided or file has no filename"
            )
        
        print(f"📁 Received file: {avatar.filename}, content_type: {avatar.content_type}")
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
        if avatar.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
            )
        
        # Validate file size (5MB)
        max_size = 5 * 1024 * 1024
        contents = await avatar.read()
        if len(contents) > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large. Maximum size: 5MB"
            )
        
        # Reset file pointer
        await avatar.seek(0)
        
        # Generate unique filename
        file_ext = os.path.splitext(avatar.filename)[1].lower()
        if not file_ext:
            file_ext = '.jpg'  # default extension
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        
        # Ensure upload directory exists
        upload_dir = os.path.join("uploads", "avatars")
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = os.path.join(upload_dir, unique_filename)
        
        # Save file temporarily
        temp_path = file_path + '.tmp'
        try:
            avatar_data = avatar.file.read()
            
            # Validate image
            if not validate_image_file(temp_path):
                os.remove(temp_path)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid image file"
                )
            
            # Move to final location
            os.rename(temp_path, file_path)
            
        except Exception as e:
            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error saving file: {str(e)}"
            )
        
        # Generate full URL
        base_url = str(request.base_url).rstrip('/')
        avatar_url = cloudinary_upload_file(avatar_data, "avatars", unique_filename)
        
        # Ensure customer profile exists then update avatar
        customer = _get_or_create_customer_profile(db, current_user.id, current_user.email)
        
        # ✅ CRITICAL FIX: Update avatar URL and commit IMMEDIATELY
        customer.avatar_url = avatar_url
        customer.updated_at = datetime.utcnow()  # ✅ Update timestamp
        db.commit()
        db.refresh(customer)
        
        print(f"✅ Avatar uploaded for user {current_user.email}: {avatar_url}")
        print(f"✅ Avatar URL saved to database: {customer.avatar_url}")
        
        return AvatarUploadResponse(avatar_url=avatar_url, message="Avatar updated successfully")
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any other unexpected errors
        print(f"❌ Unexpected error in avatar upload: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during avatar upload"
        )


@router.delete("/avatar")
def delete_avatar(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """Remove customer avatar"""
    customer = _get_or_create_customer_profile(db, current_user.id, current_user.email)
    
    if not customer.avatar_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No avatar found"
        )
    
    avatar_url = customer.avatar_url
    
    # Extract filename from URL
    if avatar_url.startswith('http'):
        # Full URL: extract filename
        filename = avatar_url.split('/')[-1]
    else:
        # Relative URL
        filename = avatar_url.replace('/uploads/avatars/', '')
    
    # Delete file
    file_path = os.path.join("uploads", "avatars", filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        print(f"🗑️ Deleted avatar file: {file_path}")
    
    # Update database
    customer.avatar_url = None
    customer.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Avatar removed successfully"}


@router.get("/avatar")
def get_avatar(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """Get current user's avatar"""
    customer = _get_or_create_customer_profile(db, current_user.id, current_user.email)
    
    if not customer.avatar_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No avatar found"
        )
    
    # Extract filename from URL
    if customer.avatar_url.startswith('http'):
        filename = customer.avatar_url.split('/')[-1]
    else:
        filename = customer.avatar_url.replace('/uploads/avatars/', '')
    
    file_path = os.path.join("uploads", "avatars", filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Avatar file not found"
        )
    
    return FileResponse(file_path, media_type='image/jpeg')


# ==================== CHANGE PASSWORD ====================

from app.core.security import verify_password, hash_password
from pydantic import BaseModel

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password")
def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change user password
    Requires current password verification
    """
    # Verify current password
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Validate new password length
    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long"
        )
    
    # Hash and update new password
    current_user.password_hash = hash_password(password_data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}
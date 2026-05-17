from app.utils.cloudinary_upload import upload_file as cloudinary_upload_file
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.api.deps import get_current_user, require_owner, require_admin
from app.models.user import User
from app.models.gym import Gym
from app.models.coach import Coach, CoachEducation
from app.models.certification import Certification
from app.models.booking import Booking
from app.models.customer import Customer
from app.models.subscription import Subscription
from app.models.admin import Admin as AdminModel
from app.core.security import hash_password
import uuid
import os

from app.schemas.gym import (
    GymCreate,
    GymUpdate,
    GymResponse,
    GymCoachResponse,
    GymBookingResponse
)

router = APIRouter(prefix="/gyms", tags=["Gym Management"])


@router.post("/", response_model=GymResponse, status_code=status.HTTP_201_CREATED)
def create_gym(
    gym_data: GymCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create new gym (ADMIN or OWNER)
    """
    existing_gym = db.query(Gym).filter(
        Gym.name == gym_data.name,
        Gym.location == gym_data.location
    ).first()

    if existing_gym:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gym with this name and location already exists"
        )

    new_gym = Gym(
        name=gym_data.name,
        location=gym_data.location,
        phone=gym_data.phone,
        is_active=(gym_data.status != "Inactive") if gym_data.status else True,
    )

    db.add(new_gym)
    db.commit()
    db.refresh(new_gym)

    return new_gym


@router.get("/", response_model=List[GymResponse])
def list_gyms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all gyms (any authenticated user)
    """
    gyms = db.query(Gym).all()
    return gyms


@router.get("/coaches", response_model=List[GymCoachResponse])
def list_all_coaches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get ALL coaches across all gyms (any authenticated user).
    Used by CoachDirectory.jsx — avoids gym-by-gym lookup which misses coaches without gym_id.
    """
    coaches = db.query(Coach, User).join(
        User, Coach.user_id == User.id
    ).all()

    result = []
    for coach, user in coaches:
        # Fetch avatar_url and bio via raw SQL (migration-added columns not in ORM model)
        try:
            row = db.execute(
                text("SELECT avatar_url, bio, cv_url FROM coaches WHERE id = :cid"),
                {"cid": coach.id}
            ).fetchone()
            avatar_url = row.avatar_url if row else None
            bio = row.bio if row else None
            cv_url = row.cv_url if row else None
        except Exception:
            avatar_url = None
            bio = None
            cv_url = None

        # Fetch certifications
        certifications = []
        cert_records = db.query(Certification).filter(
            Certification.coach_id == coach.id
        ).all()
        for cert in cert_records:
            certifications.append({
                "title": cert.title,
                "organization": cert.issuing_organization or "",
                "date": cert.issue_date.isoformat() if cert.issue_date else None,
                "verified": cert.is_verified or False
            })

        # Fetch education
        education_list = []
        edu_records = db.query(CoachEducation).filter(
            CoachEducation.coach_id == coach.id
        ).all()
        for edu in edu_records:
            education_list.append(f"{edu.degree} - {edu.institution}")
        education = "; ".join(education_list) if education_list else ""

        # Build specialties list
        specialties = []
        if coach.specialty:
            if ',' in coach.specialty:
                specialties = [s.strip() for s in coach.specialty.split(',')]
            else:
                specialties = [coach.specialty]
        else:
            specialties = ["General Fitness"]

        try:
            rc_row = db.execute(text("""
                SELECT COUNT(DISTINCT customer_id) AS cnt FROM (
                    SELECT c.id AS customer_id FROM customers c WHERE c.assigned_coach_id = :cid
                    UNION
                    SELECT b.customer_id FROM bookings b
                    WHERE b.coach_id = :cid
                    UNION
                    SELECT s.customer_id FROM subscriptions s
                    JOIN coach_packages cp ON s.coach_package_id = cp.id
                    WHERE cp.coach_id = :cid AND s.status = 'active'
                ) x
            """), {"cid": coach.id}).fetchone()
            real_clients = rc_row.cnt if rc_row else 0
        except Exception as e:
            import logging; logging.getLogger(__name__).warning(f"client count failed: {e}")
            real_clients = coach.current_clients or 0

        result.append(GymCoachResponse(
            id=coach.id,
            name=user.full_name,
            email=user.email,
            experience_years=coach.experience_years or 0,
            hourly_rate=coach.hourly_rate or 0.0,
            rate=coach.hourly_rate or 0.0,
            specialty=coach.specialty or "General Fitness",
            specialties=specialties,
            bio=bio or "Experienced fitness coach dedicated to helping clients reach their goals.",
            certifications=certifications,
            languages=["English"],
            education=education,
            availability_text="Contact for availability",
            rating=coach.rating or 4.5,
            total_reviews=coach.total_reviews or 0,
            total_clients=real_clients,
            max_clients=coach.max_clients or 20,
            current_clients=real_clients,
            is_available=coach.is_available if coach.is_available is not None else True,
            is_featured=coach.is_featured or False,
            avatar=(user.full_name[:2].upper() if user.full_name else "CO"),
            avatar_url=avatar_url,
            cv_url=cv_url,
        ))

    return result


@router.get("/{gym_id}", response_model=GymResponse)
def get_gym(
    gym_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get gym details
    """
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    
    if not gym:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gym not found"
        )
    
    return gym


@router.put("/{gym_id}", response_model=GymResponse)
def update_gym(
    gym_id: int,
    gym_data: GymUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update gym details (ADMIN or OWNER)
    """
    gym = db.query(Gym).filter(Gym.id == gym_id).first()

    if not gym:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gym not found"
        )

    if gym_data.name is not None:
        gym.name = gym_data.name
    if gym_data.location is not None:
        gym.location = gym_data.location
    if gym_data.phone is not None:
        gym.phone = gym_data.phone
    if gym_data.status is not None:
        gym.is_active = (gym_data.status != "Inactive")

    db.commit()
    db.refresh(gym)

    return gym


@router.post("/{gym_id}/image")
async def upload_gym_image(
    gym_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Upload/replace the cover image for a gym branch."""
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="Gym not found")

    upload_dir = os.path.join("uploads", "gyms")
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    filename = f"gym_{gym_id}_{uuid.uuid4().hex}{ext}"
    dest = os.path.join(upload_dir, filename)
    with open(dest, "wb") as f:
        f.write(await file.read())

    gym.image_url = f"/uploads/gyms/{filename}"
    db.commit()
    return {"image_url": gym.image_url}


@router.delete("/{gym_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gym(
    gym_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete gym (ADMIN or OWNER)
    """
    gym = db.query(Gym).filter(Gym.id == gym_id).first()

    if not gym:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gym not found"
        )

    db.delete(gym)
    db.commit()

    return None


@router.get("/{gym_id}/coaches", response_model=List[GymCoachResponse])
def get_gym_coaches(
    gym_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all coaches at a specific gym with full profile data for CoachDirectory.jsx
    """
    # Verify gym exists
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gym not found"
        )
    
    # Get coaches with their user data
    coaches = db.query(Coach, User).join(
        User, Coach.user_id == User.id
    ).filter(
        Coach.gym_id == gym_id
    ).all()
    
    result = []
    for coach, user in coaches:
        # Fetch certifications from related table
        certifications = []
        cert_records = db.query(Certification).filter(
            Certification.coach_id == coach.id
        ).all()
        for cert in cert_records:
            certifications.append({
                "title": cert.title,
                "organization": cert.issuing_organization or "",
                "date": cert.issue_date.isoformat() if cert.issue_date else None,
                "verified": cert.is_verified or False
            })
        
        # Fetch education from related table
        education_list = []
        edu_records = db.query(CoachEducation).filter(
            CoachEducation.coach_id == coach.id
        ).all()
        for edu in edu_records:
            education_list.append(f"{edu.degree} - {edu.institution}")
        
        education = "; ".join(education_list) if education_list else ""
        
        # specialty is a single string - convert to list for frontend
        specialties = []
        if coach.specialty:
            if ',' in coach.specialty:
                specialties = [s.strip() for s in coach.specialty.split(',')]
            else:
                specialties = [coach.specialty]
        else:
            specialties = ["General Fitness"]
        
        try:
            rc_row2 = db.execute(text("""
                SELECT COUNT(DISTINCT customer_id) AS cnt FROM (
                    SELECT c.id AS customer_id FROM customers c WHERE c.assigned_coach_id = :cid
                    UNION
                    SELECT b.customer_id FROM bookings b
                    WHERE b.coach_id = :cid
                    UNION
                    SELECT s.customer_id FROM subscriptions s
                    JOIN coach_packages cp ON s.coach_package_id = cp.id
                    WHERE cp.coach_id = :cid AND s.status = 'active'
                ) x
            """), {"cid": coach.id}).fetchone()
            real_clients2 = rc_row2.cnt if rc_row2 else 0
        except Exception as e:
            import logging; logging.getLogger(__name__).warning(f"client count failed: {e}")
            real_clients2 = coach.current_clients or 0

        # Build response with ACTUAL database fields
        result.append(GymCoachResponse(
            id=coach.id,
            name=user.full_name,
            email=user.email,
            experience_years=coach.experience_years or 0,
            hourly_rate=coach.hourly_rate or 0.0,
            rate=coach.hourly_rate or 0.0,
            specialty=coach.specialty or "General Fitness",
            specialties=specialties,
            bio="Experienced fitness coach dedicated to helping clients reach their goals.",
            certifications=certifications,
            languages=["English"],
            education=education,
            availability_text="Contact for availability",
            rating=coach.rating or 4.5,
            total_reviews=coach.total_reviews or 0,
            total_clients=real_clients2,
            max_clients=coach.max_clients or 20,
            current_clients=real_clients2,
            is_available=coach.is_available if coach.is_available is not None else True,
            is_featured=coach.is_featured or False,
            avatar=(user.full_name[:2].upper() if user.full_name else "CO")
        ))

    return result


@router.get("/{gym_id}/bookings", response_model=List[GymBookingResponse])
def get_gym_bookings(
    gym_id: int,
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    """
    Get all bookings at a specific gym (OWNER only)
    
    Optional filter by status: PENDING, CONFIRMED, CANCELLED, COMPLETED
    """
    # Verify gym exists
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gym not found"
        )
    
    # Build query
    query = db.query(Booking).filter(Booking.gym_id == gym_id)
    
    if status:
        if status not in ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status. Must be PENDING, CONFIRMED, CANCELLED, or COMPLETED"
            )
        query = query.filter(Booking.status == status)
    
    bookings = query.order_by(Booking.session_time.desc()).all()

    # Get additional details
    result = []
    for booking in bookings:
        customer = db.query(Customer).filter(Customer.id == booking.customer_id).first()
        customer_user = db.query(User).filter(User.id == customer.user_id).first() if customer else None

        coach = db.query(Coach).filter(Coach.id == booking.coach_id).first()
        coach_user = db.query(User).filter(User.id == coach.user_id).first() if coach else None

        result.append(GymBookingResponse(
            id=booking.id,
            customer_name=customer_user.full_name if customer_user else "Unknown",
            coach_name=coach_user.full_name if coach_user else "Unknown",
            session_time=booking.session_time,
            status=booking.status,
            created_at=booking.created_at
        ))

    return result


@router.get("/{gym_id}/stats")
def get_gym_stats(
    gym_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get live stats for a gym (member counts, coaches, check-ins, revenue)"""
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gym not found")

    total_members = db.query(Customer).filter(Customer.gym_id == gym_id).count()

    active_members = db.execute(text("""
        SELECT COUNT(DISTINCT c.id)
        FROM customers c
        JOIN subscriptions s ON s.customer_id = c.id
        WHERE c.gym_id = :gym_id AND s.status = 'active'
    """), {"gym_id": gym_id}).scalar() or 0

    total_coaches = db.query(Coach).filter(Coach.gym_id == gym_id).count()

    try:
        todays_checkins = db.execute(text("""
            SELECT COUNT(*) FROM bookings
            WHERE gym_id = :gym_id
              AND CAST(session_time AS DATE) = CAST(GETDATE() AS DATE)
        """), {"gym_id": gym_id}).scalar() or 0
    except Exception:
        todays_checkins = 0

    try:
        revenue = db.execute(text("""
            SELECT COALESCE(SUM(s.price), 0)
            FROM subscriptions s
            JOIN customers c ON s.customer_id = c.id
            WHERE c.gym_id = :gym_id AND s.status = 'active'
        """), {"gym_id": gym_id}).scalar() or 0
    except Exception:
        revenue = 0

    return {
        "totalMembers": total_members,
        "activeMembers": int(active_members),
        "totalCoaches": total_coaches,
        "todaysCheckins": int(todays_checkins),
        "subscriptionsRevenue": float(revenue),
    }


@router.get("/{gym_id}/customers")
def get_gym_customers(
    gym_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all customers registered at a gym"""
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gym not found")

    rows = db.query(Customer, User).join(User, Customer.user_id == User.id).filter(
        Customer.gym_id == gym_id
    ).all()

    result = []
    for customer, user in rows:
        active_sub = db.query(Subscription).filter(
            Subscription.customer_id == customer.id,
            Subscription.status == "active"
        ).first()

        coach_name = None
        if customer.assigned_coach_id:
            coach_row = db.query(Coach, User).join(User, Coach.user_id == User.id).filter(
                Coach.id == customer.assigned_coach_id
            ).first()
            if coach_row:
                coach_name = coach_row[1].full_name

        result.append({
            "id": customer.id,
            "name": user.full_name or customer.full_name or "Unknown",
            "email": user.email,
            "phone": customer.phone or "",
            "joinDate": customer.joined_date.isoformat() if customer.joined_date else "",
            "status": "active" if active_sub else "expired",
            "subscriptionEnd": (
                active_sub.end_date.isoformat() if active_sub and active_sub.end_date else ""
            ),
            "coach": coach_name or "Not assigned",
        })

    return result


# ── Gym Admins ──────────────────────────────────────────────────────────────

class GymAdminCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    status: str = "active"


@router.get("/{gym_id}/admins")
def get_gym_admins(
    gym_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all admins assigned to a gym"""
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gym not found")

    rows = db.query(AdminModel, User).join(User, AdminModel.user_id == User.id).filter(
        AdminModel.gym_id == gym_id
    ).all()

    return [
        {
            "id": admin.id,
            "user_id": user.id,
            "name": user.full_name or "Admin",
            "email": user.email if user.email and "@system.gym" not in user.email else "",
            "phone": admin.phone or "",
            "status": "active" if user.is_active else "inactive",
            "joinedAt": admin.created_at.isoformat() if admin.created_at else "",
            "is_super_admin": admin.is_super_admin or False,
        }
        for admin, user in rows
    ]


@router.post("/{gym_id}/admins", status_code=201)
def create_gym_admin(
    gym_id: int,
    data: GymAdminCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new admin and assign to a gym"""
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gym not found")

    email = data.email or f"admin_{uuid.uuid4().hex[:8]}@system.gym"
    password_hash = hash_password(data.password or uuid.uuid4().hex)

    new_user = User(
        full_name=data.name,
        email=email,
        password_hash=password_hash,
        role="admin",
        is_active=(data.status != "inactive"),
    )
    db.add(new_user)
    db.flush()

    new_admin = AdminModel(
        user_id=new_user.id,
        gym_id=gym_id,
        phone=data.phone,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    db.refresh(new_user)

    return {
        "id": new_admin.id,
        "user_id": new_user.id,
        "name": new_user.full_name,
        "email": new_user.email if "@system.gym" not in new_user.email else "",
        "phone": new_admin.phone or "",
        "status": "active" if new_user.is_active else "inactive",
        "joinedAt": new_admin.created_at.isoformat() if new_admin.created_at else "",
        "is_super_admin": False,
    }


@router.delete("/{gym_id}/admins/{admin_id}", status_code=204)
def remove_gym_admin(
    gym_id: int,
    admin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Remove an admin from a gym (unassigns gym_id)"""
    admin = db.query(AdminModel).filter(
        AdminModel.id == admin_id,
        AdminModel.gym_id == gym_id
    ).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found in this gym")

    admin.gym_id = None
    db.commit()
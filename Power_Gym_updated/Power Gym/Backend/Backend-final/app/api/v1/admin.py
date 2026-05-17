# app/api/v1/admin.py
"""
Admin management endpoints:
  /admin/users/           - CRUD for all users
  /admin/coaches/         - CRUD for coaches
  /admin/membership-plans/ - CRUD for membership plans
"""
import uuid
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from sqlalchemy import func as sql_func, case, text

from app.database import get_db
from app.api.deps import require_admin
from app.models.user import User
from app.api.v1.notifications import create_notification
from app.models.coach import Coach
from app.models.customer import Customer
from app.models.membership_plan import MembershipPlan
from app.models.subscription import Subscription
from app.models.gym import Gym
from app.models.admin import Admin
from app.models.owner import Owner
from app.core.security import hash_password
from app.models.subscription_request import SubscriptionRequest
from app.models.membership_plan import MembershipPlan as _MembershipPlan
from app.models.coach_package import CoachPackage

router = APIRouter(prefix="/admin", tags=["Admin Management"])


# ── helpers ────────────────────────────────────────────────────────────────

def _get_admin_gym_id(user: User, db: Session) -> Optional[int]:
    """Return the gym_id from the admins table for the given user (None if super_admin or not set)."""
    admin = db.query(Admin).filter(Admin.user_id == user.id).first()
    if admin and admin.is_super_admin:
        return None  # super_admin sees all branches
    return admin.gym_id if admin else None


def _status_from_is_active(is_active) -> str:
    if is_active is None:
        return "Pending"
    return "Active" if is_active else "Inactive"


def _is_active_from_status(s: str):
    if s == "Active":
        return True
    if s == "Inactive":
        return False
    return None  # Pending


def _user_to_dict(u: User, db: Session) -> dict:
    membership_id = None
    gym_id = None
    gym_name = None

    if u.customer_profile:
        membership_id = u.customer_profile.membership_id
        if u.customer_profile.gym_id:
            gym_id = u.customer_profile.gym_id
            gym = db.query(Gym).filter(Gym.id == gym_id).first()
            gym_name = gym.name if gym else None
    elif u.role == "coach":
        coach = db.query(Coach).filter(Coach.user_id == u.id).first()
        if coach:
            membership_id = u.id  # show user.id
            if coach.gym_id:
                gym_id = coach.gym_id
                gym = db.query(Gym).filter(Gym.id == gym_id).first()
                gym_name = gym.name if gym else None
        else:
            membership_id = u.id
    else:
        membership_id = None

    email = u.email
    if email and "@system.gym" in email:
        email = None

    return {
        "id": u.id,
        "full_name": u.full_name,
        "email": email,
        "role": u.role,
        "membership_id": membership_id,
        "status": _status_from_is_active(u.is_active),
        "created_at": u.created_at,
        "gym_id": gym_id,
        "gym_name": gym_name,
    }


# ── Pydantic schemas ────────────────────────────────────────────────────────

class UserCreateAdmin(BaseModel):
    full_name: str
    membership_id: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: str = "user"
    status: str = "Active"
    gym_id: Optional[int] = None


class UserUpdateAdmin(BaseModel):
    full_name: Optional[str] = None
    membership_id: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    gym_id: Optional[int] = None


class CoachCreateAdmin(BaseModel):
    full_name: str
    staff_id: str
    email: Optional[str] = None
    password: Optional[str] = None
    experience_years: Optional[int] = None
    hourly_rate: Optional[float] = None
    gym_id: Optional[int] = None
    specialization: Optional[str] = None
    status: str = "Active"


class CoachUpdateAdmin(BaseModel):
    full_name: Optional[str] = None
    experience_years: Optional[int] = None
    hourly_rate: Optional[float] = None
    gym_id: Optional[int] = None
    specialization: Optional[str] = None
    status: Optional[str] = None


class MembershipPlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = 0.0
    duration_days: int = 30
    features: Optional[List[str]] = []
    status: str = "Active"


class MembershipPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    duration_days: Optional[int] = None
    features: Optional[List[str]] = None
    status: Optional[str] = None


# ── USERS ──────────────────────────────────────────────────────────────────

@router.get("/users/")
def list_users(
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    admin_gym_id = _get_admin_gym_id(current_user, db)

    query = db.query(User)
    if role and role != "all":
        query = query.filter(User.role == role)
    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )
    # Branch filter: only scope by role when a specific role is selected.
    # "All roles" view always shows all users so admins don't lose visibility.
    if admin_gym_id is not None:
        from sqlalchemy import or_
        effective_role = role if (role and role != "all") else None
        if effective_role == "user":
            # Members: show those in admin's gym OR still-unassigned
            query = (
                query.join(Customer, Customer.user_id == User.id)
                .filter(or_(Customer.gym_id == admin_gym_id, Customer.gym_id == None))
            )
        elif effective_role == "coach":
            # Coaches: show those in admin's gym OR still-unassigned
            query = (
                query.join(Coach, Coach.user_id == User.id)
                .filter(or_(Coach.gym_id == admin_gym_id, Coach.gym_id == None))
            )
        # "all roles": no branch filter — admin sees everyone
    # Only show customers (user role) and coaches in user management
    query = query.filter(User.role.in_(["user", "coach"]))
    # Only show customers (user role) and coaches in user management
    query = query.filter(User.role.in_(["user", "coach"]))
    users = query.order_by(User.id.asc()).all()
    return [_user_to_dict(u, db) for u in users]


@router.post("/users/", status_code=201)
def create_user(
    data: UserCreateAdmin,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    # ── Pre-creation uniqueness checks ──────────────────────────────────────
    if data.role == "user" and data.membership_id:
        if db.query(Customer).filter(Customer.membership_id == data.membership_id).first():
            raise HTTPException(status_code=400, detail="Membership ID already in use")
    elif data.role != "user" and data.membership_id and not data.email:
        if db.query(User).filter(User.email.like(f"PENDING_{data.membership_id}_%@system.gym")).first():
            raise HTTPException(status_code=400, detail="Staff ID already in use")

    # Use provided email/password if given (for admin/owner/coach), else placeholder
    if data.email:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")
        user_email = data.email
        user_password = hash_password(data.password or uuid.uuid4().hex)
    else:
        user_email = f"PENDING_{data.membership_id or uuid.uuid4().hex[:8]}_{uuid.uuid4().hex[:6]}@system.gym"
        user_password = hash_password(uuid.uuid4().hex)

    new_user = User(
        full_name=data.full_name,
        email=user_email,
        password_hash=user_password,
        role=data.role,
        is_active=_is_active_from_status(data.status),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Resolve gym_id: use provided gym_id, else fall back to admin's gym
    resolved_gym_id = data.gym_id or _get_admin_gym_id(current_user, db)

    if data.role == "user":
        customer = Customer(
            user_id=new_user.id,
            membership_id=data.membership_id,
            full_name=data.full_name,
            gym_id=resolved_gym_id,
        )
        db.add(customer)
        db.commit()
    elif data.role == "coach":
        coach = Coach(user_id=new_user.id, gym_id=resolved_gym_id)
        db.add(coach)
        db.commit()
    elif data.role == "admin":
        admin_profile = Admin(
            user_id=new_user.id,
            gym_id=resolved_gym_id,
            department="General",
            is_super_admin=False,
        )
        db.add(admin_profile)
        db.commit()
    elif data.role == "owner":
        owner_profile = Owner(
            user_id=new_user.id,
            company_name="My Gym",
        )
        db.add(owner_profile)
        db.commit()

    return _user_to_dict(new_user, db)


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdateAdmin,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    from sqlalchemy.orm.attributes import flag_modified

    if data.full_name is not None:
        u.full_name = data.full_name
    if data.role is not None:
        u.role = data.role
    if data.status is not None:
        u.is_active = _is_active_from_status(data.status)
        flag_modified(u, "is_active")  # force SQLAlchemy to include in UPDATE

    # Update membership_id if provided and user has customer profile
    if data.membership_id is not None:
        exists = db.query(Customer).filter(
            Customer.membership_id == data.membership_id,
            Customer.user_id != user_id,
        ).first()
        if exists:
            raise HTTPException(status_code=400, detail="Membership ID already in use")
        if u.customer_profile:
            u.customer_profile.membership_id = data.membership_id
        else:
            customer = Customer(user_id=u.id, membership_id=data.membership_id, full_name=u.full_name)
            db.add(customer)

    # Update gym assignment
    if data.gym_id is not None:
        if u.customer_profile:
            u.customer_profile.gym_id = data.gym_id
        else:
            coach = db.query(Coach).filter(Coach.user_id == u.id).first()
            if coach:
                coach.gym_id = data.gym_id
            else:
                admin_profile = db.query(Admin).filter(Admin.user_id == u.id).first()
                if admin_profile:
                    admin_profile.gym_id = data.gym_id

    db.commit()
    db.refresh(u)
    return _user_to_dict(u, db)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text("SELECT id FROM users WHERE id = :uid"), {"uid": user_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    uid = {"uid": user_id}

    # ── Customer-side cleanup ────────────────────────────────────────────────
    # nutrition_goals, reviews, meal_logs, meals, bookings, subscriptions
    # all reference customers.id with no ON DELETE CASCADE at DB level.
    db.execute(text("""
        DELETE FROM nutrition_goals
        WHERE customer_id IN (SELECT id FROM customers WHERE user_id = :uid)
    """), uid)
    db.execute(text("""
        DELETE FROM reviews
        WHERE customer_id IN (SELECT id FROM customers WHERE user_id = :uid)
    """), uid)
    db.execute(text("""
        DELETE FROM meal_logs
        WHERE meal_id IN (
            SELECT id FROM meals WHERE customer_id IN (
                SELECT id FROM customers WHERE user_id = :uid
            )
        )
    """), uid)
    db.execute(text("""
        DELETE FROM meals
        WHERE customer_id IN (SELECT id FROM customers WHERE user_id = :uid)
    """), uid)
    db.execute(text("""
        DELETE FROM bookings
        WHERE customer_id IN (SELECT id FROM customers WHERE user_id = :uid)
    """), uid)
    db.execute(text("""
        DELETE FROM subscriptions
        WHERE customer_id IN (SELECT id FROM customers WHERE user_id = :uid)
    """), uid)
    db.execute(text("""
        DELETE FROM subscription_requests
        WHERE customer_id IN (SELECT id FROM customers WHERE user_id = :uid)
    """), uid)
    db.execute(text("DELETE FROM customers WHERE user_id = :uid"), uid)

    # ── Coach-side cleanup ───────────────────────────────────────────────────
    # reviews, bookings, coach_packages reference coaches.id with no CASCADE.
    db.execute(text("""
        DELETE FROM reviews
        WHERE coach_id IN (SELECT id FROM coaches WHERE user_id = :uid)
    """), uid)
    db.execute(text("""
        DELETE FROM bookings
        WHERE coach_id IN (SELECT id FROM coaches WHERE user_id = :uid)
    """), uid)
    db.execute(text("""
        DELETE FROM coach_packages
        WHERE coach_id IN (SELECT id FROM coaches WHERE user_id = :uid)
    """), uid)
    db.execute(text("""
        DELETE FROM coach_education
        WHERE coach_id IN (SELECT id FROM coaches WHERE user_id = :uid)
    """), uid)
    db.execute(text("""
        DELETE FROM coach_experience
        WHERE coach_id IN (SELECT id FROM coaches WHERE user_id = :uid)
    """), uid)
    db.execute(text("""
        DELETE FROM coach_availability
        WHERE coach_id IN (SELECT id FROM coaches WHERE user_id = :uid)
    """), uid)
    db.execute(text("DELETE FROM coaches WHERE user_id = :uid"), uid)

    # ── Subscription requests (approved_by has no CASCADE) ───────────────────
    db.execute(text("UPDATE subscription_requests SET approved_by = NULL WHERE approved_by = :uid"), uid)

    # ── Admin / Owner profile cleanup ────────────────────────────────────────
    db.execute(text("DELETE FROM admins WHERE user_id = :uid"), uid)
    db.execute(text("DELETE FROM owners WHERE user_id = :uid"), uid)

    # ── Chat cleanup ─────────────────────────────────────────────────────────
    # chat_messages.sender_user_id has no CASCADE, must delete manually
    db.execute(text("""
        DELETE FROM chat_messages
        WHERE conversation_id IN (
            SELECT id FROM conversations
            WHERE coach_user_id = :uid OR customer_user_id = :uid
        )
    """), uid)
    db.execute(text("""
        DELETE FROM chat_messages WHERE sender_user_id = :uid
    """), uid)
    db.execute(text("""
        DELETE FROM conversations
        WHERE coach_user_id = :uid OR customer_user_id = :uid
    """), uid)

    # ── Finally delete the user ──────────────────────────────────────────────
    db.execute(text("DELETE FROM users WHERE id = :uid"), uid)
    db.commit()


# ── COACHES ────────────────────────────────────────────────────────────────

def _real_client_count(coach_id: int, db: Session) -> int:
    """Count distinct active clients: assigned + bookings + active package subscribers."""
    try:
        row = db.execute(text("""
            SELECT COUNT(DISTINCT customer_id) AS cnt FROM (
                SELECT c.id AS customer_id
                FROM customers c
                WHERE c.assigned_coach_id = :coach_id
                UNION
                SELECT b.customer_id
                FROM bookings b
                WHERE b.coach_id = :coach_id
                UNION
                SELECT s.customer_id
                FROM subscriptions s
                JOIN coach_packages cp ON s.coach_package_id = cp.id
                WHERE cp.coach_id = :coach_id AND s.status = 'active'
            ) x
        """), {"coach_id": coach_id}).fetchone()
        return row.cnt if row else 0
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"_real_client_count failed for coach {coach_id}: {e}")
        return 0


def _coach_to_dict(coach: Coach, user: User, db: Session) -> dict:
    gym_name = None
    if coach.gym_id:
        from app.models.gym import Gym
        gym = db.query(Gym).filter(Gym.id == coach.gym_id).first()
        gym_name = gym.name if gym else None

    # status: derive from is_available
    status_val = "Active" if coach.is_available else "Inactive"

    # Extract staff_id from placeholder email; hide placeholder email
    email = user.email
    staff_id = None
    if email and "@system.gym" in email:
        # Pattern: PENDING_{staff_id}_{random}@system.gym
        try:
            parts = email.split("@")[0].split("_")  # ['PENDING', staff_id, random]
            if len(parts) >= 3:
                staff_id = parts[1]
        except Exception:
            pass
        email = None  # don't expose placeholder

    avatar_url = None
    try:
        row = db.execute(
            text("SELECT avatar_url FROM coaches WHERE id = :cid"),
            {"cid": coach.id}
        ).fetchone()
        if row:
            avatar_url = row.avatar_url
    except Exception:
        pass

    return {
        "id": coach.id,
        "user_id": user.id,
        "full_name": user.full_name,
        "email": email,
        "staff_id": staff_id,
        "experience_years": coach.experience_years,
        "hourly_rate": coach.hourly_rate,
        "gym_id": coach.gym_id,
        "gym_name": gym_name,
        "specialization": coach.specialty,
        "status": status_val,
        "max_clients": coach.max_clients,
        "current_clients": _real_client_count(coach.id, db),
        "avatar_url": avatar_url,
        "created_at": coach.created_at,
    }


@router.get("/coaches/")
def list_coaches(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    admin_gym_id = _get_admin_gym_id(current_user, db)
    query = db.query(Coach, User).join(User, Coach.user_id == User.id)
    if admin_gym_id is not None:
        query = query.filter(Coach.gym_id == admin_gym_id)
    rows = query.all()
    return [_coach_to_dict(c, u, db) for c, u in rows]


@router.post("/coaches/", status_code=201)
def create_coach(
    data: CoachCreateAdmin,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    # Check staff_id uniqueness via placeholder email pattern
    existing_staff = db.query(User).filter(
        User.email.like(f"PENDING_{data.staff_id}_%@system.gym")
    ).first()
    if existing_staff:
        raise HTTPException(status_code=400, detail="Staff ID already in use")

    # Use provided email if given, else generate placeholder from staff_id
    if data.email:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")
        user_email = data.email
        user_password = hash_password(data.password or uuid.uuid4().hex)
    else:
        user_email = f"PENDING_{data.staff_id}_{uuid.uuid4().hex[:6]}@system.gym"
        user_password = hash_password(uuid.uuid4().hex)

    new_user = User(
        full_name=data.full_name,
        email=user_email,
        password_hash=user_password,
        role="coach",
        is_active=_is_active_from_status(data.status),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    coach_gym_id = data.gym_id or _get_admin_gym_id(current_user, db)
    new_coach = Coach(
        user_id=new_user.id,
        gym_id=coach_gym_id,
        specialty=data.specialization,
        experience_years=data.experience_years,
        hourly_rate=data.hourly_rate,
        is_available=(data.status != "Inactive"),
    )
    db.add(new_coach)
    db.commit()
    db.refresh(new_coach)

    return _coach_to_dict(new_coach, new_user, db)


@router.put("/coaches/{coach_id}")
def update_coach(
    coach_id: int,
    data: CoachUpdateAdmin,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    coach = db.query(Coach).filter(Coach.id == coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    user = db.query(User).filter(User.id == coach.user_id).first()

    if data.full_name is not None and user:
        user.full_name = data.full_name
    if data.experience_years is not None:
        coach.experience_years = data.experience_years
    if data.hourly_rate is not None:
        coach.hourly_rate = data.hourly_rate
    if data.gym_id is not None:
        coach.gym_id = data.gym_id
    if data.specialization is not None:
        coach.specialty = data.specialization
    if data.status is not None:
        coach.is_available = (data.status != "Inactive")
        if user:
            user.is_active = _is_active_from_status(data.status)

    db.commit()
    db.refresh(coach)
    return _coach_to_dict(coach, user, db)


@router.delete("/coaches/{coach_id}", status_code=204)
def delete_coach(
    coach_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    coach = db.query(Coach).filter(Coach.id == coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    user = db.query(User).filter(User.id == coach.user_id).first()
    if user:
        db.delete(user)  # cascade deletes coach profile too
    else:
        db.delete(coach)
    db.commit()


# ── ADMIN GYM INFO ──────────────────────────────────────────────────────────

@router.get("/me/gym")
def get_admin_gym(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return the gym linked to the current admin/owner."""
    admin = db.query(Admin).filter(Admin.user_id == current_user.id).first()
    if not admin or not admin.gym_id:
        return {"gym_id": None, "gym_name": None, "is_super_admin": bool(admin and admin.is_super_admin)}
    gym = db.query(Gym).filter(Gym.id == admin.gym_id).first()
    return {
        "gym_id": admin.gym_id,
        "gym_name": gym.name if gym else None,
        "is_super_admin": bool(admin.is_super_admin),
    }


class AdminGymUpdate(BaseModel):
    gym_id: Optional[int] = None


@router.put("/me/gym")
def update_admin_gym(
    body: AdminGymUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update the gym_id for the current admin/owner."""
    gym_id = body.gym_id
    admin = db.query(Admin).filter(Admin.user_id == current_user.id).first()
    if not admin:
        admin = Admin(user_id=current_user.id)
        db.add(admin)
    admin.gym_id = gym_id
    db.commit()
    gym = db.query(Gym).filter(Gym.id == gym_id).first() if gym_id else None
    return {"gym_id": gym_id, "gym_name": gym.name if gym else None}


# ── MEMBERSHIP PLANS ───────────────────────────────────────────────────────

import json


def _plan_to_dict(plan: MembershipPlan) -> dict:
    features = plan.features
    if features and isinstance(features, str):
        try:
            features = json.loads(features)
        except Exception:
            features = [f.strip() for f in features.split(",") if f.strip()]
    elif not features:
        features = []

    # Parse duration_days back from the period string (e.g. "30 days" → 30)
    duration_days = None
    if plan.period:
        try:
            duration_days = int(plan.period.split()[0])
        except Exception:
            pass

    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "price": plan.price,
        "duration_days": duration_days,
        "features": features,
        "status": "Active" if plan.is_active else "Inactive",
        "created_at": plan.created_at,
    }


@router.get("/membership-plans/")
def list_plans(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    plans = db.query(MembershipPlan).all()
    # Count active subscribers per plan in one query
    counts = dict(
        db.query(Subscription.plan_id, sql_func.count(Subscription.id))
        .filter(Subscription.status == "active", Subscription.plan_id != None)
        .group_by(Subscription.plan_id)
        .all()
    )
    result = []
    for p in plans:
        d = _plan_to_dict(p)
        d["subscriber_count"] = counts.get(p.id, 0)
        result.append(d)
    return result


@router.post("/membership-plans/", status_code=201)
def create_plan(
    data: MembershipPlanCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    features_json = json.dumps(data.features) if data.features else None
    plan = MembershipPlan(
        name=data.name,
        description=data.description,
        price=data.price,
        period=f"{data.duration_days} days" if data.duration_days else None,
        features=features_json,
        is_active=(data.status == "Active"),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _plan_to_dict(plan)


@router.put("/membership-plans/{plan_id}")
def update_plan(
    plan_id: int,
    data: MembershipPlanUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    plan = db.query(MembershipPlan).filter(MembershipPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if data.name is not None:
        plan.name = data.name
    if data.description is not None:
        plan.description = data.description
    if data.price is not None:
        plan.price = data.price
    if data.duration_days is not None:
        plan.period = f"{data.duration_days} days"
    if data.features is not None:
        plan.features = json.dumps(data.features)
    if data.status is not None:
        plan.is_active = (data.status == "Active")

    db.commit()
    db.refresh(plan)
    return _plan_to_dict(plan)


@router.delete("/membership-plans/{plan_id}", status_code=204)
def delete_plan(
    plan_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    plan = db.query(MembershipPlan).filter(MembershipPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    db.delete(plan)
    db.commit()


# ── DASHBOARD STATS ─────────────────────────────────────────────────────────

@router.get("/stats")
def get_admin_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Real dashboard stats for the admin panel."""
    total_users = db.query(sql_func.count(User.id)).scalar() or 0
    active_members = db.query(sql_func.count(User.id)).filter(
        User.role == "user", User.is_active == True
    ).scalar() or 0
    total_coaches = db.query(sql_func.count(User.id)).filter(
        User.role == "coach"
    ).scalar() or 0
    pending_approvals = db.query(sql_func.count(User.id)).filter(
        User.is_active == None
    ).scalar() or 0
    total_branches = db.query(sql_func.count(Gym.id)).scalar() or 0

    # Revenue: only active subscriptions
    total_revenue = db.query(sql_func.sum(Subscription.price)).filter(
        Subscription.status == "active"
    ).scalar() or 0.0

    return {
        "total_users": total_users,
        "active_members": active_members,
        "total_coaches": total_coaches,
        "pending_approvals": pending_approvals,
        "total_branches": total_branches,
        "total_revenue": round(float(total_revenue), 2),
    }


@router.get("/financial-stats")
def get_financial_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Detailed financial stats for Financial Analytics page."""
    # Active revenue only
    total_revenue = db.query(sql_func.sum(Subscription.price)).filter(
        Subscription.status == "active"
    ).scalar() or 0.0
    active_revenue = total_revenue

    active_count = db.query(sql_func.count(Subscription.id)).filter(
        Subscription.status == "active"
    ).scalar() or 0

    # Cancelled + expired count
    inactive_count = db.query(sql_func.count(Subscription.id)).filter(
        Subscription.status.in_(["cancelled", "expired"])
    ).scalar() or 0

    # Revenue by branch — active subscriptions only
    branch_rows = (
        db.query(
            sql_func.coalesce(Gym.name, "No Branch").label("branch_name"),
            sql_func.sum(Subscription.price).label("revenue"),
            sql_func.count(Subscription.id).label("count"),
        )
        .select_from(Subscription)
        .join(Customer, Customer.id == Subscription.customer_id)
        .outerjoin(Gym, Gym.id == Customer.gym_id)
        .filter(Subscription.status == "active")
        .group_by(Gym.name)
        .order_by(sql_func.sum(Subscription.price).desc())
        .all()
    )

    branches = [
        {
            "name": row.branch_name,
            "revenue": round(float(row.revenue or 0), 2),
            "count": row.count,
        }
        for row in branch_rows
    ]

    # Total for percentage calculation
    branch_total = sum(b["revenue"] for b in branches) or 1  # avoid div/0

    for b in branches:
        b["pct"] = round(b["revenue"] / branch_total * 100, 1)

    return {
        "total_revenue": round(float(total_revenue), 2),
        "active_revenue": round(float(active_revenue), 2),
        "active_subscriptions": active_count,
        "inactive_subscriptions": inactive_count,
        "branches": branches,
    }


# ── SUBSCRIPTION REQUESTS ────────────────────────────────────────────────────

class ApproveRequestBody(BaseModel):
    discount: Optional[float] = 0.0
    discount_pct: Optional[float] = 0.0
    notes: Optional[str] = None


class RejectRequestBody(BaseModel):
    notes: Optional[str] = None


class SubscriptionCreateAdmin(BaseModel):
    user_id: int
    plan_id: Optional[int] = None
    coach_package_id: Optional[int] = None
    discount: Optional[float] = 0.0
    discount_pct: Optional[float] = 0.0
    notes: Optional[str] = None


class SubscriptionEditAdmin(BaseModel):
    status: Optional[str] = None          # active, cancelled, expired
    discount: Optional[float] = None
    discount_pct: Optional[float] = None
    final_price: Optional[float] = None
    notes: Optional[str] = None


def _sub_req_to_dict(r: SubscriptionRequest, db) -> dict:
    from app.models.customer import Customer as _Customer
    customer = db.query(_Customer).filter(_Customer.id == r.customer_id).first()
    user = None
    if customer:
        user = db.query(User).filter(User.id == customer.user_id).first()
    return {
        "id": r.id,
        "customer_id": r.customer_id,
        "user_id": user.id if user else None,
        "user_name": user.full_name if user else None,
        "plan_id": r.plan_id,
        "coach_package_id": r.coach_package_id,
        "plan_name": r.plan_name,
        "requested_price": r.requested_price,
        "discount": r.discount or 0.0,
        "discount_pct": r.discount_pct or 0.0,
        "final_price": r.final_price,
        "status": r.status,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _sub_to_dict(sub: Subscription, db) -> dict:
    from app.models.customer import Customer as _Customer
    customer = db.query(_Customer).filter(_Customer.id == sub.customer_id).first()
    user = None
    gym_id = None
    gym_name = None
    if customer:
        user = db.query(User).filter(User.id == customer.user_id).first()
        if customer.gym_id:
            gym = db.query(Gym).filter(Gym.id == customer.gym_id).first()
            gym_id = customer.gym_id
            gym_name = gym.name if gym else None

    # Resolve original price from plan or linked request
    final_price = float(sub.price) if sub.price else 0.0
    original_price = None
    discount_amount = 0.0

    if sub.plan_id:
        plan = db.query(_MembershipPlan).filter(_MembershipPlan.id == sub.plan_id).first()
        if plan and plan.price:
            original_price = float(plan.price)
    # Check for an approved request to get exact discount info
    req_filters = [
        SubscriptionRequest.customer_id == sub.customer_id,
        SubscriptionRequest.status == "approved",
    ]
    coach_pkg_id = getattr(sub, "coach_package_id", None)
    if sub.plan_id:
        req_filters.append(SubscriptionRequest.plan_id == sub.plan_id)
    elif coach_pkg_id:
        req_filters.append(SubscriptionRequest.coach_package_id == coach_pkg_id)
    req = db.query(SubscriptionRequest).filter(*req_filters).order_by(SubscriptionRequest.created_at.desc()).first()
    if req:
        original_price = float(req.requested_price) if req.requested_price else original_price
        discount_amount = float(req.discount) if req.discount else 0.0

    if original_price is not None and original_price > final_price:
        discount_amount = round(original_price - final_price, 2)

    return {
        "id": sub.id,
        "customer_id": sub.customer_id,
        "user_id": user.id if user else None,
        "user_name": user.full_name if user else None,
        "plan_id": sub.plan_id,
        "coach_package_id": getattr(sub, "coach_package_id", None),
        "plan_name": sub.plan_name,
        "original_price": original_price,
        "discount_amount": discount_amount,
        "price": final_price,
        "start_date": sub.start_date.isoformat() if sub.start_date else None,
        "end_date": sub.end_date.isoformat() if sub.end_date else None,
        "status": sub.status,
        "sessions_remaining": sub.sessions_remaining,
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "gym_id": gym_id,
        "gym_name": gym_name,
    }


@router.get("/subscription-requests")
def list_subscription_requests(
    status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(SubscriptionRequest)
    if status:
        q = q.filter(SubscriptionRequest.status == status)
    reqs = q.order_by(SubscriptionRequest.created_at.desc()).all()
    return [_sub_req_to_dict(r, db) for r in reqs]


@router.put("/subscription-requests/{req_id}/approve")
def approve_subscription_request(
    req_id: int,
    body: ApproveRequestBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from datetime import datetime, timedelta
    from app.api.v1.memberships import calculate_end_date, parse_sessions

    req = db.query(SubscriptionRequest).filter(SubscriptionRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req.status}")

    # Block only if the same TYPE of subscription is already active
    # (gym plan + coach package can coexist)
    if req.coach_package_id:
        existing_active = db.query(Subscription).filter(
            Subscription.customer_id == req.customer_id,
            Subscription.status == "active",
            Subscription.coach_package_id != None,
        ).first()
        if existing_active:
            raise HTTPException(
                status_code=400,
                detail=f"This user already has an active coach package ('{existing_active.plan_name}'). Cancel it first.",
            )
    else:
        existing_active = db.query(Subscription).filter(
            Subscription.customer_id == req.customer_id,
            Subscription.status == "active",
            Subscription.plan_id != None,
            Subscription.coach_package_id == None,
        ).first()
        if existing_active:
            raise HTTPException(
                status_code=400,
                detail=f"This user already has an active gym membership ('{existing_active.plan_name}'). Cancel it first.",
            )

    # Calculate final price after discount
    base = req.requested_price
    discount_amt = body.discount or 0.0
    discount_pct = body.discount_pct or 0.0
    if discount_pct > 0:
        discount_amt = round(base * discount_pct / 100, 2)
    final_price = max(0.0, base - discount_amt)

    # Determine period for end-date calculation
    period = None
    plan = db.query(_MembershipPlan).filter(_MembershipPlan.id == req.plan_id).first() if req.plan_id else None
    if plan:
        period = plan.period
        sessions_remaining = parse_sessions(plan.sessions)
    else:
        sessions_remaining = 0

    start_date = datetime.utcnow()
    end_date = calculate_end_date(start_date, period)

    sub = Subscription(
        customer_id=req.customer_id,
        plan_id=req.plan_id,
        coach_package_id=req.coach_package_id,
        plan_name=req.plan_name,
        plan_type=period,
        price=final_price,
        billing_cycle="monthly",
        start_date=start_date,
        end_date=end_date,
        status="active",
        sessions_remaining=sessions_remaining,
    )
    db.add(sub)

    # If this is a coach package subscription, increment the coach's current_clients
    if req.coach_package_id:
        pkg = db.query(CoachPackage).filter(CoachPackage.id == req.coach_package_id).first()
        if pkg:
            coach = db.query(Coach).filter(Coach.id == pkg.coach_id).first()
            if coach:
                coach.current_clients = (coach.current_clients or 0) + 1

    req.status = "approved"
    req.discount = discount_amt
    req.discount_pct = discount_pct
    req.final_price = final_price
    req.notes = body.notes
    req.approved_by = current_user.id

    # Notify the customer
    _cust = db.query(Customer).filter(Customer.id == req.customer_id).first()
    if _cust:
        plan_name = req.plan_name or "your plan"
        create_notification(
            db, _cust.user_id,
            title="Subscription Approved",
            message=f"Your subscription request for '{plan_name}' has been approved! Final price: {final_price:.2f}.",
            type="subscription",
            link="/subscriptions",
        )

    db.commit()
    db.refresh(sub)

    return {
        "message": "Request approved — subscription activated",
        "subscription_id": sub.id,
        "final_price": final_price,
        "discount": discount_amt,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
    }


@router.put("/subscription-requests/{req_id}/reject")
def reject_subscription_request(
    req_id: int,
    body: RejectRequestBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    req = db.query(SubscriptionRequest).filter(SubscriptionRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req.status}")
    req.status = "rejected"
    req.notes = body.notes
    req.approved_by = current_user.id

    # Notify the customer
    _cust = db.query(Customer).filter(Customer.id == req.customer_id).first()
    if _cust:
        plan_name = req.plan_name or "your plan"
        reason_text = f" Reason: {body.notes}" if body.notes else ""
        create_notification(
            db, _cust.user_id,
            title="Subscription Request Rejected",
            message=f"Your subscription request for '{plan_name}' was not approved.{reason_text}",
            type="subscription",
            link="/subscriptions",
        )

    db.commit()
    return {"message": "Request rejected"}


# ── ADMIN SUBSCRIPTION CRUD ──────────────────────────────────────────────────

@router.get("/subscriptions")
def list_all_subscriptions(
    user_id: Optional[int] = None,
    sub_status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.models.customer import Customer as _Customer
    q = db.query(Subscription)
    if user_id:
        customer = db.query(_Customer).filter(_Customer.user_id == user_id).first()
        if customer:
            q = q.filter(Subscription.customer_id == customer.id)
    if sub_status:
        q = q.filter(Subscription.status == sub_status)
    subs = q.order_by(Subscription.created_at.desc()).all()
    return [_sub_to_dict(s, db) for s in subs]


@router.post("/subscriptions", status_code=201)
def admin_create_subscription(
    data: SubscriptionCreateAdmin,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from datetime import datetime
    from app.models.customer import Customer as _Customer
    from app.api.v1.memberships import calculate_end_date, parse_sessions

    if not data.plan_id and not data.coach_package_id:
        raise HTTPException(status_code=400, detail="Either plan_id or coach_package_id is required")

    customer = db.query(_Customer).filter(_Customer.user_id == data.user_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found for this user")

    # Block only if the same TYPE of subscription is already active
    # (gym plan + coach package can coexist)
    if data.coach_package_id:
        existing_active = db.query(Subscription).filter(
            Subscription.customer_id == customer.id,
            Subscription.status == "active",
            Subscription.coach_package_id != None,
        ).first()
        if existing_active:
            raise HTTPException(
                status_code=400,
                detail=f"This user already has an active coach package ('{existing_active.plan_name}'). Cancel it first.",
            )
    else:
        existing_active = db.query(Subscription).filter(
            Subscription.customer_id == customer.id,
            Subscription.status == "active",
            Subscription.plan_id != None,
            Subscription.coach_package_id == None,
        ).first()
        if existing_active:
            raise HTTPException(
                status_code=400,
                detail=f"This user already has an active gym membership ('{existing_active.plan_name}'). Cancel it first.",
            )

    plan = None
    pkg = None
    if data.coach_package_id:
        pkg = db.query(CoachPackage).filter(CoachPackage.id == data.coach_package_id).first()
        if not pkg:
            raise HTTPException(status_code=404, detail="Coach package not found")
    else:
        plan = db.query(_MembershipPlan).filter(_MembershipPlan.id == data.plan_id, _MembershipPlan.is_active == True).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Membership plan not found")

    item = plan or pkg
    base = float(item.price) if item.price else 0.0
    discount_amt = data.discount or 0.0
    discount_pct = data.discount_pct or 0.0
    if discount_pct > 0:
        discount_amt = round(base * discount_pct / 100, 2)
    final_price = max(0.0, base - discount_amt)

    start_date = datetime.utcnow()
    period = getattr(item, 'period', None)
    end_date = calculate_end_date(start_date, period)
    sessions_str = getattr(item, 'sessions', None)
    sessions_remaining = parse_sessions(str(sessions_str)) if sessions_str else 0
    plan_name = plan.name if plan else pkg.package_name

    sub = Subscription(
        customer_id=customer.id,
        plan_id=plan.id if plan else None,
        coach_package_id=pkg.id if pkg else None,
        plan_name=plan_name,
        plan_type=period,
        price=final_price,
        billing_cycle="monthly",
        start_date=start_date,
        end_date=end_date,
        status="active",
        sessions_remaining=sessions_remaining,
    )
    db.add(sub)

    # Notify the user
    create_notification(
        db, data.user_id,
        title="Subscription Activated",
        message=f"Your '{plan_name}' subscription has been activated by admin. Enjoy your membership!",
        type="subscription",
        link="/subscriptions",
    )

    db.commit()
    db.refresh(sub)
    return _sub_to_dict(sub, db)


@router.put("/subscriptions/{sub_id}")
def admin_edit_subscription(
    sub_id: int,
    data: SubscriptionEditAdmin,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if data.status is not None:
        sub.status = data.status
    if data.final_price is not None:
        sub.price = data.final_price
    elif data.discount is not None or data.discount_pct is not None:
        base = float(sub.price) if sub.price else 0.0
        disc_amt = data.discount or 0.0
        disc_pct = data.discount_pct or 0.0
        if disc_pct > 0:
            disc_amt = round(base * disc_pct / 100, 2)
        sub.price = max(0.0, base - disc_amt)

    db.commit()
    db.refresh(sub)
    return _sub_to_dict(sub, db)


@router.delete("/subscriptions/{sub_id}", status_code=204)
def admin_cancel_subscription(
    sub_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.status = "cancelled"
    db.commit()


# ── COACH PACKAGE APPROVAL ─────────────────────────────────────────────────

def _coach_pkg_to_dict(pkg: CoachPackage, db: Session) -> dict:
    coach = db.query(Coach).filter(Coach.id == pkg.coach_id).first()
    coach_user = None
    coach_avatar_url = None
    if coach:
        coach_user = db.query(User).filter(User.id == coach.user_id).first()
        # 1st: try coaches.avatar_url
        try:
            row = db.execute(
                text("SELECT avatar_url FROM coaches WHERE id = :cid"),
                {"cid": coach.id}
            ).fetchone()
            if row and row.avatar_url:
                coach_avatar_url = row.avatar_url
        except Exception:
            pass
        # 2nd: try admin_profiles.profile_photo_path
        if not coach_avatar_url and coach_user:
            try:
                p = db.execute(
                    text("SELECT profile_photo_path FROM admin_profiles WHERE admin_id = :uid"),
                    {"uid": coach_user.id}
                ).fetchone()
                if p and p.profile_photo_path:
                    coach_avatar_url = f"/uploads/profiles/{p.profile_photo_path}"
            except Exception:
                pass

    initials = coach_user.full_name[:2].upper() if coach_user else "CO"

    features = pkg.features
    if features:
        try:
            features = json.loads(features)
        except Exception:
            features = [f.strip() for f in features.split(",") if f.strip()]
    else:
        features = []

    return {
        "id": pkg.id,
        "coach_id": pkg.coach_id,
        "coach_name": coach_user.full_name if coach_user else "Unknown",
        "coach_avatar": coach_avatar_url or initials,
        "coach_rating": float(coach.rating) if coach and coach.rating else 4.5,
        "coach_specialty": coach.specialty if coach and coach.specialty else "General Fitness",
        "package_name": pkg.package_name,
        "period": pkg.period or "1 Month",
        "sessions": pkg.sessions,
        "price": float(pkg.price) if pkg.price else 0.0,
        "original_price": float(pkg.original_price) if pkg.original_price else None,
        "savings": float(pkg.savings) if pkg.savings else None,
        "price_per_session": float(pkg.price_per_session) if pkg.price_per_session else None,
        "features": features,
        "popular": bool(pkg.is_popular),
        "color": pkg.color or "blue",
        "is_active": pkg.is_active,
        "status": pkg.status or "pending",
        "rejection_reason": pkg.rejection_reason,
        "created_at": pkg.created_at.isoformat() if pkg.created_at else None,
    }


class RejectPackageBody(BaseModel):
    reason: str


@router.get("/coach-packages")
def list_coach_packages_admin(
    status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(CoachPackage)
    if status:
        q = q.filter(CoachPackage.status == status)
    packages = q.order_by(CoachPackage.created_at.desc()).all()
    return [_coach_pkg_to_dict(p, db) for p in packages]


@router.put("/coach-packages/{pkg_id}/approve")
def approve_coach_package(
    pkg_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    pkg = db.query(CoachPackage).filter(CoachPackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    pkg.status = "approved"
    pkg.rejection_reason = None

    # Notify the coach
    _coach = db.query(Coach).filter(Coach.id == pkg.coach_id).first()
    if _coach:
        create_notification(
            db, _coach.user_id,
            title="Package Approved",
            message=f"Your package '{pkg.package_name}' has been approved and is now live!",
            type="system",
            link="/coach/packages",
        )

    db.commit()
    db.refresh(pkg)
    return _coach_pkg_to_dict(pkg, db)


@router.put("/coach-packages/{pkg_id}/reject")
def reject_coach_package(
    pkg_id: int,
    body: RejectPackageBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    pkg = db.query(CoachPackage).filter(CoachPackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    pkg.status = "rejected"
    pkg.rejection_reason = body.reason

    # Notify the coach
    _coach = db.query(Coach).filter(Coach.id == pkg.coach_id).first()
    if _coach:
        reason_text = f" Reason: {body.reason}" if body.reason else ""
        create_notification(
            db, _coach.user_id,
            title="Package Rejected",
            message=f"Your package '{pkg.package_name}' was rejected.{reason_text}",
            type="system",
            link="/coach/packages",
        )

    db.commit()
    db.refresh(pkg)
    return _coach_pkg_to_dict(pkg, db)


# ── GET FULL COACH PROFILE (admin view) ────────────────────────────────────

@router.get("/coaches/{coach_id}/profile")
def get_coach_profile_admin(
    coach_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    coach = db.query(Coach).filter(Coach.id == coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    user = db.query(User).filter(User.id == coach.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Coach user not found")

    from app.models.certification import Certification
    from app.models.coach import CoachEducation, CoachExperience
    from app.models.review import Review
    from app.models.booking import Booking
    from sqlalchemy import func as sql_func, distinct

    extra_row = db.execute(
        text("SELECT avatar_url, bio, cv_url, social_facebook, social_instagram, social_linkedin, social_youtube FROM coaches WHERE id = :cid"),
        {"cid": coach.id}
    ).fetchone()
    extra = dict(extra_row._mapping) if extra_row else {}

    certs = [{"id": c.id, "name": c.title or "", "issuer": c.issuing_organization,
               "date_obtained": c.issue_date.strftime("%Y-%m-%d") if c.issue_date else None,
               "verified": c.is_verified or False}
             for c in db.query(Certification).filter(Certification.coach_id == coach.id).all()]

    edu = [{"id": e.id, "degree": e.degree, "institution": e.institution,
             "field_of_study": e.field_of_study, "graduation_year": e.end_year}
           for e in db.query(CoachEducation).filter(CoachEducation.coach_id == coach.id).all()]

    exp = [{"id": ex.id, "position": ex.title, "company": ex.company,
             "start_date": ex.start_date.isoformat() if ex.start_date else None,
             "end_date": ex.end_date.isoformat() if ex.end_date else None,
             "current": ex.is_current or False, "description": ex.description}
           for ex in db.query(CoachExperience).filter(CoachExperience.coach_id == coach.id).all()]

    avg_rating = db.query(sql_func.avg(Review.rating)).filter(Review.coach_id == coach.id).scalar()
    total_reviews = db.query(sql_func.count(Review.id)).filter(Review.coach_id == coach.id).scalar() or 0
    total_clients = _real_client_count(coach.id, db)

    email = user.email
    staff_id = None
    if email and "@system.gym" in email:
        try:
            parts = email.split("@")[0].split("_")
            if len(parts) >= 3:
                staff_id = parts[1]
        except Exception:
            pass
        email = None

    return {
        "id": coach.id,
        "user_id": user.id,
        "full_name": user.full_name,
        "email": email,
        "staff_id": staff_id,
        "phone": getattr(user, "phone", None),
        "specialty": coach.specialty,
        "experience_years": coach.experience_years,
        "hourly_rate": coach.hourly_rate,
        "max_clients": coach.max_clients,
        "current_clients": _real_client_count(coach.id, db),
        "rating": round(float(avg_rating), 1) if avg_rating else 0.0,
        "total_reviews": total_reviews,
        "total_clients": total_clients,
        "is_available": coach.is_available,
        "avatar_url": extra.get("avatar_url"),
        "bio": extra.get("bio"),
        "cv_url": extra.get("cv_url"),
        "social_instagram": extra.get("social_instagram"),
        "social_facebook": extra.get("social_facebook"),
        "social_linkedin": extra.get("social_linkedin"),
        "social_youtube": extra.get("social_youtube"),
        "certifications": certs,
        "education": edu,
        "experience": exp,
    }


# ── SET MAX TRAINEES PER COACH ─────────────────────────────────────────────

class MaxTraineesBody(BaseModel):
    max_clients: int


@router.put("/coaches/{coach_id}/max-trainees")
def set_max_trainees(
    coach_id: int,
    body: MaxTraineesBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    coach = db.query(Coach).filter(Coach.id == coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    coach.max_clients = body.max_clients
    db.commit()
    db.refresh(coach)
    user = db.query(User).filter(User.id == coach.user_id).first()
    return _coach_to_dict(coach, user, db)

# ── Gym Admins with avatar ──────────────────────────────────────────────────
@router.get("/gym-admins/{gym_id}")
def get_gym_admins_with_avatar(
    gym_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return admins (not owners) belonging to a gym, including their profile photo."""
    admin_rows = db.query(Admin).filter(Admin.gym_id == gym_id).all()
    base = str(request.base_url).rstrip("/")

    result = []
    for a in admin_rows:
        u = db.query(User).filter(User.id == a.user_id).first()
        if not u:
            continue
        # Skip owners — they share admin_profiles but are not admins
        if u.role == "owner":
            continue

        # Fetch profile photo from admin_profiles table
        profile_photo_url = None
        try:
            row = db.execute(
                text("SELECT profile_photo_path FROM admin_profiles WHERE admin_id = :uid"),
                {"uid": u.id},
            ).fetchone()
            if row and row.profile_photo_path:
                profile_photo_url = f"{base}/uploads/profiles/{row.profile_photo_path}"
        except Exception:
            pass

        # Fallback: admins.avatar_url
        if not profile_photo_url:
            profile_photo_url = getattr(a, "avatar_url", None) or None

        joined = (
            getattr(a, "created_at", None)
            or getattr(a, "joined_at", None)
            or getattr(u, "created_at", None)
        )

        result.append({
            "id":         u.id,
            "name":       u.full_name or u.email or "",
            "email":      u.email or "",
            "phone":      getattr(u, "phone", None) or "",
            "status":     "active" if u.is_active else "inactive",
            "gym_id":     a.gym_id,
            "avatar_url": profile_photo_url,
            "joinedAt":   joined.isoformat() if joined else None,
        })
    return result

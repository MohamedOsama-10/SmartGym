# app/api/v1/memberships.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.database import get_db
from app.api.deps import get_current_user, require_customer
from app.models.user import User
from app.models.customer import Customer
from app.models.subscription import Subscription
from app.models.subscription_request import SubscriptionRequest
from app.models.membership_plan import MembershipPlan
from app.models.coach_package import CoachPackage
from app.models.coach import Coach
from sqlalchemy import text
from app.api.v1.notifications import create_notification

router = APIRouter(prefix="/memberships", tags=["Memberships & Packages"])


# ==================== PYDANTIC SCHEMAS ====================

class MembershipPlanResponse(BaseModel):
    id: int
    name: str
    period: Optional[str] = "1 Month"
    price: Optional[float] = None
    original_price: Optional[float] = None
    savings: Optional[float] = None
    sessions: Optional[str] = "Unlimited"
    features: List[str] = []
    popular: bool = False
    color: str = "blue"
    icon: str = "📅"

    class Config:
        from_attributes = True


class CoachPackageResponse(BaseModel):
    id: int
    coach_id: int
    coach_name: str
    coach_avatar: str
    coach_rating: float
    coach_specialty: str
    package_name: str
    period: Optional[str] = "1 Month"
    sessions: int
    price: float
    original_price: Optional[float] = None
    savings: Optional[float] = None
    price_per_session: Optional[float] = None
    features: List[str] = []
    popular: bool = False
    color: str = "blue"

    class Config:
        from_attributes = True


class MembershipRequestCreate(BaseModel):
    plan_id: Optional[int] = None
    coach_package_id: Optional[int] = None


class SubscriptionResponse(BaseModel):
    id: int
    plan_id: Optional[int] = None
    coach_package_id: Optional[int] = None
    plan_name: str
    price: float
    start_date: str
    end_date: str
    status: str
    sessions_remaining: Optional[int] = None

    class Config:
        from_attributes = True


# ==================== HELPER FUNCTIONS ====================

def parse_features(features_text: Optional[str]) -> List[str]:
    if not features_text:
        return []
    import json
    if features_text.strip().startswith("["):
        try:
            return json.loads(features_text)
        except Exception:
            pass
    return [f.strip() for f in features_text.split('\n') if f.strip()]


def calculate_end_date(start_date: datetime, period: Optional[str]) -> datetime:
    period_months = 1
    if period:
        period_lower = period.lower()
        if "3" in period or "quarter" in period_lower:
            period_months = 3
        elif "6" in period or "half" in period_lower:
            period_months = 6
        elif "12" in period or "year" in period_lower or "annual" in period_lower:
            period_months = 12
    return start_date + timedelta(days=30 * period_months)


def parse_sessions(sessions_str: Optional[str]) -> int:
    if not sessions_str or sessions_str.lower() in ["unlimited", "none", "null", ""]:
        return 999
    try:
        import re
        numbers = re.findall(r'\d+', str(sessions_str))
        if numbers:
            return int(numbers[0])
        return 0
    except (ValueError, TypeError):
        return 0


# ==================== USER ENDPOINTS ====================

@router.get("/plans", response_model=List[MembershipPlanResponse])
def get_membership_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_plans = db.query(MembershipPlan).filter(MembershipPlan.is_active == True).all()
    if not db_plans:
        return []
    return [
        MembershipPlanResponse(
            id=plan.id,
            name=plan.name,
            period=plan.period or "1 Month",
            price=float(plan.price) if plan.price else None,
            original_price=float(plan.original_price) if plan.original_price else None,
            savings=float(plan.savings) if plan.savings else None,
            sessions=plan.sessions or "Unlimited",
            features=parse_features(plan.features),
            popular=plan.is_popular or False,
            color=plan.color or "blue",
            icon=plan.icon or "📅"
        )
        for plan in db_plans
    ]


@router.get("/coach-packages", response_model=List[CoachPackageResponse])
def get_coach_packages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_packages = db.query(CoachPackage).filter(
        CoachPackage.is_active == True,
        CoachPackage.status == "approved",
    ).all()
    result = []
    for pkg in db_packages:
        coach = db.query(Coach).filter(Coach.id == pkg.coach_id).first()
        coach_user = None
        coach_avatar_url = None
        if coach:
            coach_user = db.query(User).filter(User.id == coach.user_id).first()
            try:
                row = db.execute(
                    text("SELECT avatar_url FROM coaches WHERE id = :cid"),
                    {"cid": coach.id}
                ).fetchone()
                if row:
                    coach_avatar_url = row.avatar_url
            except Exception:
                pass
        initials = coach_user.full_name[:2].upper() if coach_user else "CO"
        result.append(CoachPackageResponse(
            id=pkg.id,
            coach_id=pkg.coach_id,
            coach_name=coach_user.full_name if coach_user else "Coach",
            coach_avatar=coach_avatar_url or initials,
            coach_rating=float(coach.rating) if coach and coach.rating else 4.5,
            coach_specialty=coach.specialty if coach and coach.specialty else "General Fitness",
            package_name=pkg.package_name,
            period=pkg.period or "1 Month",
            sessions=pkg.sessions,
            price=float(pkg.price) if pkg.price else 0.0,
            original_price=float(pkg.original_price) if pkg.original_price else None,
            savings=float(pkg.savings) if pkg.savings else None,
            price_per_session=float(pkg.price_per_session) if pkg.price_per_session else None,
            features=parse_features(pkg.features),
            popular=pkg.is_popular or False,
            color=pkg.color or "blue"
        ))
    return result


@router.post("/request", status_code=201)
def request_membership(
    data: MembershipRequestCreate,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db),
):
    """User submits a membership request — admin must approve to activate."""
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")

    if not data.plan_id and not data.coach_package_id:
        raise HTTPException(status_code=400, detail="Either plan_id or coach_package_id is required")

    # Find the plan (gym or coach package)
    plan = None
    package = None
    if data.coach_package_id:
        # Explicitly requesting a coach package
        package = db.query(CoachPackage).filter(
            CoachPackage.id == data.coach_package_id,
            CoachPackage.is_active == True,
            CoachPackage.status == "approved",
        ).first()
        if not package:
            raise HTTPException(status_code=404, detail="Coach package not found or not approved")
    else:
        # Requesting a gym membership plan
        plan = db.query(MembershipPlan).filter(
            MembershipPlan.id == data.plan_id,
            MembershipPlan.is_active == True
        ).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Membership plan not found")

    # ── Conflict checks: allow one active gym plan + one active coach package ──
    if data.coach_package_id:
        # Requesting a COACH package — block if already has an active coach package
        active_coach_sub = db.query(Subscription).filter(
            Subscription.customer_id == customer.id,
            Subscription.status == "active",
            Subscription.coach_package_id != None,
        ).first()
        if active_coach_sub:
            raise HTTPException(
                status_code=400,
                detail=f"You already have an active coach package ('{active_coach_sub.plan_name}'). Cancel it before subscribing to another.",
            )
        # Block if already has a pending coach package request
        pending_coach_req = db.query(SubscriptionRequest).filter(
            SubscriptionRequest.customer_id == customer.id,
            SubscriptionRequest.status == "pending",
            SubscriptionRequest.coach_package_id != None,
        ).first()
        if pending_coach_req:
            raise HTTPException(
                status_code=400,
                detail=f"You already have a pending coach package request ('{pending_coach_req.plan_name}'). Wait for it to be reviewed.",
            )
    else:
        # Requesting a GYM plan — block if already has an active gym plan
        active_gym_sub = db.query(Subscription).filter(
            Subscription.customer_id == customer.id,
            Subscription.status == "active",
            Subscription.plan_id != None,
            Subscription.coach_package_id == None,
        ).first()
        if active_gym_sub:
            raise HTTPException(
                status_code=400,
                detail=f"You already have an active gym membership ('{active_gym_sub.plan_name}'). Cancel it before subscribing to another.",
            )
        # Block if already has a pending gym plan request
        pending_gym_req = db.query(SubscriptionRequest).filter(
            SubscriptionRequest.customer_id == customer.id,
            SubscriptionRequest.status == "pending",
            SubscriptionRequest.plan_id != None,
            SubscriptionRequest.coach_package_id == None,
        ).first()
        if pending_gym_req:
            raise HTTPException(
                status_code=400,
                detail=f"You already have a pending gym membership request ('{pending_gym_req.plan_name}'). Wait for it to be reviewed.",
            )

    price = float(plan.price if plan else package.price) if (plan or package) else 0.0
    plan_name = plan.name if plan else package.package_name

    req = SubscriptionRequest(
        customer_id=customer.id,
        plan_id=plan.id if plan else None,
        coach_package_id=package.id if package else None,
        plan_name=plan_name,
        requested_price=price,
        discount=0.0,
        discount_pct=0.0,
        final_price=price,
        status="pending",
    )
    db.add(req)

    # Notify the coach if it's a coach package request
    if package:
        _coach = db.query(Coach).filter(Coach.id == package.coach_id).first()
        if _coach:
            create_notification(
                db, _coach.user_id,
                title="New Package Subscription Request",
                message=f"{current_user.full_name} requested to subscribe to your package '{plan_name}'. Awaiting admin approval.",
                type="subscription",
                link="/coach/packages",
            )

    # Notify all admins
    admins = db.query(User).filter(User.role == "admin").all()
    for admin in admins:
        create_notification(
            db, admin.id,
            title="New Subscription Request",
            message=f"{current_user.full_name} requested a subscription to '{plan_name}'.",
            type="subscription",
            link="/admin",
        )

    db.commit()
    db.refresh(req)

    return {
        "id": req.id,
        "plan_name": req.plan_name,
        "requested_price": req.requested_price,
        "status": req.status,
        "message": "Your membership request has been submitted. Waiting for admin approval.",
    }


@router.get("/my-requests")
def get_my_requests(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db),
):
    """Get all membership requests for the current user."""
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")

    reqs = db.query(SubscriptionRequest).filter(
        SubscriptionRequest.customer_id == customer.id
    ).order_by(SubscriptionRequest.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "plan_id": r.plan_id,
            "coach_package_id": r.coach_package_id,
            "plan_name": r.plan_name,
            "requested_price": r.requested_price,
            "discount": r.discount,
            "discount_pct": r.discount_pct,
            "final_price": r.final_price,
            "status": r.status,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reqs
    ]


@router.get("/my-subscriptions", response_model=List[SubscriptionResponse])
def get_my_subscriptions(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")

    subscriptions = db.query(Subscription).filter(
        Subscription.customer_id == customer.id,
        Subscription.status == "active"
    ).order_by(Subscription.start_date.desc()).all()

    result = []
    for sub in subscriptions:
        try:
            result.append(SubscriptionResponse(
                id=sub.id,
                plan_id=sub.plan_id,
                coach_package_id=getattr(sub, 'coach_package_id', None),
                plan_name=sub.plan_name or "Unknown Plan",
                price=float(sub.price) if sub.price else 0.0,
                start_date=sub.start_date.isoformat() if sub.start_date else "",
                end_date=sub.end_date.isoformat() if sub.end_date else "",
                status=sub.status or "active",
                sessions_remaining=getattr(sub, 'sessions_remaining', None)
            ))
        except Exception as e:
            print(f"Error serializing subscription {sub.id}: {e}")
            continue
    return result


@router.delete("/admin/clear-all", response_model=dict)
def clear_all_plans_and_packages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Admin or owner access required")

    db.query(Subscription).filter(Subscription.plan_id != None).update(
        {"plan_id": None}, synchronize_session=False
    )
    db.query(Subscription).filter(Subscription.coach_package_id != None).update(
        {"coach_package_id": None}, synchronize_session=False
    )

    coach_count = db.query(CoachPackage).count()
    db.query(CoachPackage).delete(synchronize_session=False)
    plan_count = db.query(MembershipPlan).count()
    db.query(MembershipPlan).delete(synchronize_session=False)
    db.commit()

    return {
        "message": "All membership plans and coach packages deleted successfully",
        "deleted_gym_plans": plan_count,
        "deleted_coach_packages": coach_count,
    }
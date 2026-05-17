# app/api/v1/coach.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta, date

from app.database import get_db
from app.api.deps import require_coach, get_current_user
from app.models.user import User
from app.models.coach import Coach
from app.models.customer import Customer
from app.models.booking import Booking
from app.models.review import Review
from app.models.subscription import Subscription
from app.models.coach_package import CoachPackage

router = APIRouter(prefix="/coach", tags=["Coach Dashboard"])

# ── helper ────────────────────────────────────────────────────────────────────

def _calculate_age(dob) -> int | None:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

def _build_trainee_dict(customer: Customer, user: User, db: Session, coach_id: int) -> dict:
    last_booking = db.query(Booking).filter(
        Booking.customer_id == customer.id,
        Booking.coach_id == coach_id
    ).order_by(Booking.session_date.desc()).first()

    total_sessions = db.query(Booking).filter(
        Booking.customer_id == customer.id,
        Booking.coach_id == coach_id
    ).count()

    # Get active subscription for plan name and end date
    subscription = db.query(Subscription).filter(
        Subscription.customer_id == customer.id,
        Subscription.status == "active"
    ).order_by(Subscription.created_at.desc()).first()

    return {
        # identity
        "id":           customer.id,
        "user_id":      user.id,
        "name":         user.full_name,
        "full_name":    user.full_name,
        "email":        user.email,
        "phone":        user.phone,
        "avatar_url":   customer.avatar_url if hasattr(customer, "avatar_url") else None,
        # physical stats
        "weight":       float(customer.weight)        if customer.weight        else None,
        "height":       float(customer.height)        if customer.height        else None,
        "date_of_birth": str(customer.date_of_birth)  if customer.date_of_birth else None,
        "age":          _calculate_age(customer.date_of_birth),
        "gender":       customer.gender,
        # fitness
        "goal":         customer.goal,
        # subscription
        "plan_name":        subscription.plan_name if subscription else None,
        "subscription_end": subscription.end_date.strftime("%Y-%m-%d") if subscription and subscription.end_date else None,
        # session info
        "last_session":   last_booking.session_date.isoformat() if last_booking else None,
        "total_sessions": total_sessions,
    }

# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/dashboard-stats")
def get_dashboard_stats(
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Get aggregated stats for coach dashboard"""
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    bookings = db.query(Booking).filter(Booking.coach_id == coach.id).all()

    total_clients = db.query(Booking.customer_id).filter(
        Booking.coach_id == coach.id
    ).distinct().count()

    completed_sessions = db.query(Booking).filter(
        Booking.coach_id == coach.id,
        Booking.status == "attended"
    ).count()

    total_sessions = len(bookings)
    success_rate = round((completed_sessions / total_sessions * 100), 1) if total_sessions > 0 else 0

    start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_bookings = db.query(Booking).filter(
        Booking.coach_id == coach.id,
        Booking.status == "attended",
        Booking.session_date >= start_of_month
    ).all()

    earnings_this_month = sum(
        b.price if b.price else coach.hourly_rate or 0
        for b in monthly_bookings
    )

    reviews = db.query(Review).filter(Review.coach_id == coach.id).all()
    avg_rating = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 4.5

    return {
        "coach_id":            coach.id,
        "name":                current_user.full_name,
        "email":               current_user.email,
        "rating":              avg_rating,
        "total_reviews":       len(reviews),
        "total_clients":       total_clients,
        "success_rate":        success_rate,
        "earnings_this_month": earnings_this_month,
        "total_sessions":      total_sessions,
        "completed_sessions":  completed_sessions,
        "hourly_rate":         coach.hourly_rate,
        "experience_years":    coach.experience_years,
        "specialty":           coach.specialty,
    }


@router.get("/trainees", response_model=List[dict])
def get_coach_trainees(
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Get all trainees assigned to this coach"""
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    # Customers via bookings (direct sessions)
    booking_trainees = db.query(Customer, User).join(
        User, Customer.user_id == User.id
    ).join(
        Booking, Booking.customer_id == Customer.id
    ).filter(
        Booking.coach_id == coach.id
    ).distinct().all()

    # Customers via approved coach package subscriptions
    coach_package_ids = [
        pkg.id for pkg in db.query(CoachPackage).filter(CoachPackage.coach_id == coach.id).all()
    ]
    package_trainees = []
    if coach_package_ids:
        package_trainees = db.query(Customer, User).join(
            User, Customer.user_id == User.id
        ).join(
            Subscription, Subscription.customer_id == Customer.id
        ).filter(
            Subscription.coach_package_id.in_(coach_package_ids),
            Subscription.status == "active",
        ).distinct().all()

    # Merge, deduplicate by customer id
    seen_ids = set()
    all_trainees = []
    for customer, user in booking_trainees + package_trainees:
        if customer.id not in seen_ids:
            seen_ids.add(customer.id)
            all_trainees.append((customer, user))

    return [_build_trainee_dict(customer, user, db, coach.id) for customer, user in all_trainees]


@router.get("/trainees/{customer_id}")
def get_trainee_details(
    customer_id: int,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Get full profile of a specific trainee"""
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    # Verify coach has access: via booking OR active package subscription
    has_booking = db.query(Booking).filter(
        Booking.customer_id == customer_id,
        Booking.coach_id == coach.id
    ).first()
    if not has_booking:
        pkg_ids = [p.id for p in db.query(CoachPackage).filter(CoachPackage.coach_id == coach.id).all()]
        has_pkg_sub = bool(pkg_ids) and db.query(Subscription).filter(
            Subscription.customer_id == customer_id,
            Subscription.coach_package_id.in_(pkg_ids),
            Subscription.status == "active",
        ).first()
        if not has_pkg_sub:
            raise HTTPException(status_code=404, detail="Trainee not found")

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    user = db.query(User).filter(User.id == customer.user_id).first()

    return _build_trainee_dict(customer, user, db, coach.id)
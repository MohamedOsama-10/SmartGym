#D:\gym_system\Gym_Backend\app\api\v1\subscriptions.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.api.deps import require_customer
from app.models.user import User
from app.models.customer import Customer
from app.models.subscription import Subscription
from app.models.booking import Booking

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


def serialize_subscription(sub: Subscription, db: Session):
    """Helper to serialize subscription with stats"""
    sub_bookings = db.query(Booking).filter(Booking.subscription_id == sub.id).all()
    
    return {
        "id": sub.id,
        "customer_id": sub.customer_id,
        "plan_name": sub.plan_name,
        "plan_type": sub.plan_type,
        "price": float(sub.price) if sub.price else 0,
        "billing_cycle": sub.billing_cycle,
        "start_date": sub.start_date.isoformat() if sub.start_date else None,
        "end_date": sub.end_date.isoformat() if sub.end_date else None,
        "status": sub.status,
        "total_bookings": len(sub_bookings),
        "attended_count": sum(1 for b in sub_bookings if b.status == "attended"),
        "missed_count": sum(1 for b in sub_bookings if b.status == "missed"),
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        # Frontend compatibility aliases
        "name": sub.plan_name,
        "startDate": sub.start_date.isoformat() if sub.start_date else None,
        "endDate": sub.end_date.isoformat() if sub.end_date else None,
        "billingCycle": sub.billing_cycle,
    }


@router.get("/my-subscriptions")
def get_my_subscriptions(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    subscriptions = db.query(Subscription).filter(
        Subscription.customer_id == customer.id
    ).order_by(Subscription.start_date.desc()).all()
    
    return [serialize_subscription(sub, db) for sub in subscriptions]


@router.get("/my-subscriptions/{subscription_id}")
def get_subscription_detail(
    subscription_id: int,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_id,
        Subscription.customer_id == customer.id
    ).first()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return serialize_subscription(subscription, db)
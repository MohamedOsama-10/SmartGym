#D:\gym_system\Gym_Backend\app\api\v1\reviews.py
# app/api/v1/reviews.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.api.deps import get_current_user, require_customer
from app.models.user import User
from app.models.customer import Customer
from app.models.booking import Booking
from app.models.review import Review  # ADD THIS IMPORT - it was missing!
from pydantic import BaseModel

router = APIRouter(prefix="/reviews", tags=["Reviews"])

class ReviewCreate(BaseModel):
    booking_id: int
    coach_id: int
    rating: int
    comment: Optional[str] = None

class ReviewResponse(BaseModel):
    id: int
    booking_id: int
    customer_id: int
    coach_id: int
    rating: int
    comment: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """Create a review for a completed booking"""
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    # Verify booking exists and belongs to customer
    booking = db.query(Booking).filter(
        Booking.id == review_data.booking_id,
        Booking.customer_id == customer.id,
        Booking.status == "attended"  # Only allow reviews for attended bookings
    ).first()
    
    if not booking:
        raise HTTPException(
            status_code=400, 
            detail="Booking not found or not eligible for review"
        )
    
    # Check if review already exists
    existing = db.query(Review).filter(Review.booking_id == review_data.booking_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Review already exists for this booking")
    
    review = Review(
        booking_id=review_data.booking_id,
        customer_id=customer.id,
        coach_id=review_data.coach_id,
        rating=review_data.rating,
        comment=review_data.comment,
        created_at=datetime.utcnow()
    )
    
    db.add(review)
    db.commit()
    db.refresh(review)
    
    return review

@router.get("/coach/{coach_id}", response_model=List[ReviewResponse])
def get_coach_reviews(
    coach_id: int,
    db: Session = Depends(get_db)
):
    """Get all reviews for a coach"""
    reviews = db.query(Review).filter(Review.coach_id == coach_id).all()
    return reviews
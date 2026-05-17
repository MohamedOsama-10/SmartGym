#D:\gym_system\Gym_Backend\app\api\v1\coach_trainees.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, text
from typing import List, Optional
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.customer import Customer
from app.models.coach import Coach
from app.models.booking import Booking
from app.models.meal import MealLog, NutritionGoal

router = APIRouter(prefix="/coach/trainees", tags=["Coach Trainees"])


def calculate_age(dob: date) -> Optional[int]:
    """Calculate age from date of birth"""
    if not dob:
        return None
    today = date.today()
    return relativedelta(today, dob).years


@router.get("")
def get_coach_trainees(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all trainees (customers) for the current coach.
    A trainee is a customer who has at least one booking with this coach.
    """
    # Verify user is a coach
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach profile not found"
        )

    # Get all customers who have bookings with this coach
    trainees_query = db.query(Customer).distinct().join(
        Booking, Booking.customer_id == Customer.id
    ).filter(
        Booking.coach_id == coach.id
    ).order_by(Customer.full_name)

    trainees = trainees_query.all()

    result = []
    for t in trainees:
        # Get booking stats
        total_bookings = db.query(Booking).filter(
            Booking.customer_id == t.id,
            Booking.coach_id == coach.id
        ).count()

        # Get upcoming booking
        upcoming = db.query(Booking).filter(
            Booking.customer_id == t.id,
            Booking.coach_id == coach.id,
            Booking.session_date >= date.today(),
            Booking.status.in_(['confirmed', 'pending'])
        ).order_by(Booking.session_date, Booking.session_time).first()

        # Get workout stats
        total_workouts = db.execute(
            text("SELECT COUNT(*) FROM assigned_workouts WHERE customer_id = :cid"),
            {"cid": t.id}
        ).scalar() or 0

        completed_workouts = db.execute(
            text("SELECT COUNT(*) FROM assigned_workouts WHERE customer_id = :cid AND status = 'completed'"),
            {"cid": t.id}
        ).scalar() or 0

        # Calculate age from DOB
        age = calculate_age(t.date_of_birth) if t.date_of_birth else None

        result.append({
            "id": t.id,
            "userId": t.user_id,
            "fullName": t.full_name or current_user.full_name,
            "email": t.email or current_user.email,
            "phone": t.phone,
            "avatarUrl": t.avatar_url,
            "goal": t.goal or "General Fitness",
            "weight": t.weight,
            "height": t.height,
            "age": age,
            "gender": t.gender,
            "dateOfBirth": t.date_of_birth.isoformat() if t.date_of_birth else None,
            "joinedDate": t.joined_date.isoformat() if t.joined_date else None,
            "totalBookings": total_bookings,
            "upcomingBooking": {
                "id": upcoming.id,
                "date": upcoming.session_date.isoformat() if upcoming else None,
                "time": upcoming.session_time.strftime("%H:%M") if upcoming and upcoming.session_time else None,
                "type": upcoming.session_type if upcoming else None,
                "title": upcoming.title if upcoming else None
            } if upcoming else None,
            "completedWorkouts": completed_workouts,
            "totalWorkouts": total_workouts
        })

    return result


@router.get("/{customer_id}")
def get_trainee_details(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific trainee.
    """
    # Verify user is a coach
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach profile not found"
        )

    # Get customer
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # Verify this coach has access to this customer
    has_booking = db.query(Booking).filter(
        Booking.customer_id == customer_id,
        Booking.coach_id == coach.id
    ).first()

    if not has_booking and coach.id != customer.assigned_coach_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this customer's details"
        )

    # Get user details
    user = db.query(User).filter(User.id == customer.user_id).first()

    # Calculate age from DOB
    age = calculate_age(customer.date_of_birth) if customer.date_of_birth else None

    # Get booking stats
    total_bookings = db.query(Booking).filter(
        Booking.customer_id == customer_id,
        Booking.coach_id == coach.id
    ).count()

    upcoming_bookings = db.query(Booking).filter(
        Booking.customer_id == customer_id,
        Booking.coach_id == coach.id,
        Booking.session_date >= date.today(),
        Booking.status.in_(['confirmed', 'pending'])
    ).order_by(Booking.session_date, Booking.session_time).limit(5).all()

    # Get workout stats
    total_workouts = db.execute(
        text("SELECT COUNT(*) FROM assigned_workouts WHERE customer_id = :cid"),
        {"cid": customer_id}
    ).scalar() or 0

    completed_workouts = db.execute(
        text("SELECT COUNT(*) FROM assigned_workouts WHERE customer_id = :cid AND status = 'completed'"),
        {"cid": customer_id}
    ).scalar() or 0

    # Get nutrition goals
    nutrition_goal = db.query(NutritionGoal).filter(
        NutritionGoal.customer_id == customer_id
    ).first()

    # Get recent meal logs (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_meals = db.query(MealLog).filter(
        MealLog.customer_id == customer_id,
        MealLog.logged_at >= week_ago
    ).count()

    return {
        "id": customer.id,
        "userId": customer.user_id,
        "fullName": customer.full_name or user.full_name if user else None,
        "email": customer.email or user.email if user else None,
        "phone": customer.phone or user.phone if user else None,
        "avatarUrl": customer.avatar_url,
        "goal": customer.goal or "General Fitness",
        "weight": customer.weight,
        "height": customer.height,
        "age": age,
        "gender": customer.gender,
        "dateOfBirth": customer.date_of_birth.isoformat() if customer.date_of_birth else None,
        "weightGoal": customer.weight_goal,
        "bio": customer.bio,
        "joinedDate": customer.joined_date.isoformat() if customer.joined_date else None,
        "membershipId": customer.membership_id,
        "assignedCoachId": customer.assigned_coach_id,
        
        # Stats
        "stats": {
            "totalBookings": total_bookings,
            "upcomingBookings": len(upcoming_bookings),
            "totalWorkouts": total_workouts,
            "completedWorkouts": completed_workouts,
            "workoutCompletionRate": round((completed_workouts / total_workouts * 100), 1) if total_workouts > 0 else 0,
            "recentMealsLogged": recent_meals
        },
        
        # Nutrition Goals
        "nutritionGoals": {
            "calories": nutrition_goal.calories if nutrition_goal else 2000,
            "protein": nutrition_goal.protein if nutrition_goal else 150,
            "carbs": nutrition_goal.carbs if nutrition_goal else 250,
            "fats": nutrition_goal.fats if nutrition_goal else 70
        } if nutrition_goal else None,
        
        # Upcoming bookings
        "upcomingBookings": [{
            "id": b.id,
            "date": b.session_date.isoformat(),
            "time": b.session_time.strftime("%H:%M") if b.session_time else None,
            "type": b.session_type,
            "title": b.title,
            "duration": b.duration_minutes,
            "status": b.status
        } for b in upcoming_bookings]
    }
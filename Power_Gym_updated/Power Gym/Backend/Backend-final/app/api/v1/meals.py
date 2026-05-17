from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, cast, Date
from typing import List, Optional, Union
from datetime import datetime, date, timedelta
import json
import os
import uuid
import shutil
from app.utils.cloudinary_upload import upload_file as cloudinary_upload_file
from PIL import Image

from app.database import get_db
from app.api.deps import get_current_user, require_customer
from app.models.user import User
from app.models.customer import Customer
from app.models.coach import Coach
from app.models.booking import Booking
from app.models.meal import Meal, MealLog, NutritionGoal
from app.models.subscription import Subscription
from app.models.coach_package import CoachPackage
from app.schemas.meal import (
    MealCreate, MealUpdate, MealResponse, MealLogCreate, MealLogResponse,
    NutritionGoalBase, NutritionGoalUpdate, NutritionGoalResponse,
    NutritionGoalCreate,
    DailyNutrition, DailyLogSummary, MealHistoryEntry, MealType
)

router = APIRouter(prefix="/meals", tags=["Meals & Nutrition"])


# ==================== SYSTEM MEALS (Mock Data) ====================

SYSTEM_MEALS = [
    {
        "id": -1,
        "name": "Grilled Chicken Salad",
        "type": "lunch",
        "calories": 450,
        "protein": 35,
        "carbs": 25,
        "fats": 20,
        "image_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
        "ingredients": json.dumps(["Grilled chicken breast", "Mixed greens", "Cherry tomatoes", "Cucumber", "Olive oil dressing"]),
        "is_favorite": True,
        "is_custom": False
    },
    {
        "id": -2,
        "name": "Protein Oatmeal",
        "type": "breakfast",
        "calories": 380,
        "protein": 28,
        "carbs": 45,
        "fats": 8,
        "image_url": "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=400&h=300&fit=crop",
        "ingredients": json.dumps(["Oats", "Whey protein", "Banana", "Almond butter", "Honey"]),
        "is_favorite": False,
        "is_custom": False
    },
    {
        "id": -3,
        "name": "Salmon with Quinoa",
        "type": "dinner",
        "calories": 520,
        "protein": 42,
        "carbs": 35,
        "fats": 22,
        "image_url": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop",
        "ingredients": json.dumps(["Grilled salmon", "Quinoa", "Steamed broccoli", "Lemon", "Herbs"]),
        "is_favorite": True,
        "is_custom": False
    },
    {
        "id": -4,
        "name": "Greek Yogurt Parfait",
        "type": "snack",
        "calories": 280,
        "protein": 20,
        "carbs": 32,
        "fats": 6,
        "image_url": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop",
        "ingredients": json.dumps(["Greek yogurt", "Mixed berries", "Granola", "Chia seeds"]),
        "is_favorite": False,
        "is_custom": False
    },
    {
        "id": -5,
        "name": "Egg White Omelette",
        "type": "breakfast",
        "calories": 320,
        "protein": 30,
        "carbs": 12,
        "fats": 16,
        "image_url": "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&h=300&fit=crop",
        "ingredients": json.dumps(["Egg whites", "Spinach", "Mushrooms", "Bell peppers", "Feta cheese"]),
        "is_favorite": False,
        "is_custom": False
    },
    {
        "id": -6,
        "name": "Turkey Sandwich",
        "type": "lunch",
        "calories": 420,
        "protein": 32,
        "carbs": 40,
        "fats": 14,
        "image_url": "https://images.unsplash.com/photo-1553909489-cd47e3b4430a?w=400&h=300&fit=crop",
        "ingredients": json.dumps(["Whole grain bread", "Turkey breast", "Lettuce", "Tomato", "Mustard"]),
        "is_favorite": True,
        "is_custom": False
    },
]


def get_or_create_nutrition_goal(db: Session, customer_id: int) -> NutritionGoal:
    """Get or create default nutrition goal for customer"""
    goal = db.query(NutritionGoal).filter(NutritionGoal.customer_id == customer_id).first()
    if not goal:
        goal = NutritionGoal(
            customer_id=customer_id,
            calories=2000,
            protein=150,
            carbs=250,
            fats=70
        )
        db.add(goal)
        db.commit()
        db.refresh(goal)
    return goal


def get_customer_or_404(db: Session, user_id: int) -> Customer:
    """Get customer profile or raise 404"""
    customer = db.query(Customer).filter(Customer.user_id == user_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    return customer


def get_or_create_system_meal(db: Session, system_meal_id: int, customer_id: int) -> Meal:
    """
    Convert a system meal (negative ID) to a real database meal.
    Creates it in the database if it doesn't exist for this customer.
    Returns the actual Meal object with a real positive ID.
    """
    # Find the system meal data
    system_meal_data = next((m for m in SYSTEM_MEALS if m["id"] == system_meal_id), None)
    if not system_meal_data:
        raise HTTPException(status_code=404, detail=f"System meal with id {system_meal_id} not found")
    
    # Check if this system meal was already created for this customer
    # We use a special naming convention: system meals have name prefixed with [SYSTEM]
    existing_meal = db.query(Meal).filter(
        Meal.customer_id == customer_id,
        Meal.name == f"[SYSTEM] {system_meal_data['name']}"
    ).first()
    
    if existing_meal:
        return existing_meal
    
    # Create the system meal as a real database entry
    new_meal = Meal(
        customer_id=customer_id,
        name=f"[SYSTEM] {system_meal_data['name']}",
        type=system_meal_data['type'],
        calories=system_meal_data['calories'],
        protein=system_meal_data['protein'],
        carbs=system_meal_data['carbs'],
        fats=system_meal_data['fats'],
        ingredients=system_meal_data['ingredients'],
        image_url=system_meal_data['image_url'],
        is_favorite=system_meal_data['is_favorite'],
        is_custom=False  # Mark as system meal
    )
    
    db.add(new_meal)
    db.commit()
    db.refresh(new_meal)
    return new_meal


def get_meal_by_id(db: Session, meal_id: int, customer_id: int) -> Optional[Meal]:
    """
    Get meal by ID. Handles both regular meals and system meals (negative IDs).
    For system meals, creates them in DB if needed.
    """
    if meal_id > 0:
        # Regular meal - check if it belongs to customer or is a system meal for them
        return db.query(Meal).filter(
            Meal.id == meal_id,
            Meal.customer_id == customer_id
        ).first()
    else:
        # System meal (negative ID) - convert to real meal
        return get_or_create_system_meal(db, meal_id, customer_id)


def check_coach_authorization(db: Session, current_user: User, customer_id: int) -> bool:
    """
    Check if coach is authorized to access customer's data.
    Returns True if:
    - Coach is assigned to this customer
    - Coach has bookings with this customer
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return False
    
    # User is the customer themselves
    if current_user.id == customer.user_id:
        return True
    
    # Check if user is a coach
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        return False
    
    # Coach is directly assigned to this customer
    if customer.assigned_coach_id == coach.id:
        return True
    
    # Coach has bookings with this customer
    booking = db.query(Booking).filter(
        Booking.customer_id == customer_id,
        Booking.coach_id == coach.id
    ).first()
    if booking:
        return True

    # Customer has an active subscription to one of this coach's packages
    pkg_ids = [p.id for p in db.query(CoachPackage).filter(CoachPackage.coach_id == coach.id).all()]
    if pkg_ids:
        pkg_sub = db.query(Subscription).filter(
            Subscription.customer_id == customer_id,
            Subscription.coach_package_id.in_(pkg_ids),
            Subscription.status == "active",
        ).first()
        if pkg_sub:
            return True

    return False


# ==================== MEAL ENDPOINTS ====================

@router.get("/library", response_model=List[MealResponse])
def get_meal_library(
    meal_type: Optional[MealType] = None,
    favorites_only: bool = False,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Get all available meals (system + user custom meals)
    """
    customer = get_customer_or_404(db, current_user.id)
    
    # Get user's meals (both custom and converted system meals)
    query = db.query(Meal).filter(Meal.customer_id == customer.id)
    
    if meal_type and meal_type != MealType.ALL:
        query = query.filter(Meal.type == meal_type)
    if favorites_only:
        query = query.filter(Meal.is_favorite == True)
    
    db_meals = query.all()
    
    # Build response - include system meals that haven't been converted yet
    all_meals = []
    db_meal_names = {m.name for m in db_meals}
    
    # Add system meals (original mock data for ones not yet in DB)
    for sm in SYSTEM_MEALS:
        system_name = f"[SYSTEM] {sm['name']}"
        if system_name not in db_meal_names:
            # Not yet in DB, return mock data
            meal_data = {
                "id": sm["id"],  # Keep negative ID for frontend
                "customer_id": None,
                "name": sm["name"],
                "type": sm["type"],
                "calories": sm["calories"],
                "protein": sm["protein"],
                "carbs": sm["carbs"],
                "fats": sm["fats"],
                "ingredients": sm["ingredients"],
                "image_url": sm["image_url"],
                "is_favorite": sm["is_favorite"],
                "is_custom": sm["is_custom"],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            all_meals.append(MealResponse(**meal_data))
    
    # Add all DB meals (both custom and converted system meals)
    for cm in db_meals:
        # For system meals in DB, return the original negative ID to frontend
        # but keep the real ID for internal use
        display_id = cm.id
        display_name = cm.name
        is_custom = cm.is_custom if cm.is_custom is not None else True
        
        # Check if this is a converted system meal
        if cm.name and cm.name.startswith("[SYSTEM] "):
            # Find original system meal ID
            original_name = cm.name.replace("[SYSTEM] ", "")
            system_meal = next((m for m in SYSTEM_MEALS if m["name"] == original_name), None)
            if system_meal:
                display_id = system_meal["id"]  # Return negative ID to frontend
                display_name = original_name
                is_custom = False
        
        meal_dict = {
            "id": display_id,
            "customer_id": cm.customer_id,
            "name": display_name or "Unknown Meal",
            "type": cm.type or "other",
            "calories": int(cm.calories or 0),
            "protein": int(cm.protein or 0),
            "carbs": int(cm.carbs or 0),
            "fats": int(cm.fats or 0),
            "ingredients": cm.ingredients if cm.ingredients else "[]",
            "image_url": cm.image_url,
            "is_favorite": cm.is_favorite if cm.is_favorite is not None else False,
            "is_custom": is_custom,
            "created_at": cm.created_at if cm.created_at else datetime.utcnow(),
            "updated_at": cm.updated_at if hasattr(cm, 'updated_at') and cm.updated_at else cm.created_at if cm.created_at else datetime.utcnow()
        }
        all_meals.append(MealResponse(**meal_dict))
    
    return all_meals


@router.post("/custom", response_model=MealResponse, status_code=status.HTTP_201_CREATED)
def create_custom_meal(
    meal_data: MealCreate,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Create a custom meal for the current user
    """
    customer = get_customer_or_404(db, current_user.id)
    
    # Handle ingredients - convert list to JSON string if needed
    ingredients = meal_data.ingredients
    if isinstance(ingredients, list):
        import json
        ingredients = json.dumps(ingredients)
    elif ingredients is None:
        ingredients = "[]"
    
    # Handle image_url - ensure it's not empty
    image_url = meal_data.image_url
    if not image_url:
        image_url = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
    
    new_meal = Meal(
        customer_id=customer.id,
        name=meal_data.name,
        type=meal_data.type,
        calories=meal_data.calories,
        protein=meal_data.protein,
        carbs=meal_data.carbs,
        fats=meal_data.fats,
        ingredients=ingredients,
        image_url=image_url,
        is_custom=True,
        is_favorite=False
    )
    
    db.add(new_meal)
    db.commit()
    db.refresh(new_meal)
    
    # Convert to response format
    response_data = {
        "id": new_meal.id,
        "customer_id": new_meal.customer_id,
        "name": new_meal.name,
        "type": new_meal.type,
        "calories": new_meal.calories,
        "protein": new_meal.protein,
        "carbs": new_meal.carbs,
        "fats": new_meal.fats,
        "ingredients": new_meal.ingredients,
        "image_url": new_meal.image_url,
        "is_favorite": new_meal.is_favorite if new_meal.is_favorite is not None else False,
        "is_custom": new_meal.is_custom if new_meal.is_custom is not None else True,
        "created_at": new_meal.created_at if new_meal.created_at else datetime.utcnow(),
        "updated_at": new_meal.updated_at if hasattr(new_meal, 'updated_at') and new_meal.updated_at else new_meal.created_at if new_meal.created_at else datetime.utcnow()
    }
    
    return MealResponse(**response_data)


@router.post("/upload-image")
async def upload_meal_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_customer)
):
    """
    Upload meal image and return URL
    """
    # Validate file
    allowed_types = ['image/jpeg', 'image/png', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Invalid file type")
    
    # Read file size
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(400, "File too large (max 5MB)")
    
    await file.seek(0)
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1].lower()
    unique_name = f"{uuid.uuid4()}{file_ext}"
    
    # Ensure upload directory exists
    upload_dir = os.path.join("uploads", "meals")
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, unique_name)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Return URL (adjust base URL as needed)
    image_url = f"/uploads/meals/{unique_name}"
    
    return {"image_url": image_url}


@router.put("/{meal_id}/favorite")
def toggle_favorite(
    meal_id: int,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Toggle favorite status for a custom meal
    """
    customer = get_customer_or_404(db, current_user.id)
    
    # Handle system meals (negative IDs)
    if meal_id < 0:
        meal = get_or_create_system_meal(db, meal_id, customer.id)
    else:
        meal = db.query(Meal).filter(
            Meal.id == meal_id,
            Meal.customer_id == customer.id
        ).first()
    
    if not meal:
        raise HTTPException(404, "Meal not found")
    
    meal.is_favorite = not meal.is_favorite
    db.commit()
    
    return {"is_favorite": meal.is_favorite}


@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_meal(
    meal_id: int,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Delete a custom meal (only if no logs exist)
    """
    customer = get_customer_or_404(db, current_user.id)
    
    # Cannot delete system meals via this endpoint
    # Cannot delete system meals via this endpoint
    if meal_id < 0:
        raise HTTPException(400, "Cannot delete system meals")
    
    meal = db.query(Meal).filter(
        Meal.id == meal_id,
        Meal.customer_id == customer.id,
        Meal.is_custom == True
    ).first()
    
    if not meal:
        raise HTTPException(404, "Custom meal not found")
    
    # Check if meal has logs
    logs_count = db.query(MealLog).filter(MealLog.meal_id == meal_id).count()
    if logs_count > 0:
        raise HTTPException(400, "Cannot delete meal with existing logs")
    
    db.delete(meal)
    db.commit()
    
    return None


# ==================== MEAL LOGGING ENDPOINTS ====================

@router.post("/log", response_model=MealLogResponse, status_code=status.HTTP_201_CREATED)
def log_meal(
    log_data: MealLogCreate,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Log a meal for the current user
    """
    customer = get_customer_or_404(db, current_user.id)
    
    # Handle system meals (negative IDs) - convert to real meal first
    if log_data.meal_id < 0:
        meal = get_or_create_system_meal(db, log_data.meal_id, customer.id)
        actual_meal_id = meal.id  # Use the real positive ID
    else:
        # Verify regular meal exists and belongs to customer
        meal = db.query(Meal).filter(
            Meal.id == log_data.meal_id,
            Meal.customer_id == customer.id
        ).first()
        if not meal:
            raise HTTPException(404, "Meal not found")
        actual_meal_id = meal.id
    
    # Set current time
    logged_at = datetime.utcnow()
    
    # Create log entry with the actual meal ID (never negative)
    new_log = MealLog(
        customer_id=customer.id,
        meal_id=actual_meal_id,  # Always use positive ID from database
        servings=log_data.servings,
        notes=log_data.notes,
        log_date=date.today(),
        log_time=logged_at.time(),
        logged_at=logged_at
    )
    
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    
    # Attach meal for response
    new_log.meal = meal
    
    return new_log


@router.get("/logs/today", response_model=DailyLogSummary)
def get_today_logs(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Get today's meal logs with nutrition summary
    """
    customer = get_customer_or_404(db, current_user.id)
    today = date.today()

    goal = get_or_create_nutrition_goal(db, customer.id)

    logs = db.query(MealLog).filter(
        MealLog.customer_id == customer.id,
        MealLog.log_date == today
    ).all()

    # Accumulate totals safely (avoid mutating Pydantic model, handle NULL meal values)
    total_calories = 0.0
    total_protein = 0.0
    total_carbs = 0.0
    total_fats = 0.0

    for log in logs:
        meal = db.query(Meal).filter(Meal.id == log.meal_id).first()
        if meal:
            servings = log.servings or 1.0
            total_calories += (meal.calories or 0) * servings
            total_protein += (meal.protein or 0) * servings
            total_carbs += (meal.carbs or 0) * servings
            total_fats += (meal.fats or 0) * servings

    totals = DailyNutrition(
        calories=int(total_calories),
        protein=int(total_protein),
        carbs=int(total_carbs),
        fats=int(total_fats)
    )

    # Goal values with null safety
    goal_calories = int(goal.calories or 2000)
    goal_protein = int(goal.protein or 150)
    goal_carbs = int(goal.carbs or 250)
    goal_fats = int(goal.fats or 70)

    # Calculate percentages
    percentages = {
        "calories": min(round((totals.calories / goal_calories) * 100, 1), 100) if goal_calories > 0 else 0,
        "protein": min(round((totals.protein / goal_protein) * 100, 1), 100) if goal_protein > 0 else 0,
        "carbs": min(round((totals.carbs / goal_carbs) * 100, 1), 100) if goal_carbs > 0 else 0,
        "fats": min(round((totals.fats / goal_fats) * 100, 1), 100) if goal_fats > 0 else 0
    }

    # Include notes from profile or default
    customer_profile = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    notes = customer_profile.goal if customer_profile and customer_profile.goal else "Stay consistent with your nutrition plan!"

    # Convert SQLAlchemy goal to Pydantic model with notes
    goal_pydantic = NutritionGoalBase(
        calories=goal_calories,
        protein=goal_protein,
        carbs=goal_carbs,
        fats=goal_fats,
        notes=notes
    )
    
    return DailyLogSummary(
        date=today,
        totals=totals,
        goal=goal_pydantic,
        meals_logged=len(logs),
        percentage=percentages
    )


@router.get("/logs/history", response_model=List[MealHistoryEntry])
def get_meal_history(
    days: int = 7,
    customer_id: Optional[int] = Query(None, description="Customer ID (for coaches)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get meal history for the last N days.
    Customers get their own history.
    Coaches can specify customer_id to get trainee's history.
    """
    # Determine which customer to get history for
    target_customer_id = customer_id
    
    if target_customer_id is None:
        # Customer getting their own history
        customer = get_customer_or_404(db, current_user.id)
        target_customer_id = customer.id
    else:
        # Coach or admin getting trainee's history - check authorization
        if not check_coach_authorization(db, current_user, target_customer_id):
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this customer's meal history"
            )
    
    since_date = (datetime.utcnow() - timedelta(days=days)).date()

    logs = db.query(MealLog).filter(
        MealLog.customer_id == target_customer_id,
        MealLog.log_date >= since_date
    ).order_by(MealLog.log_date.desc(), MealLog.log_time.desc()).all()
    
    result = []
    for log in logs:
        # Get meal data (should always be in DB now)
        meal = db.query(Meal).filter(Meal.id == log.meal_id).first()
        if not meal:
            continue  # Skip orphaned logs
        
        # Check if this is a system meal (has [SYSTEM] prefix)
        display_id = meal.id
        display_name = meal.name
        is_custom = meal.is_custom if meal.is_custom is not None else True
        
        if meal.name and meal.name.startswith("[SYSTEM] "):
            original_name = meal.name.replace("[SYSTEM] ", "")
            # Find original system meal to get negative ID
            system_meal = next((m for m in SYSTEM_MEALS if m["name"] == original_name), None)
            if system_meal:
                display_id = system_meal["id"]
                display_name = original_name
                is_custom = False
        
        meal_dict = {
            "id": display_id,
            "customer_id": meal.customer_id,
            "name": display_name or "Unknown Meal",
            "type": meal.type or "other",
            "calories": int(meal.calories or 0),
            "protein": int(meal.protein or 0),
            "carbs": int(meal.carbs or 0),
            "fats": int(meal.fats or 0),
            "ingredients": meal.ingredients if meal.ingredients else "[]",
            "image_url": meal.image_url,
            "is_favorite": meal.is_favorite if meal.is_favorite is not None else False,
            "is_custom": is_custom,
            "created_at": meal.created_at if meal.created_at else datetime.utcnow(),
            "updated_at": meal.updated_at if hasattr(meal, 'updated_at') and meal.updated_at else meal.created_at if meal.created_at else datetime.utcnow()
        }
        meal_response = MealResponse(**meal_dict)

        servings = log.servings or 1.0
        # Calculate totals
        total_calories = meal_response.calories * servings
        total_protein = meal_response.protein * servings
        total_carbs = meal_response.carbs * servings
        total_fats = meal_response.fats * servings
        
        # logged_at may be NULL for old records — combine log_date + log_time as fallback
        from datetime import datetime as dt, time as t
        logged_at = log.logged_at
        if logged_at is None and log.log_date:
            log_time = log.log_time if log.log_time else t(0, 0)
            logged_at = dt.combine(log.log_date, log_time)

        result.append(MealHistoryEntry(
            id=log.id,
            meal=meal_response,
            servings=log.servings,
            logged_at=logged_at,
            total_calories=total_calories,
            total_protein=total_protein,
            total_carbs=total_carbs,
            total_fats=total_fats
        ))
    
    return result


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_log(
    log_id: int,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Delete a meal log entry
    """
    customer = get_customer_or_404(db, current_user.id)
    
    log = db.query(MealLog).filter(
        MealLog.id == log_id,
        MealLog.customer_id == customer.id
    ).first()
    
    if not log:
        raise HTTPException(404, "Log entry not found")
    
    db.delete(log)
    db.commit()
    
    return None


# ==================== NUTRITION GOALS ENDPOINTS ====================

@router.get("/goals", response_model=NutritionGoalResponse)
def get_nutrition_goals(
    customer_id: Optional[int] = Query(None, description="Customer ID (for coaches)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get nutrition goals.
    Customers get their own goals.
    Coaches can specify customer_id to get trainee's goals.
    """
    # Determine which customer to get goals for
    target_customer_id = customer_id
    
    if target_customer_id is None:
        # Customer getting their own goals
        customer = get_customer_or_404(db, current_user.id)
        target_customer_id = customer.id
    else:
        # Coach getting trainee's goals - check authorization
        if not check_coach_authorization(db, current_user, target_customer_id):
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this customer's nutrition goals"
            )
    
    goal = get_or_create_nutrition_goal(db, target_customer_id)
    
    # Get customer profile for notes
    customer_profile = db.query(Customer).filter(Customer.id == target_customer_id).first()
    notes = customer_profile.goal if customer_profile and customer_profile.goal else ""
    
    # Convert to response format
    response_data = {
        "id": goal.id,
        "customer_id": goal.customer_id,
        "calories": goal.calories,
        "protein": goal.protein,
        "carbs": goal.carbs,
        "fats": goal.fats,
        "notes": notes,
        "created_at": goal.created_at,
        "updated_at": goal.updated_at if hasattr(goal, 'updated_at') and goal.updated_at else goal.created_at
    }
    
    return NutritionGoalResponse(**response_data)


@router.put("/goals", response_model=NutritionGoalResponse)
def update_nutrition_goals(
    goal_data: NutritionGoalUpdate,
    customer_id: Optional[int] = Query(None, description="Customer ID (for coaches)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update nutrition goals.
    Customers update their own goals.
    Coaches can specify customer_id to update trainee's goals.
    """
    # Determine which customer to update goals for
    target_customer_id = customer_id
    
    if target_customer_id is None:
        # Customer updating their own goals
        customer = get_customer_or_404(db, current_user.id)
        target_customer_id = customer.id
    else:
        # Coach updating trainee's goals - check authorization
        if not check_coach_authorization(db, current_user, target_customer_id):
            raise HTTPException(
                status_code=403,
                detail="Not authorized to update this customer's nutrition goals"
            )
    
    goal = get_or_create_nutrition_goal(db, target_customer_id)
    
    goal.calories = goal_data.calories
    goal.protein = goal_data.protein
    goal.carbs = goal_data.carbs
    goal.fats = goal_data.fats
    
    db.commit()
    db.refresh(goal)
    
    # Convert to response format
    response_data = {
        "id": goal.id,
        "customer_id": goal.customer_id,
        "calories": goal.calories,
        "protein": goal.protein,
        "carbs": goal.carbs,
        "fats": goal.fats,
        "notes": goal.notes if hasattr(goal, 'notes') and goal.notes else "",
        "created_at": goal.created_at,
        "updated_at": goal.updated_at if hasattr(goal, 'updated_at') and goal.updated_at else goal.created_at
    }
    
    return NutritionGoalResponse(**response_data)


# ==================== ENDPOINT ALIASES FOR FRONTEND COMPATIBILITY ====================

@router.get("/nutrition-goals", response_model=NutritionGoalResponse)
def get_nutrition_goals_compatibility(
    customer_id: Optional[int] = Query(None, description="Customer ID (for coaches)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get nutrition goals (alias for /goals endpoint - frontend compatibility).
    """
    # Determine which customer to get goals for
    target_customer_id = customer_id
    
    if target_customer_id is None:
        # Customer getting their own goals
        customer = get_customer_or_404(db, current_user.id)
        target_customer_id = customer.id
    else:
        # Coach getting trainee's goals - check authorization
        if not check_coach_authorization(db, current_user, target_customer_id):
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this customer's nutrition goals"
            )
    
    goal = get_or_create_nutrition_goal(db, target_customer_id)
    
    # Get customer profile for notes
    customer_profile = db.query(Customer).filter(Customer.id == target_customer_id).first()
    notes = customer_profile.goal if customer_profile and customer_profile.goal else ""
    
    # Convert to response format
    response_data = {
        "id": goal.id,
        "customer_id": goal.customer_id,
        "calories": goal.calories,
        "protein": goal.protein,
        "carbs": goal.carbs,
        "fats": goal.fats,
        "notes": notes,
        "created_at": goal.created_at,
        "updated_at": goal.updated_at if hasattr(goal, 'updated_at') and goal.updated_at else goal.created_at
    }
    
    return NutritionGoalResponse(**response_data)


@router.post("/nutrition-goals", response_model=NutritionGoalResponse)
def create_nutrition_goals_compatibility(
    goal_data: NutritionGoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create nutrition goals (frontend compatibility endpoint).
    Coaches can set goals for their trainees.
    """
    # Authorization check
    if not check_coach_authorization(db, current_user, goal_data.customer_id):
        raise HTTPException(
            status_code=403,
            detail="Not authorized to set goals for this customer"
        )
    
    # Check if goal exists
    existing = db.query(NutritionGoal).filter(
        NutritionGoal.customer_id == goal_data.customer_id
    ).first()
    
    if existing:
        # Update existing goal
        existing.calories = goal_data.calories
        existing.protein = goal_data.protein
        existing.carbs = goal_data.carbs
        existing.fats = goal_data.fats
        existing.notes = goal_data.notes
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new goal
        goal = NutritionGoal(
            customer_id=goal_data.customer_id,
            calories=goal_data.calories,
            protein=goal_data.protein,
            carbs=goal_data.carbs,
            fats=goal_data.fats,
            notes=goal_data.notes
        )
        db.add(goal)
        db.commit()
        db.refresh(goal)
        return goal
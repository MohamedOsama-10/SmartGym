# D:\gym_system\Gym_Backend\app\api\v1\training_programs.py
#
# Run this SQL once in your DB to create the table (if it doesn't exist):
#
# IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='training_programs' AND xtype='U')
# BEGIN
#   CREATE TABLE training_programs (
#     id INT IDENTITY(1,1) PRIMARY KEY,
#     coach_id INT NOT NULL REFERENCES coaches(id),
#     name NVARCHAR(200) NOT NULL,
#     description NVARCHAR(MAX),
#     category NVARCHAR(50) DEFAULT 'general-fitness',
#     difficulty NVARCHAR(20) DEFAULT 'intermediate',
#     duration_weeks INT DEFAULT 4,
#     sessions_per_week INT DEFAULT 3,
#     price DECIMAL(10,2) DEFAULT 0,
#     is_active BIT DEFAULT 1,
#     weekly_schedule NVARCHAR(MAX),
#     nutrition_plan NVARCHAR(MAX),
#     created_at DATETIME2 DEFAULT SYSDATETIME(),
#     updated_at DATETIME2 DEFAULT SYSDATETIME()
#   )
# END

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.api.deps import get_current_user, require_customer
from app.models.user import User
from app.models.coach import Coach
from app.models.customer import Customer
from typing import Optional, List
import json
from pydantic import BaseModel

router = APIRouter(prefix="/training-programs", tags=["Training Programs"])

# ============ TABLE MIGRATION ============
# Runs once per server lifetime to add any missing columns to the existing table.

_table_ready = False

def _ensure_table(db: Session):
    """Add missing columns to training_programs if they don't exist yet."""
    global _table_ready
    if _table_ready:
        return

    missing_cols = {
        "is_active":       "ALTER TABLE training_programs ADD is_active BIT NOT NULL DEFAULT 1",
        "weekly_schedule": "ALTER TABLE training_programs ADD weekly_schedule NVARCHAR(MAX)",
        "nutrition_plan":  "ALTER TABLE training_programs ADD nutrition_plan NVARCHAR(MAX)",
        "updated_at":      "ALTER TABLE training_programs ADD updated_at DATETIME2 DEFAULT SYSDATETIME()",
        "category":        "ALTER TABLE training_programs ADD category NVARCHAR(50) DEFAULT 'general-fitness'",
        "difficulty":      "ALTER TABLE training_programs ADD difficulty NVARCHAR(20) DEFAULT 'intermediate'",
        "duration_weeks":  "ALTER TABLE training_programs ADD duration_weeks INT DEFAULT 4",
        "sessions_per_week": "ALTER TABLE training_programs ADD sessions_per_week INT DEFAULT 3",
        "price":           "ALTER TABLE training_programs ADD price DECIMAL(10,2) DEFAULT 0",
        "customer_id":     "ALTER TABLE training_programs ADD customer_id INT NULL",
    }

    for col_name, alter_sql in missing_cols.items():
        result = db.execute(text("""
            SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'training_programs' AND COLUMN_NAME = :col
        """), {"col": col_name})
        if result.fetchone()[0] == 0:
            db.execute(text(alter_sql))
            db.commit()
            print(f"✅ Added column '{col_name}' to training_programs")

    _table_ready = True


# ============ HELPERS ============

def _require_coach(current_user: User = Depends(get_current_user)):
    if current_user.role != "coach":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can access this endpoint",
        )
    return current_user


def _get_coach(db: Session, user_id: int) -> Coach:
    coach = db.query(Coach).filter(Coach.user_id == user_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    return coach


def _row_to_program(row) -> dict:
    workouts = []
    if row.weekly_schedule:
        try:
            workouts = json.loads(row.weekly_schedule)
        except Exception:
            workouts = []

    nutrition = None
    if row.nutrition_plan:
        try:
            nutrition = json.loads(row.nutrition_plan)
        except Exception:
            nutrition = None

    return {
        "id": row.id,
        "name": row.name,
        "description": row.description or "",
        "category": row.category or "general-fitness",
        "difficulty": row.difficulty or "intermediate",
        "duration": f"{row.duration_weeks} weeks",
        "duration_weeks": row.duration_weeks or 4,
        "sessionsPerWeek": row.sessions_per_week or 3,
        "price": float(row.price) if row.price else 0,
        "isActive": bool(row.is_active),
        "createdAt": str(row.created_at)[:10] if row.created_at else None,
        "workouts": workouts,
        "nutritionPlan": nutrition,
        "customerId": getattr(row, "customer_id", None),
    }


# ============ PYDANTIC SCHEMAS ============

class ExerciseItem(BaseModel):
    name: str
    sets: int = 3
    reps: str = "10"
    weight: Optional[str] = None
    rest: Optional[str] = None
    notes: Optional[str] = None
    video_url: Optional[str] = None


class DayWorkout(BaseModel):
    day: str
    focus: str
    duration: str = "45 min"
    exercises: List[ExerciseItem] = []


class WeekSchedule(BaseModel):
    week: int
    days: List[DayWorkout]


class NutritionMeal(BaseModel):
    name: str
    foods: List[str] = []


class NutritionPlan(BaseModel):
    calories: int = 2000
    protein: str = "30%"
    carbs: str = "40%"
    fats: str = "30%"
    meals: List[NutritionMeal] = []


class ProgramCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "general-fitness"
    difficulty: str = "intermediate"
    duration_weeks: int = 4
    sessions_per_week: int = 3
    price: float = 0
    is_active: bool = True
    workouts: List[WeekSchedule] = []
    nutritionPlan: Optional[NutritionPlan] = None
    customer_id: Optional[int] = None


class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    duration_weeks: Optional[int] = None
    sessions_per_week: Optional[int] = None
    price: Optional[float] = None
    is_active: Optional[bool] = None
    workouts: Optional[List[WeekSchedule]] = None
    nutritionPlan: Optional[NutritionPlan] = None


# ============ ENDPOINTS ============

_SELECT = """
    SELECT id, name, description, category, difficulty,
           duration_weeks, sessions_per_week, price, is_active,
           weekly_schedule, nutrition_plan, created_at, customer_id
    FROM training_programs
"""


@router.get("/my-program")
def get_my_program(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db),
):
    """Get the training program assigned to the currently logged-in customer."""
    _ensure_table(db)
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    result = db.execute(text(_SELECT + """
        WHERE customer_id = :customer_id
        ORDER BY created_at DESC
    """), {"customer_id": customer.id})
    rows = result.fetchall()
    return [_row_to_program(r) for r in rows]


@router.get("/trainee/{customer_id}")
def get_trainee_program(
    customer_id: int,
    current_user: User = Depends(_require_coach),
    db: Session = Depends(get_db),
):
    """Get the training program assigned to a specific trainee by the current coach."""
    _ensure_table(db)
    coach = _get_coach(db, current_user.id)
    result = db.execute(text(_SELECT + """
        WHERE coach_id = :coach_id AND customer_id = :customer_id
        ORDER BY created_at DESC
    """), {"coach_id": coach.id, "customer_id": customer_id})
    rows = result.fetchall()
    return [_row_to_program(r) for r in rows]


@router.get("/")
def list_programs(
    current_user: User = Depends(_require_coach),
    db: Session = Depends(get_db),
):
    """List all training programs created by the current coach."""
    _ensure_table(db)
    coach = _get_coach(db, current_user.id)
    result = db.execute(text(_SELECT + """
        WHERE coach_id = :coach_id
        ORDER BY created_at DESC
    """), {"coach_id": coach.id})
    rows = result.fetchall()
    return [_row_to_program(r) for r in rows]


@router.get("/{program_id}")
def get_program(
    program_id: int,
    current_user: User = Depends(_require_coach),
    db: Session = Depends(get_db),
):
    """Get a single training program by ID."""
    _ensure_table(db)
    coach = _get_coach(db, current_user.id)
    result = db.execute(text(_SELECT + """
        WHERE id = :id AND coach_id = :coach_id
    """), {"id": program_id, "coach_id": coach.id})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Program not found")
    return _row_to_program(row)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_program(
    program: ProgramCreate,
    current_user: User = Depends(_require_coach),
    db: Session = Depends(get_db),
):
    """Create a new training program."""
    coach = _get_coach(db, current_user.id)

    workouts_json = json.dumps([w.model_dump() for w in program.workouts])
    nutrition_json = (
        json.dumps(program.nutritionPlan.model_dump())
        if program.nutritionPlan
        else None
    )

    result = db.execute(text("""
        INSERT INTO training_programs
        (coach_id, name, description, category, difficulty, duration_weeks,
         sessions_per_week, price, is_active, weekly_schedule, nutrition_plan,
         customer_id, created_at, updated_at)
        OUTPUT INSERTED.id
        VALUES
        (:coach_id, :name, :description, :category, :difficulty, :duration_weeks,
         :sessions_per_week, :price, :is_active, :weekly_schedule, :nutrition_plan,
         :customer_id, GETDATE(), GETDATE())
    """), {
        "coach_id": coach.id,
        "name": program.name,
        "description": program.description,
        "category": program.category,
        "difficulty": program.difficulty,
        "duration_weeks": program.duration_weeks,
        "sessions_per_week": program.sessions_per_week,
        "price": program.price,
        "is_active": 1 if program.is_active else 0,
        "weekly_schedule": workouts_json,
        "nutrition_plan": nutrition_json,
        "customer_id": program.customer_id,
    })
    new_id = result.fetchone()[0]
    db.commit()

    # Return the newly created program
    fetch = db.execute(text(_SELECT + "WHERE id = :id"), {"id": new_id})
    return _row_to_program(fetch.fetchone())


@router.put("/{program_id}")
def update_program(
    program_id: int,
    program: ProgramUpdate,
    current_user: User = Depends(_require_coach),
    db: Session = Depends(get_db),
):
    """Update an existing training program."""
    coach = _get_coach(db, current_user.id)

    updates = ["updated_at = GETDATE()"]
    params: dict = {"id": program_id, "coach_id": coach.id}

    if program.name is not None:
        updates.append("name = :name")
        params["name"] = program.name
    if program.description is not None:
        updates.append("description = :description")
        params["description"] = program.description
    if program.category is not None:
        updates.append("category = :category")
        params["category"] = program.category
    if program.difficulty is not None:
        updates.append("difficulty = :difficulty")
        params["difficulty"] = program.difficulty
    if program.duration_weeks is not None:
        updates.append("duration_weeks = :duration_weeks")
        params["duration_weeks"] = program.duration_weeks
    if program.sessions_per_week is not None:
        updates.append("sessions_per_week = :sessions_per_week")
        params["sessions_per_week"] = program.sessions_per_week
    if program.price is not None:
        updates.append("price = :price")
        params["price"] = program.price
    if program.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = 1 if program.is_active else 0
    if program.workouts is not None:
        updates.append("weekly_schedule = :weekly_schedule")
        params["weekly_schedule"] = json.dumps([w.model_dump() for w in program.workouts])
    if program.nutritionPlan is not None:
        updates.append("nutrition_plan = :nutrition_plan")
        params["nutrition_plan"] = json.dumps(program.nutritionPlan.model_dump())

    db.execute(text(f"""
        UPDATE training_programs
        SET {', '.join(updates)}
        WHERE id = :id AND coach_id = :coach_id
    """), params)
    db.commit()

    result = db.execute(text(_SELECT + "WHERE id = :id AND coach_id = :coach_id"),
                        {"id": program_id, "coach_id": coach.id})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Program not found")
    return _row_to_program(row)


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_program(
    program_id: int,
    current_user: User = Depends(_require_coach),
    db: Session = Depends(get_db),
):
    """Delete a training program."""
    coach = _get_coach(db, current_user.id)
    db.execute(text("""
        DELETE FROM training_programs
        WHERE id = :id AND coach_id = :coach_id
    """), {"id": program_id, "coach_id": coach.id})
    db.commit()

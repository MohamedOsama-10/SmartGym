# D:\gym_system\Gym_Backend\app\api\v1\workouts.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.customer import Customer
from app.models.coach import Coach
from app.models.booking import Booking
from app.api.v1.notifications import create_notification
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel

router = APIRouter(prefix="/workouts", tags=["Workouts"])

# ============ PYDANTIC SCHEMAS ============

class ExerciseDetail(BaseModel):
    name: str
    sets: int
    reps: str
    weight: str
    rest: str
    videoUrl: Optional[str] = None
    videoTitle: Optional[str] = None

class WorkoutResponse(BaseModel):
    id: int
    name: str
    type: str
    category: Optional[str]
    difficulty: str
    duration: int
    calories: int
    exercises: List[dict]
    notes: Optional[str]
    assignedBy: Optional[str]
    assignedDate: Optional[datetime]
    targetDate: Optional[str]
    completed: bool = False

    class Config:
        from_attributes = True

class CompletionUpdate(BaseModel):
    completed: bool
    completedAt: Optional[datetime] = None

class WorkoutAssignment(BaseModel):
    customerId: int
    workoutTemplateId: int
    dueDate: Optional[date] = None
    notes: Optional[str] = None

class ExerciseInput(BaseModel):
    name: str
    sets: int = 3
    reps: str = "10"
    weight: str = "bodyweight"
    rest: str = "60s"
    video_url: Optional[str] = None

class CustomWorkoutAssignment(BaseModel):
    customer_id: int
    name: str
    category: str = "fullbody"
    type: Optional[str] = None
    difficulty: str = "intermediate"
    notes: Optional[str] = None
    target_date: Optional[date] = None
    duration: Optional[int] = None
    calories: Optional[int] = None
    exercises: List[ExerciseInput] = []


# ============ HELPER FUNCTIONS ============

def require_customer(current_user: User = Depends(get_current_user)):
    """Ensure user is a customer"""
    if current_user.role != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only for customers"
        )
    return current_user

def require_coach(current_user: User = Depends(get_current_user)):
    """Ensure user is a coach"""
    if current_user.role != "coach":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only for coaches"
        )
    return current_user


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
    
    return booking is not None


# ============ USER/CUSTOMER ENDPOINTS ============

@router.get("/my-workouts")
async def get_my_workouts(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db),
    filter_type: Optional[str] = Query(None, alias="filter_type"),
    completed: Optional[bool] = Query(None)
):
    """Get all workouts assigned to current customer"""
    try:
        customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer profile not found"
            )

        print(f"🔍 Fetching workouts for customer_id: {customer.id}, filter: {filter_type}, completed: {completed}")

        query = text("""
            SELECT
                aw.id,
                aw.status,
                aw.assigned_date,
                aw.due_date,
                aw.notes as coach_notes,
                aw.completed_at,
                wt.id as template_id,
                wt.name,
                wt.type,
                wt.difficulty,
                wt.duration_minutes,
                wt.estimated_calories,
                wt.description,
                coach_user.full_name as coach_name
            FROM assigned_workouts aw
            INNER JOIN workout_templates wt ON aw.workout_template_id = wt.id
            INNER JOIN coaches c ON aw.coach_id = c.id
            INNER JOIN users coach_user ON c.user_id = coach_user.id
            WHERE aw.customer_id = :customer_id
            ORDER BY aw.assigned_date DESC
        """)

        result = db.execute(query, {"customer_id": customer.id})
        assigned_workouts = result.fetchall()

        print(f"✅ Found {len(assigned_workouts)} assigned workouts")

        workouts = []
        for aw in assigned_workouts:
            exercises_query = text("""
                SELECT
                    we.exercise_name as name,
                    we.sets,
                    we.reps,
                    we.weight,
                    ISNULL(we.rest_seconds, 60) as rest_seconds,
                    we.video_url,
                    we.video_title,
                    we.order_index,
                    e.name as exercise_library_name,
                    e.video_url as lib_video_url
                FROM workout_exercises we
                LEFT JOIN exercises e ON we.exercise_id = e.id
                WHERE we.workout_template_id = :template_id
                ORDER BY we.order_index
            """)

            exercises_result = db.execute(exercises_query, {"template_id": aw.template_id})
            exercises = []

            for ex in exercises_result:
                rest_seconds = ex.rest_seconds or 60
                if rest_seconds >= 60:
                    rest = f"{rest_seconds // 60}m {rest_seconds % 60}s" if rest_seconds % 60 else f"{rest_seconds // 60}m"
                else:
                    rest = f"{rest_seconds}s"

                video_url = ex.video_url or ex.lib_video_url
                video_title = ex.video_title or ex.exercise_library_name or ex.name

                exercises.append({
                    "name": ex.name,
                    "sets": ex.sets or 3,
                    "reps": ex.reps or "10",
                    "weight": ex.weight or "bodyweight",
                    "rest": rest,
                    "videoUrl": video_url,
                    "videoTitle": video_title
                })

            workout_type = "strength"
            if aw.type:
                type_lower = aw.type.lower()
                if any(x in type_lower for x in ["cardio", "hiit", "endurance"]):
                    workout_type = "cardio"
                elif any(x in type_lower for x in ["yoga", "flex", "stretch", "mobility"]):
                    workout_type = "flexibility"

            is_completed = (aw.status and aw.status.lower() == "completed") or aw.completed_at is not None

            if filter_type and filter_type != "all" and workout_type != filter_type:
                continue
            if completed is not None and is_completed != completed:
                continue

            workouts.append({
                "id": aw.id,
                "name": aw.name,
                "type": workout_type,
                "category": aw.type,
                "difficulty": aw.difficulty or "intermediate",
                "duration": aw.duration_minutes or 30,
                "calories": aw.estimated_calories or 200,
                "exercises": exercises,
                "notes": aw.coach_notes or "",
                "assignedBy": aw.coach_name,
                "assignedDate": aw.assigned_date.isoformat() if aw.assigned_date else None,
                "targetDate": aw.due_date.isoformat() if aw.due_date else None,
                "completed": is_completed
            })

        print(f"✅ Returning {len(workouts)} workouts")
        return workouts

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching workouts: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching workouts: {str(e)}"
        )


@router.get("/my-workouts/history")
async def get_workout_history(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db),
    days: int = Query(7, ge=1, le=365)
):
    """Get workout history including both completed and pending workouts"""
    try:
        customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer profile not found"
            )

        # Query assigned_workouts for the last X days
        history_query = text("""
            SELECT
                aw.id,
                wt.name as workout_name,
                wt.type as workout_type,
                aw.assigned_date,
                aw.due_date,
                aw.completed_at,
                aw.status,
                wt.duration_minutes,
                wt.estimated_calories,
                aw.notes
            FROM assigned_workouts aw
            INNER JOIN workout_templates wt ON aw.workout_template_id = wt.id
            WHERE aw.customer_id = :customer_id
              AND (
                aw.assigned_date >= DATEADD(DAY, -:days, GETDATE())
                OR (aw.completed_at IS NOT NULL AND aw.completed_at >= DATEADD(DAY, -:days, GETDATE()))
              )
            ORDER BY aw.assigned_date DESC
        """)

        result = db.execute(history_query, {
            "customer_id": customer.id,
            "days": days
        })

        now = datetime.utcnow()
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

        history = []
        total_completed = 0
        total_calories = 0
        total_duration = 0

        for session in result:
            is_completed = (session.status and session.status.lower() == "completed") or session.completed_at is not None
            completed_at = session.completed_at or (session.assigned_date if is_completed else None)

            history.append({
                "id": session.id,
                "workoutName": session.workout_name,
                "workoutType": session.workout_type or "strength",
                "completedAt": completed_at.isoformat() if completed_at else None,
                "duration": session.duration_minutes or 0,
                "calories": session.estimated_calories or 0,
                "notes": session.notes,
                "status": session.status or "pending",
                "completed": is_completed
            })

            if is_completed:
                total_completed += 1
                total_calories += session.estimated_calories or 0
                total_duration += session.duration_minutes or 0

        return {
            "history": history,
            "stats": {
                "totalCompleted": total_completed,
                "totalCalories": total_calories,
                "totalDuration": total_duration,
                "thisWeek": len([h for h in history if h['completed'] and h.get('completedAt') and
                    datetime.fromisoformat(h['completedAt'][:19]) >= week_start])
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching history: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching history: {str(e)}"
        )


@router.post("/my-workouts/{workout_id}/complete")
async def mark_workout_complete(
    workout_id: int,
    completion: CompletionUpdate,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """Mark a workout as completed"""
    try:
        customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer profile not found"
            )

        verify_query = text("""
            SELECT id, status, workout_template_id
            FROM assigned_workouts
            WHERE id = :workout_id AND customer_id = :customer_id
        """)

        result = db.execute(verify_query, {
            "workout_id": workout_id,
            "customer_id": customer.id
        })

        workout_row = result.fetchone()
        if not workout_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout not found"
            )

        if completion.completed:
            update_query = text("""
                UPDATE assigned_workouts
                SET status = 'completed',
                    completed_at = GETDATE(),
                    updated_at = GETDATE()
                WHERE id = :workout_id
            """)
        else:
            update_query = text("""
                UPDATE assigned_workouts
                SET status = 'pending',
                    completed_at = NULL,
                    updated_at = GETDATE()
                WHERE id = :workout_id
            """)

        db.execute(update_query, {"workout_id": workout_id})

        # Create training_session record for history
        if completion.completed:
            check_session = text("""
                SELECT id FROM training_sessions
                WHERE assigned_workout_id = :workout_id AND customer_id = :customer_id
            """)
            existing = db.execute(check_session, {
                "workout_id": workout_id,
                "customer_id": customer.id
            }).fetchone()

            if not existing:
                wt_query = text("""
                    SELECT wt.name, wt.type, wt.duration_minutes, wt.estimated_calories
                    FROM workout_templates wt
                    INNER JOIN assigned_workouts aw ON wt.id = aw.workout_template_id
                    WHERE aw.id = :workout_id
                """)
                wt_info = db.execute(wt_query, {"workout_id": workout_id}).fetchone()

                insert_session = text("""
                    INSERT INTO training_sessions
                    (customer_id, assigned_workout_id, workout_name, workout_type,
                     status, start_time, end_time, duration_minutes, total_calories, created_at)
                    VALUES
                    (:customer_id, :workout_id, :workout_name, :workout_type,
                     'finished', DATEADD(MINUTE, -:duration, GETDATE()), GETDATE(),
                     :duration, :calories, GETDATE())
                """)
                db.execute(insert_session, {
                    "customer_id": customer.id,
                    "workout_id": workout_id,
                    "workout_name": wt_info.name if wt_info else "Workout",
                    "workout_type": wt_info.type if wt_info else "strength",
                    "duration": wt_info.duration_minutes if wt_info else 30,
                    "calories": wt_info.estimated_calories if wt_info else 200
                })

        db.commit()

        return {
            "message": "Workout status updated",
            "workoutId": workout_id,
            "completed": completion.completed,
            "completedAt": datetime.utcnow().isoformat() if completion.completed else None
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error updating workout: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating workout: {str(e)}"
        )


# ============ COACH ENDPOINTS ============

@router.get("/assigned")
async def get_assigned_workouts(
    customer_id: int = Query(..., description="Customer ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all workouts assigned to a specific customer.
    Coaches can view workouts they've assigned to their trainees.
    """
    try:
        # Check authorization
        if not check_coach_authorization(db, current_user, customer_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this customer's workouts"
            )

        # Verify customer exists
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        print(f"🔍 Coach fetching workouts for customer_id: {customer_id}")

        query = text("""
            SELECT
                aw.id,
                aw.status,
                aw.assigned_date,
                aw.due_date,
                aw.notes as coach_notes,
                aw.completed_at,
                aw.created_at,
                wt.id as template_id,
                wt.name,
                wt.type,
                wt.difficulty,
                wt.duration_minutes,
                wt.estimated_calories,
                wt.description,
                coach_user.full_name as coach_name
            FROM assigned_workouts aw
            INNER JOIN workout_templates wt ON aw.workout_template_id = wt.id
            INNER JOIN coaches c ON aw.coach_id = c.id
            INNER JOIN users coach_user ON c.user_id = coach_user.id
            WHERE aw.customer_id = :customer_id
            ORDER BY aw.assigned_date DESC
        """)

        result = db.execute(query, {"customer_id": customer_id})
        assigned_workouts = result.fetchall()

        print(f"✅ Found {len(assigned_workouts)} assigned workouts for customer {customer_id}")

        workouts = []
        for aw in assigned_workouts:
            exercises_query = text("""
                SELECT
                    we.exercise_name as name,
                    we.sets,
                    we.reps,
                    we.weight,
                    ISNULL(we.rest_seconds, 60) as rest_seconds,
                    we.video_url,
                    we.video_title,
                    we.order_index,
                    e.name as exercise_library_name,
                    e.video_url as lib_video_url
                FROM workout_exercises we
                LEFT JOIN exercises e ON we.exercise_id = e.id
                WHERE we.workout_template_id = :template_id
                ORDER BY we.order_index
            """)

            exercises_result = db.execute(exercises_query, {"template_id": aw.template_id})
            exercises = []

            for ex in exercises_result:
                rest_seconds = ex.rest_seconds or 60
                if rest_seconds >= 60:
                    rest = f"{rest_seconds // 60}m {rest_seconds % 60}s" if rest_seconds % 60 else f"{rest_seconds // 60}m"
                else:
                    rest = f"{rest_seconds}s"

                video_url = ex.video_url or ex.lib_video_url
                video_title = ex.video_title or ex.exercise_library_name or ex.name

                exercises.append({
                    "name": ex.name,
                    "sets": ex.sets or 3,
                    "reps": ex.reps or "10",
                    "weight": ex.weight or "bodyweight",
                    "rest": rest,
                    "videoUrl": video_url,
                    "videoTitle": video_title
                })

            workout_type = "strength"
            if aw.type:
                type_lower = aw.type.lower()
                if any(x in type_lower for x in ["cardio", "hiit", "endurance"]):
                    workout_type = "cardio"
                elif any(x in type_lower for x in ["yoga", "flex", "stretch", "mobility"]):
                    workout_type = "flexibility"

            is_completed = (aw.status and aw.status.lower() == "completed") or aw.completed_at is not None

            workouts.append({
                "id": aw.id,
                "name": aw.name,
                "type": workout_type,
                "category": aw.type,
                "difficulty": aw.difficulty or "intermediate",
                "duration": aw.duration_minutes or 30,
                "calories": aw.estimated_calories or 200,
                "exercises": exercises,
                "notes": aw.coach_notes or "",
                "assignedBy": aw.coach_name,
                "assignedDate": aw.assigned_date.isoformat() if aw.assigned_date else None,
                "targetDate": aw.due_date.isoformat() if aw.due_date else None,
                "completed": is_completed,
                "completedAt": aw.completed_at.isoformat() if aw.completed_at else None
            })

        return workouts

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching assigned workouts: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching workouts: {str(e)}"
        )


@router.post("/assign", status_code=status.HTTP_201_CREATED)
async def assign_workout_to_customer(
    assignment: WorkoutAssignment,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Coach assigns a workout to a customer"""
    try:
        coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
        if not coach:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach profile not found"
        )

        customer = db.query(Customer).filter(Customer.id == assignment.customerId).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        template_check = text("SELECT id FROM workout_templates WHERE id = :template_id")
        if not db.execute(template_check, {"template_id": assignment.workoutTemplateId}).fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout template not found"
            )

        assign_query = text("""
            INSERT INTO assigned_workouts
            (customer_id, coach_id, workout_template_id, due_date, notes, status, assigned_date, created_at, updated_at)
            OUTPUT INSERTED.id
            VALUES
            (:customer_id, :coach_id, :workout_template_id, :due_date, :notes, 'pending', GETDATE(), GETDATE(), GETDATE())
        """)

        result = db.execute(assign_query, {
            "customer_id": assignment.customerId,
            "coach_id": coach.id,
            "workout_template_id": assignment.workoutTemplateId,
            "due_date": assignment.dueDate,
            "notes": assignment.notes
        })

        assigned_id = result.fetchone()[0]

        update_template = text("""
            UPDATE workout_templates
            SET total_uses = ISNULL(total_uses, 0) + 1,
                updated_at = GETDATE()
            WHERE id = :template_id
        """)
        db.execute(update_template, {"template_id": assignment.workoutTemplateId})

        # Notify the customer
        create_notification(
            db, customer.user_id,
            title="New Workout Assigned",
            message=f"Coach {current_user.full_name} assigned you a new workout. Check your workouts page.",
            type="workout",
            link="/workouts",
        )

        db.commit()

        return {
            "message": "Workout assigned successfully",
            "assignedWorkoutId": assigned_id,
            "customerId": assignment.customerId,
            "assignedBy": current_user.full_name,
            "assignedDate": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error assigning workout: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error assigning workout: {str(e)}"
        )


def parse_rest_seconds(rest_str: str) -> int:
    """Convert rest string like '90s', '1m', '1m 30s' to seconds"""
    import re
    if not rest_str:
        return 60
    rest_str = rest_str.strip().lower()
    total = 0
    mins = re.search(r'(\d+)\s*m', rest_str)
    secs = re.search(r'(\d+)\s*s', rest_str)
    if mins:
        total += int(mins.group(1)) * 60
    if secs:
        total += int(secs.group(1))
    return total if total > 0 else 60


@router.post("/assign-custom", status_code=status.HTTP_201_CREATED)
async def assign_custom_workout(
    assignment: CustomWorkoutAssignment,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """
    Coach creates a brand-new custom workout (template + exercises) and
    assigns it to a customer in one shot.
    """
    try:
        coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
        if not coach:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach profile not found")

        customer = db.query(Customer).filter(Customer.id == assignment.customer_id).first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

        # 1. Create workout template
        workout_type = assignment.type or assignment.category
        create_template = text("""
            INSERT INTO workout_templates
            (name, type, difficulty, duration_minutes, estimated_calories, description, is_public, total_uses, coach_id, created_at, updated_at)
            OUTPUT INSERTED.id
            VALUES
            (:name, :type, :difficulty, :duration, :calories, :description, 0, 0, :coach_id, GETDATE(), GETDATE())
        """)
        template_result = db.execute(create_template, {
            "name": assignment.name,
            "type": workout_type,
            "difficulty": assignment.difficulty,
            "duration": assignment.duration or 30,
            "calories": assignment.calories or 200,
            "description": assignment.notes or "",
            "coach_id": coach.id,
        })
        template_id = template_result.fetchone()[0]

        # 2. Insert exercises
        for idx, ex in enumerate(assignment.exercises):
            rest_seconds = parse_rest_seconds(ex.rest)
            insert_ex = text("""
                INSERT INTO workout_exercises
                (workout_template_id, exercise_name, sets, reps, weight, rest_seconds, video_url, order_index, created_at)
                VALUES
                (:template_id, :exercise_name, :sets, :reps, :weight, :rest_seconds, :video_url, :order_index, GETDATE())
            """)
            db.execute(insert_ex, {
                "template_id": template_id,
                "exercise_name": ex.name,
                "sets": ex.sets,
                "reps": str(ex.reps),
                "weight": ex.weight,
                "rest_seconds": rest_seconds,
                "video_url": ex.video_url or None,
                "order_index": idx,
            })

        # 3. Assign to customer
        assign_query = text("""
            INSERT INTO assigned_workouts
            (customer_id, coach_id, workout_template_id, due_date, notes, status, assigned_date, created_at, updated_at)
            OUTPUT INSERTED.id
            VALUES
            (:customer_id, :coach_id, :workout_template_id, :due_date, :notes, 'pending', GETDATE(), GETDATE(), GETDATE())
        """)
        assign_result = db.execute(assign_query, {
            "customer_id": assignment.customer_id,
            "coach_id": coach.id,
            "workout_template_id": template_id,
            "due_date": assignment.target_date,
            "notes": assignment.notes,
        })
        assigned_id = assign_result.fetchone()[0]

        # Notify the customer
        create_notification(
            db, customer.user_id,
            title="New Workout Assigned",
            message=f"Coach {current_user.full_name} assigned you a custom workout: '{assignment.name}'.",
            type="workout",
            link="/workouts",
        )

        db.commit()

        print(f"✅ Custom workout '{assignment.name}' assigned to customer {assignment.customer_id}, template_id={template_id}, assigned_id={assigned_id}")

        return {
            "message": "Workout assigned successfully",
            "assignedWorkoutId": assigned_id,
            "workoutTemplateId": template_id,
            "customerId": assignment.customer_id,
            "assignedBy": current_user.full_name,
            "assignedDate": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error assigning custom workout: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error assigning workout: {str(e)}"
        )


@router.delete("/assigned/{assigned_workout_id}")
async def remove_assigned_workout(
    assigned_workout_id: int,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """
    Remove an assigned workout from a customer.
    Coaches can remove workouts they assigned.
    """
    try:
        coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
        if not coach:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Coach profile not found"
            )

        # Get the assigned workout
        query = text("""
            SELECT aw.id, aw.coach_id, aw.customer_id
            FROM assigned_workouts aw
            WHERE aw.id = :workout_id
        """)

        result = db.execute(query, {"workout_id": assigned_workout_id})
        workout_row = result.fetchone()

        if not workout_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned workout not found"
            )

        # Check if coach is the one who assigned this workout
        if workout_row.coach_id != coach.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only remove workouts you assigned"
            )

        # Delete the assigned workout
        delete_query = text("DELETE FROM assigned_workouts WHERE id = :workout_id")
        db.execute(delete_query, {"workout_id": assigned_workout_id})
        db.commit()

        return {"message": "Workout removed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error removing workout: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing workout: {str(e)}"
        )


@router.get("/coach/customers/{customer_id}/workouts")
async def get_customer_workouts(
    customer_id: int,
    current_user: User = Depends(require_coach),
    db: Session = Depends(get_db)
):
    """Coach views workouts for a specific customer"""
    try:
        coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
        if not coach:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Coach profile not found"
            )

        workouts_query = text("""
            SELECT
                aw.id,
                aw.status,
                aw.assigned_date,
                aw.due_date,
                aw.completed_at,
                aw.notes,
                wt.name,
                wt.type,
                wt.difficulty,
                wt.duration_minutes,
                wt.estimated_calories
            FROM assigned_workouts aw
            INNER JOIN workout_templates wt ON aw.workout_template_id = wt.id
            WHERE aw.customer_id = :customer_id
              AND aw.coach_id = :coach_id
            ORDER BY aw.assigned_date DESC
        """)

        result = db.execute(workouts_query, {
            "customer_id": customer_id,
            "coach_id": coach.id
        })

        workouts = []
        total = 0
        completed = 0

        for w in result:
            is_completed = (w.status and w.status.lower() == "completed") or w.completed_at is not None
            if is_completed:
                completed += 1
            total += 1

            workouts.append({
                "id": w.id,
                "name": w.name,
                "type": w.type,
                "difficulty": w.difficulty,
                "duration": w.duration_minutes,
                "calories": w.estimated_calories,
                "status": w.status,
                "notes": w.notes,
                "assignedDate": w.assigned_date.isoformat() if w.assigned_date else None,
                "dueDate": w.due_date.isoformat() if w.due_date else None,
                "completedAt": w.completed_at.isoformat() if w.completed_at else None,
                "completed": is_completed
            })

        return {
            "customerId": customer_id,
            "workouts": workouts,
            "stats": {
                "total": total,
                "completed": completed,
                "pending": total - completed
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching customer workouts: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching workouts: {str(e)}"
        )


# ============ EXERCISE LIBRARY ============

@router.get("/exercises/library")
async def get_exercise_library(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    category: Optional[str] = None,
    search: Optional[str] = None,
    difficulty: Optional[str] = None
):
    """Get public exercise library"""
    try:
        query_str = """
            SELECT
                id,
                name,
                muscle_group,
                category,
                video_url,
                video_title,
                description,
                difficulty,
                equipment_needed,
                calories_per_minute
            FROM exercises
            WHERE is_public = 1
        """

        params = {}

        if category:
            query_str += " AND category = :category"
            params["category"] = category

        if difficulty:
            query_str += " AND difficulty = :difficulty"
            params["difficulty"] = difficulty

        if search:
            query_str += " AND (name LIKE :search OR description LIKE :search)"
            params["search"] = f"%{search}%"

        query_str += " ORDER BY name"

        result = db.execute(text(query_str), params)

        exercises = []
        for ex in result:
            exercises.append({
                "id": ex.id,
                "name": ex.name,
                "muscleGroup": ex.muscle_group,
                "category": ex.category,
                "videoUrl": ex.video_url,
                "videoTitle": ex.video_title,
                "description": ex.description,
                "difficulty": ex.difficulty,
                "equipmentNeeded": ex.equipment_needed,
                "caloriesPerMinute": ex.calories_per_minute
            })

        return {
            "exercises": exercises,
            "total": len(exercises)
        }

    except Exception as e:
        print(f"❌ Error fetching exercises: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching exercises: {str(e)}"
        )


# ============ UTILITY ENDPOINTS ============

@router.get("/templates")
async def get_workout_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    is_public: Optional[bool] = True
):
    """Get available workout templates"""
    try:
        query = text("""
            SELECT
                id,
                name,
                type,
                difficulty,
                duration_minutes,
                estimated_calories,
                description,
                is_public,
                total_uses,
                coach_id
            FROM workout_templates
            WHERE (:is_public IS NULL OR is_public = :is_public OR coach_id = :coach_id)
            ORDER BY total_uses DESC, name ASC
        """)

        coach_id = None
        if hasattr(current_user, 'coach') and current_user.coach:
            coach_id = current_user.coach.id

        result = db.execute(query, {
            "is_public": is_public,
            "coach_id": coach_id
        })

        templates = []
        for t in result:
            templates.append({
                "id": t.id,
                "name": t.name,
                "type": t.type,
                "difficulty": t.difficulty,
                "duration": t.duration_minutes,
                "calories": t.estimated_calories,
                "description": t.description,
                "isPublic": t.is_public,
                "totalUses": t.total_uses
            })

        return {"templates": templates}

    except Exception as e:
        print(f"❌ Error fetching templates: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching templates: {str(e)}"
        )
# app/schemas/meal.py
from pydantic import BaseModel, Field
from typing import Optional, List, Union
from datetime import datetime, date
from enum import Enum


class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACK = "snack"
    ALL = "all"


class NutritionGoalBase(BaseModel):
    calories: int = 0
    protein: int = 0
    carbs: int = 0
    fats: int = 0
    notes: str = ""


class NutritionGoalCreate(NutritionGoalBase):
    customer_id: int


class NutritionGoalUpdate(BaseModel):
    calories: int
    protein: int
    carbs: int
    fats: int


class NutritionGoalResponse(NutritionGoalBase):
    id: int
    customer_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MealLogCreate(BaseModel):
    meal_id: int
    servings: float = 1
    notes: Optional[str] = ""


class MealLogResponse(BaseModel):
    id: int
    customer_id: int
    meal_id: int
    servings: float
    logged_at: Optional[datetime] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class MealBase(BaseModel):
    name: str
    type: str = "other"
    calories: int = 0
    protein: int = 0
    carbs: int = 0
    fats: int = 0
    image_url: Optional[str] = None
    description: Optional[str] = None


class MealCreate(MealBase):
    ingredients: Optional[Union[str, List[str]]] = None


class MealUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    calories: Optional[int] = None
    protein: Optional[int] = None
    carbs: Optional[int] = None
    fats: Optional[int] = None
    image_url: Optional[str] = None
    ingredients: Optional[str] = None
    is_favorite: Optional[bool] = None


class MealResponse(BaseModel):
    id: int
    customer_id: Optional[int] = None
    name: str
    type: str
    calories: int
    protein: int
    carbs: int
    fats: int
    ingredients: Optional[str] = None
    image_url: Optional[str] = None
    is_favorite: bool = False
    is_custom: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DailyNutrition(BaseModel):
    calories: int = 0
    protein: int = 0
    carbs: int = 0
    fats: int = 0


class DailyLogSummary(BaseModel):
    date: date
    totals: DailyNutrition
    goal: NutritionGoalBase
    meals_logged: int
    percentage: dict


class MealHistoryEntry(BaseModel):
    id: int
    meal: MealResponse
    servings: float
    logged_at: Optional[datetime] = None
    total_calories: int
    total_protein: int
    total_carbs: int
    total_fats: int
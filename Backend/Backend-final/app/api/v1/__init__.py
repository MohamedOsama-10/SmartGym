# app/api/v1/__init__.py
from fastapi import APIRouter

from app.api.v1 import auth
from app.api.v1 import bookings
from app.api.v1 import gyms
from app.api.v1 import profile
from app.api.v1 import subscriptions
from app.api.v1 import availability
from app.api.v1 import admin_owner
from app.api.v1 import workouts  # ADD THIS IMPORT
from app.api.v1 import users     # ADD THIS IF IT EXISTS
from app.api.v1 import meals  # Add this import
from app.api.v1 import memberships  # Add this
from app.api.v1 import training_programs

api_router = APIRouter()

# Include all routers with their prefixes
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
api_router.include_router(gyms.router, prefix="/gyms", tags=["Gyms"])
api_router.include_router(profile.router, prefix="/users/me", tags=["Profile"])
api_router.include_router(availability.router, prefix="/availability", tags=["Availability"])
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["Subscriptions"])
api_router.include_router(admin_owner.router, prefix="/staff", tags=["Staff Management"])
api_router.include_router(workouts.router, prefix="/workouts", tags=["Workouts"])  # ADD THIS LINE
api_router.include_router(meals.router, prefix="/meals", tags=["Meals & Nutrition"])
api_router.include_router(memberships.router, prefix="/memberships", tags=["Memberships"])
api_router.include_router(training_programs.router, tags=["Training Programs"])

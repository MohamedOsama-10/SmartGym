# app/main.py - v5
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, Response
from sqlalchemy import text
import os
import asyncio

from app.api.v1 import auth, availability, bookings, profile, gyms, subscriptions, admin_owner
from app.api.v1 import admin
from app.api.v1 import workouts
from app.database import engine, Base
from app.api.v1 import reviews
from app.api.v1 import meals
from app.api.v1 import memberships
from app.api.v1 import coach
from app.api.v1 import training_programs
from app.api.v1 import chat
from app.api.v1 import coach_trainees
from app.api.v1 import admin_profile
from app.api.v1 import coach_packages
from app.api.v1 import notifications

from app.models import conversation
from app.models import subscription_request
from app.models import notification

# Global migration status — checked by /health
MIGRATION_STATUS = {"done": False, "error": None}

app = FastAPI(
    title="Gym Management API",
    version="1.0.0",
    description="Backend for gym management system"
)

# ── CORS headers helper ───────────────────────────────────────────────────────
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
}

# ── Handle OPTIONS preflight globally ────────────────────────────────────────
@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return Response(status_code=200, headers=CORS_HEADERS)
    response = await call_next(request)
    for key, value in CORS_HEADERS.items():
        response.headers[key] = value
    return response

uploads_dir = "uploads"
avatars_dir = os.path.join(uploads_dir, "avatars")
chat_media_dir = os.path.join(uploads_dir, "chat")

os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(avatars_dir, exist_ok=True)
os.makedirs(chat_media_dir, exist_ok=True)
print(f"📁 Uploads directory: {os.path.abspath(uploads_dir)}")
print(f"📁 Avatars directory: {os.path.abspath(avatars_dir)}")

app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.on_event("startup")
async def run_migrations():
    """Fire-and-forget: kick off migrations in background so /health responds immediately."""
    asyncio.create_task(_run_migrations_background())


async def _run_migrations_background():
    """All DB work runs here after the app is already accepting requests."""
    global MIGRATION_STATUS
    from app.config import settings

    print("=" * 60)
    print("AZURE SQL DATABASE STARTUP (background)")
    print("=" * 60)
    print(f"DB_SERVER:   {settings.DB_SERVER}")
    print(f"DB_NAME:     {settings.DB_NAME}")
    print(f"DB_USER:     {settings.DB_USER}")
    print("=" * 60)

    def do_all_migrations():
        """All database operations in a single function"""

        # Test connection
        print("🔵 Connecting to Azure SQL...")
        with engine.connect() as test_conn:
            result = test_conn.execute(text("SELECT DB_NAME()"))
            db_name = result.scalar()
            print(f"🟢 Connected to: {db_name}")

        # Create tables
        print("🔵 Creating/verifying tables...")
        Base.metadata.create_all(bind=engine)
        print("🟢 Tables ready")

        # Run all migrations in single transaction
        print("🔵 Running migrations...")
        with engine.begin() as conn:

            def ensure_column(table, col, sql):
                try:
                    conn.execute(text(f"""
                        IF NOT EXISTS (
                            SELECT * FROM sys.columns
                            WHERE object_id = OBJECT_ID('{table}') AND name = '{col}'
                        )
                        {sql}
                    """))
                    print(f"  ✅ {table}.{col}")
                except Exception as e:
                    print(f"  ⚠️  {table}.{col}: {e}")

            # Conversations
            ensure_column("conversations", "coach_user_id",
                "ALTER TABLE conversations ADD coach_user_id INT NULL REFERENCES users(id)")
            ensure_column("conversations", "customer_user_id",
                "ALTER TABLE conversations ADD customer_user_id INT NULL REFERENCES users(id)")

            try:
                conn.execute(text("""
                    DECLARE @kc NVARCHAR(255)
                    SELECT TOP 1 @kc = kc.name
                    FROM sys.key_constraints kc
                    JOIN sys.index_columns ic ON kc.parent_object_id = ic.object_id AND kc.unique_index_id = ic.index_id
                    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                    WHERE kc.parent_object_id = OBJECT_ID('conversations')
                      AND kc.type = 'UQ'
                      AND c.name IN ('participant1_id', 'participant2_id')
                    IF @kc IS NOT NULL
                        EXEC('ALTER TABLE conversations DROP CONSTRAINT [' + @kc + ']')
                """))
                print("  ✅ Dropped old conversations constraint")
            except Exception as e:
                print(f"  ⚠️  Drop constraint: {e}")

            try:
                rows = conn.execute(text("""
                    SELECT c.name, t.name AS type_name, c.max_length
                    FROM sys.columns c
                    JOIN sys.types t ON c.user_type_id = t.user_type_id
                    WHERE c.object_id = OBJECT_ID('conversations')
                      AND c.is_nullable = 0
                      AND c.is_identity = 0
                      AND c.name NOT IN ('id', 'created_at', 'coach_user_id', 'customer_user_id')
                """)).fetchall()

                for row in rows:
                    col, t, ml = row.name, row.type_name.upper(), row.max_length
                    ts = f"NVARCHAR({'MAX' if ml == -1 else ml // 2})" if t == 'NVARCHAR' else \
                         f"VARCHAR({'MAX' if ml == -1 else ml})" if t == 'VARCHAR' else t
                    try:
                        conn.execute(text(f"ALTER TABLE conversations ALTER COLUMN [{col}] {ts} NULL"))
                        print(f"  ✅ conversations.{col} nullable")
                    except Exception as e:
                        print(f"  ⚠️  conversations.{col}: {e}")
            except Exception as e:
                print(f"  ⚠️  conversations nullable scan: {e}")

            # Chat messages
            ensure_column("chat_messages", "media_url", "ALTER TABLE chat_messages ADD media_url NVARCHAR(MAX) NULL")
            ensure_column("chat_messages", "conversation_id", "ALTER TABLE chat_messages ADD conversation_id INT NULL REFERENCES conversations(id)")
            ensure_column("chat_messages", "sender_user_id", "ALTER TABLE chat_messages ADD sender_user_id INT NULL REFERENCES users(id)")
            ensure_column("chat_messages", "is_read", "ALTER TABLE chat_messages ADD is_read BIT NOT NULL DEFAULT 0")

            try:
                conn.execute(text("""
                    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('chat_messages') AND name = 'text')
                    ALTER TABLE chat_messages ALTER COLUMN text NVARCHAR(MAX) NULL
                """))
                print("  ✅ chat_messages.text is NVARCHAR(MAX)")
            except Exception as e:
                print(f"  ⚠️  chat_messages.text: {e}")

            try:
                rows = conn.execute(text("""
                    SELECT c.name, t.name AS type_name, c.max_length
                    FROM sys.columns c
                    JOIN sys.types t ON c.user_type_id = t.user_type_id
                    WHERE c.object_id = OBJECT_ID('chat_messages')
                      AND c.is_nullable = 0
                      AND c.is_identity = 0
                      AND c.name NOT IN ('id', 'conversation_id', 'sender_user_id', 'text', 'media_url', 'is_read', 'created_at')
                """)).fetchall()

                for row in rows:
                    col, t, ml = row.name, row.type_name.upper(), row.max_length
                    ts = f"NVARCHAR({'MAX' if ml == -1 else ml // 2})" if t == 'NVARCHAR' else \
                         f"VARCHAR({'MAX' if ml == -1 else ml})" if t == 'VARCHAR' else t
                    try:
                        conn.execute(text(f"ALTER TABLE chat_messages ALTER COLUMN [{col}] {ts} NULL"))
                        print(f"  ✅ chat_messages.{col} nullable")
                    except Exception as e:
                        print(f"  ⚠️  chat_messages.{col}: {e}")
            except Exception as e:
                print(f"  ⚠️  chat_messages nullable scan: {e}")

            # Meal logs
            ensure_column("meal_logs", "log_date", "ALTER TABLE meal_logs ADD log_date DATE NULL")
            ensure_column("meal_logs", "log_time", "ALTER TABLE meal_logs ADD log_time TIME NULL")
            ensure_column("meal_logs", "logged_at", "ALTER TABLE meal_logs ADD logged_at DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET()")
            ensure_column("meal_logs", "notes", "ALTER TABLE meal_logs ADD notes NVARCHAR(500) NULL")

            try:
                conn.execute(text("""
                    UPDATE meal_logs
                    SET log_date = CAST(logged_at AS DATE),
                        log_time = CAST(logged_at AS TIME)
                    WHERE log_date IS NULL AND logged_at IS NOT NULL
                """))
                print("  ✅ meal_logs backfilled")
            except Exception as e:
                print(f"  ⚠️  meal_logs backfill: {e}")

            # Coaches
            for col, sql in [
                ("avatar_url", "NVARCHAR(500)"),
                ("bio", "NVARCHAR(2000)"),
                ("social_youtube", "NVARCHAR(200)"),
                ("cv_url", "NVARCHAR(500)"),
            ]:
                ensure_column("coaches", col, f"ALTER TABLE coaches ADD {col} {sql} NULL")

            # Admins
            ensure_column("admins", "gym_id", "ALTER TABLE admins ADD gym_id INT NULL")
            ensure_column("admins", "avatar_url", "ALTER TABLE admins ADD avatar_url NVARCHAR(500) NULL")

            # Owners
            ensure_column("owners", "avatar_url", "ALTER TABLE owners ADD avatar_url NVARCHAR(500) NULL")

            # Gyms
            for col, sql in [
                ("phone", "NVARCHAR(20)"),
                ("image_url", "NVARCHAR(500)"),
                ("description", "NVARCHAR(MAX)"),
            ]:
                ensure_column("gyms", col, f"ALTER TABLE gyms ADD {col} {sql} NULL")

            for col, sql in [
                ("is_active", "BIT NOT NULL DEFAULT 1"),
                ("total_members", "INT NULL DEFAULT 0"),
                ("active_members", "INT NULL DEFAULT 0"),
                ("total_coaches", "INT NULL DEFAULT 0"),
            ]:
                 ensure_column("gyms", col, f"ALTER TABLE gyms ADD {col} {sql}")

            # Customers
            for col, sql in [
                ("email", "NVARCHAR(100)"),
                ("full_name", "NVARCHAR(255)"),
                ("phone", "NVARCHAR(50)"),
                ("avatar_url", "NVARCHAR(500)"),
                ("assigned_coach_id", "INT NULL REFERENCES coaches(id)"),
            ]:
                ensure_column("customers", col, f"ALTER TABLE customers ADD {col} {sql}")

            # Subscriptions
            for col, sql in [
                ("plan_name", "NVARCHAR(100)"),
                ("plan_type", "NVARCHAR(50)"),
                ("coach_package_id", "INT NULL REFERENCES coach_packages(id)"),
                ("sessions_remaining", "INT"),
            ]:
                ensure_column("subscriptions", col, f"ALTER TABLE subscriptions ADD {col} {sql}")

            try:
                conn.execute(text("""
                    UPDATE subscriptions
                    SET status = 'cancelled'
                    WHERE status = 'active'
                      AND id NOT IN (
                          SELECT MAX(id) FROM subscriptions WHERE status = 'active' GROUP BY customer_id
                      )
                """))
                print("  ✅ Fixed duplicate subscriptions")
            except Exception as e:
                print(f"  ⚠️  Duplicate subscriptions: {e}")

            # Nutrition goals
            for col, sql in [
                ("updated_at", "DATETIMEOFFSET"),
                ("created_at", "DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET()"),
                ("calories", "INT NULL DEFAULT 2000"),
                ("protein", "FLOAT NULL DEFAULT 150"),
                ("carbs", "FLOAT NULL DEFAULT 250"),
                ("fats", "FLOAT NULL DEFAULT 70"),
            ]:
                ensure_column("nutrition_goals", col, f"ALTER TABLE nutrition_goals ADD {col} {sql}")

            # Meals
            for col, sql in [
                ("customer_id", "INT NULL REFERENCES customers(id)"),
                ("is_favorite", "BIT NULL DEFAULT 0"),
                ("is_custom", "BIT NULL DEFAULT 1"),
                ("type", "NVARCHAR(20) NULL DEFAULT 'other'"),
                ("name", "NVARCHAR(200)"),
                ("calories", "INT NULL DEFAULT 0"),
                ("protein", "FLOAT NULL DEFAULT 0"),
                ("carbs", "FLOAT NULL DEFAULT 0"),
                ("fats", "FLOAT NULL DEFAULT 0"),
                ("image_url", "NVARCHAR(500)"),
                ("ingredients", "NVARCHAR(MAX)"),
                ("created_at", "DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET()"),
            ]:
                ensure_column("meals", col, f"ALTER TABLE meals ADD {col} {sql}")

            try:
                conn.execute(text("""
                    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('meals') AND name = 'meal_type')
                    EXEC('UPDATE meals SET [type] = meal_type WHERE meal_type IS NOT NULL AND ([type] IS NULL OR [type] = ''other'')')
                """))
                print("  ✅ meals.type backfilled")
            except Exception as e:
                print(f"  ⚠️  meals.type backfill: {e}")

            # Subscription requests
            try:
                conn.execute(text("""
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'subscription_requests')
                    CREATE TABLE subscription_requests (
                        id INT PRIMARY KEY IDENTITY(1,1),
                        customer_id INT NOT NULL REFERENCES customers(id),
                        plan_id INT NULL REFERENCES membership_plans(id),
                        coach_package_id INT NULL REFERENCES coach_packages(id),
                        plan_name NVARCHAR(100) NOT NULL,
                        requested_price FLOAT NOT NULL DEFAULT 0,
                        discount FLOAT NOT NULL DEFAULT 0,
                        discount_pct FLOAT NOT NULL DEFAULT 0,
                        final_price FLOAT NULL,
                        status NVARCHAR(20) NOT NULL DEFAULT 'pending',
                        notes NVARCHAR(500) NULL,
                        approved_by INT NULL REFERENCES users(id),
                        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
                        updated_at DATETIMEOFFSET NULL
                    )
                """))
                print("  ✅ subscription_requests table")
            except Exception as e:
                print(f"  ⚠️  subscription_requests: {e}")

            ensure_column("subscription_requests", "coach_package_id",
                "ALTER TABLE subscription_requests ADD coach_package_id INT NULL REFERENCES coach_packages(id)")

            # Coach packages
            ensure_column("coach_packages", "status", "ALTER TABLE coach_packages ADD status NVARCHAR(20) NOT NULL DEFAULT 'pending'")
            ensure_column("coach_packages", "rejection_reason", "ALTER TABLE coach_packages ADD rejection_reason NVARCHAR(500) NULL")

            # Membership plans
            ensure_column("membership_plans", "description", "ALTER TABLE membership_plans ADD description NVARCHAR(MAX) NULL")

            # Admin tables
            try:
                conn.execute(text("""
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admin_profiles')
                    CREATE TABLE admin_profiles (
                        id INT PRIMARY KEY IDENTITY(1,1),
                        admin_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                        full_name NVARCHAR(200) NULL,
                        email NVARCHAR(200) NULL,
                        phone NVARCHAR(50) NULL,
                        date_of_birth DATE NULL,
                        gender NVARCHAR(20) NULL,
                        gym_branch NVARCHAR(200) NULL,
                        address NVARCHAR(500) NULL,
                        emergency_contact_name NVARCHAR(200) NULL,
                        emergency_contact_phone NVARCHAR(50) NULL,
                        emergency_contact_relationship NVARCHAR(100) NULL,
                        profile_photo_path NVARCHAR(500) NULL,
                        updated_at DATETIME2 DEFAULT GETDATE()
                    )
                """))
                print("  ✅ admin_profiles table")
            except Exception as e:
                print(f"  ⚠️  admin_profiles: {e}")

            try:
                conn.execute(text("""
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admin_reports')
                    CREATE TABLE admin_reports (
                        id INT PRIMARY KEY IDENTITY(1,1),
                        admin_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        name NVARCHAR(200) NOT NULL,
                        type NVARCHAR(100) NOT NULL DEFAULT 'Custom',
                        period NVARCHAR(100) NULL,
                        description NVARCHAR(MAX) NULL,
                        created_at DATETIME2 DEFAULT GETDATE()
                    )
                """))
                print("  ✅ admin_reports table")
            except Exception as e:
                print(f"  ⚠️  admin_reports: {e}")

        print("🟢 All migrations completed")
        return True

    max_retries = 15
    base_delay = 5

    for attempt in range(max_retries):
        try:
            loop = asyncio.get_event_loop()
            await asyncio.wait_for(
                loop.run_in_executor(None, do_all_migrations),
                timeout=120
            )
            MIGRATION_STATUS["done"] = True
            break

        except asyncio.TimeoutError:
            print(f"❌ Timeout on attempt {attempt + 1}")
            if attempt == max_retries - 1:
                MIGRATION_STATUS["error"] = "Database operations timed out"
                return

        except Exception as e:
            error_str = str(e).lower()
            is_transient = any([
                "cannot open database" in error_str,
                "not currently available" in error_str,
                "login failed" in error_str,
            ])

            if is_transient and attempt < max_retries - 1:
                wait_time = min(base_delay * (1.5 ** attempt), 60)
                print(f"⏳ Retrying in {wait_time:.1f}s... (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(wait_time)
            else:
                print(f"❌ Failed: {e}")
                MIGRATION_STATUS["error"] = str(e)
                return

    os.makedirs("uploads/profiles", exist_ok=True)
    print("=" * 60)
    print("✅ STARTUP COMPLETE")
    print("=" * 60)


# Register all routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(availability.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(gyms.router, prefix="/api/v1")
app.include_router(subscriptions.router, prefix="/api/v1")
app.include_router(admin_owner.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(workouts.router, prefix="/api/v1")
app.include_router(meals.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    response = JSONResponse(status_code=500, content={"detail": str(exc)})
    for key, value in CORS_HEADERS.items():
        response.headers[key] = value
    return response


@app.get("/")
def root():
    return {"message": "Gym Management API is running"}


@app.get("/health")
def health_check():
    from app.config import settings
    return {
        "status": "healthy",
        "migrations_done": MIGRATION_STATUS["done"],
        "migrations_error": MIGRATION_STATUS["error"],
        "version": "1.0.0",
        "uploads_path": os.path.abspath(uploads_dir),
        "environment": os.environ.get("RAILWAY_ENVIRONMENT", "local"),
        "database": f"{settings.DB_SERVER}/{settings.DB_NAME}",
    }


app.include_router(reviews.router, prefix="/api/v1")
app.include_router(memberships.router, prefix="/api/v1")
app.include_router(coach.router, prefix="/api/v1")
app.include_router(training_programs.router, prefix="/api/v1")
app.include_router(coach_trainees.router, prefix="/api/v1")
app.include_router(admin_profile.router, prefix="/api/v1")
app.include_router(coach_packages.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)

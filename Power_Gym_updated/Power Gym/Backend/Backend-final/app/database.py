# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
import urllib
import sys

def get_connection_string():
    """Build connection string for SQL Server"""
    
    db_name = settings.corrected_db_name

    # Detect best available driver
    driver = "ODBC Driver 18 for SQL Server"

    if settings.DB_PASSWORD and settings.DB_PASSWORD.strip():
        # SQL Authentication (Azure SQL)
        params = urllib.parse.quote_plus(
            f"DRIVER={{{driver}}};"
            f"SERVER={settings.DB_SERVER};"
            f"DATABASE={db_name};"
            f"UID={settings.DB_USER};"
            f"PWD={settings.DB_PASSWORD};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=no;"
            f"Connection Timeout=60;"
        )
    else:
        # Windows Authentication (local development)
        params = urllib.parse.quote_plus(
            f"DRIVER={{{driver}}};"
            f"SERVER={settings.DB_SERVER};"
            f"DATABASE={db_name};"
            f"Trusted_Connection=yes;"
            f"Encrypt=yes;"                  # Driver 18 requires this
            f"TrustServerCertificate=yes;"   # Allow self-signed local cert
            f"Connection Timeout=30;"
        )

    return f"mssql+pyodbc:///?odbc_connect={params}"

try:
    if not settings.DB_SERVER or not settings.DB_NAME:
        raise ValueError(
            "DB_SERVER or DB_NAME not configured. "
            "Set these in Railway › Variables before deploying."
        )
    engine = create_engine(
        get_connection_string(),
        echo=False,
        pool_pre_ping=True,       # Re-tests connection before each use
        pool_recycle=1800,        # Recycle every 30 min (was 300 — too short)
        pool_size=5,
        max_overflow=10,
    )
except Exception as _db_init_err:
    print(f"❌ DATABASE INIT FAILED: {_db_init_err}", file=sys.stderr)
    print("   → Set DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD in Railway environment variables", file=sys.stderr)
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
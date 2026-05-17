# app/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DB_SERVER: str = ""
    DB_NAME: str = ""
    DB_USER: Optional[str] = ""
    DB_PASSWORD: Optional[str] = ""
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    RESET_TOKEN_EXPIRE_MINUTES: int = 30
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = ""
    EMAILS_FROM_NAME: str = "Gym Management System"
    FRONTEND_URL: str = "http://localhost:3000"

    # Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME: str = "dfpab5tba"
    CLOUDINARY_API_KEY: str = "136762841611314"
    CLOUDINARY_API_SECRET: str = "9k_CDzN1SbTrNWHUoXe6sYorXmk"

    @property
    def corrected_db_name(self) -> str:
        if "database.windows.net" in self.DB_SERVER and "_" in self.DB_NAME:
            corrected = self.DB_NAME.replace("_", "-")
            print(f"🔧 Auto-corrected DB_NAME: '{self.DB_NAME}' → '{corrected}'")
            return corrected
        return self.DB_NAME

    @property
    def is_azure_sql(self) -> bool:
        return "database.windows.net" in self.DB_SERVER

    class Config:
        env_file = ".env"

settings = Settings()

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "VitalVision API"
    app_version: str = "2.0.0"
    api_prefix: str = "/api/v1"

    database_url: str = (
        "postgresql+psycopg2://neondb_owner:npg_zd7Fm9AxqOBW@"
        "ep-lively-paper-apq1bpsh-pooler.c-7.us-east-1.aws.neon.tech/neondb"
        "?sslmode=require&channel_binding=require"
    )

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        # Vercel deployments — update FRONTEND_URL env var after deploying frontend
        "https://vitalvision-final.vercel.app",
        "https://vitalvision-frontend.vercel.app",
    ]

    # Override via env var: FRONTEND_URL=https://your-app.vercel.app
    frontend_url: str = ""

    secret_key: str = "vitalvision-dev-secret-change-in-production"
    access_token_expire_minutes: int = 1440

    demo_username: str = "demo"
    demo_password: str = "vitalvision123"
    demo_bearer_token: str = "vitalvision-demo-token-swagger"


@lru_cache
def get_settings() -> Settings:
    return Settings()

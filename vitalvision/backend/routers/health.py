import time

from fastapi import APIRouter

from app.database import engine
from schemas.common import HealthResponse, ServiceInfoResponse

router = APIRouter(tags=["Health"])


@router.get("/", response_model=ServiceInfoResponse, summary="Service info")
def root() -> ServiceInfoResponse:
    from app.config import get_settings

    settings = get_settings()
    return ServiceInfoResponse(
        service=settings.app_name,
        version=settings.app_version,
        status="running",
        docs_url="http://localhost:8000/docs",
        auth_hint=(
            "Use POST /api/v1/auth/token with demo/vitalvision123, "
            "or Bearer vitalvision-demo-token-swagger for protected routes."
        ),
    )


@router.get("/health", response_model=HealthResponse, summary="Health check")
def health() -> HealthResponse:
    db_status = "unknown"
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return HealthResponse(status="ok", timestamp=time.time(), database=db_status)

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.config import get_settings
from app.dependencies import get_current_user
from auth.security import authenticate_demo_user, create_access_token
from schemas.auth import AuthInfoResponse, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def _read_credentials(request: Request) -> tuple[str | None, str | None]:
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        return body.get("username"), body.get("password")
    form = await request.form()
    return form.get("username"), form.get("password")


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Obtain Bearer token (demo login)",
    description=(
        "Swagger: use Authorize with username `demo` and password `vitalvision123`.\n\n"
        "Also accepts JSON body with the same fields."
    ),
    openapi_extra={
        "requestBody": {
            "content": {
                "application/x-www-form-urlencoded": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "username": {"type": "string", "example": "demo"},
                            "password": {"type": "string", "example": "vitalvision123"},
                        },
                        "required": ["username", "password"],
                    }
                },
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "username": {"type": "string", "example": "demo"},
                            "password": {"type": "string", "example": "vitalvision123"},
                        },
                        "required": ["username", "password"],
                    }
                },
            }
        }
    },
)
async def login(request: Request) -> TokenResponse:
    settings = get_settings()
    username, password = await _read_credentials(request)

    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password required")

    verified = authenticate_demo_user(str(username), str(password))
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    expires = timedelta(minutes=settings.access_token_expire_minutes)
    token = create_access_token(subject=verified, expires_delta=expires)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=int(expires.total_seconds()),
        username=verified,
    )


@router.get(
    "/me",
    response_model=AuthInfoResponse,
    summary="Current auth info",
)
def auth_info(user: str = Depends(get_current_user)) -> AuthInfoResponse:
    settings = get_settings()
    return AuthInfoResponse(
        username=user,
        display_name="VitalVision Demo User",
        auth_method="OAuth2 Bearer JWT, or X-API-Key header",
        swagger_instructions=(
            "Click Authorize → username: demo, password: vitalvision123. "
            "Do NOT type 'Bearer' in the token box."
        ),
        demo_credentials={
            "username": settings.demo_username,
            "password": settings.demo_password,
        },
        demo_bearer_token=settings.demo_bearer_token,
    )

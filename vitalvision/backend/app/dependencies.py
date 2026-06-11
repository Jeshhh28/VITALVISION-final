from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer

from app.config import get_settings
from auth.security import decode_access_token, is_demo_bearer_token

settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.api_prefix}/auth/token",
    auto_error=False,
)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def _normalize_token(token: str | None) -> str | None:
    if not token:
        return None
    token = token.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    return token or None


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    api_key: str | None = Depends(api_key_header),
) -> str:
    cfg = get_settings()

    if api_key and is_demo_bearer_token(api_key.strip()):
        return cfg.demo_username

    token = _normalize_token(token)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Not authenticated. In Swagger click Authorize → "
                "username: demo, password: vitalvision123. "
                "Or use X-API-Key: vitalvision-demo-token-swagger"
            ),
            headers={"WWW-Authenticate": "Bearer"},
        )

    if is_demo_bearer_token(token):
        return cfg.demo_username

    username = decode_access_token(token)
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return username

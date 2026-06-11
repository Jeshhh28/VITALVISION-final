from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from app.config import get_settings
from auth.router import router as auth_router
from routers.analysis import router as analysis_router
from routers.health import router as health_router
from routers.sessions import router as sessions_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "VitalVision backend — video analysis + Neon PostgreSQL sessions.\n\n"
        "**Frontend:** React calls `POST /analyse` (no auth needed).\n\n"
        "**Swagger locked endpoints:** Click **Authorize** →\n"
        "- username: `demo`\n"
        "- password: `vitalvision123`\n\n"
        "Or add header `X-API-Key: vitalvision-demo-token-swagger`"
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(analysis_router)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(sessions_router, prefix=settings.api_prefix)

PROTECTED_PREFIXES = (f"{settings.api_prefix}/sessions", f"{settings.api_prefix}/auth/me")


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    components = schema.setdefault("components", {})
    components.setdefault("securitySchemes", {})
    components["securitySchemes"]["OAuth2Password"] = {
        "type": "oauth2",
        "flows": {
            "password": {
                "tokenUrl": f"{settings.api_prefix}/auth/token",
                "scopes": {},
            }
        },
        "description": "Username: demo | Password: vitalvision123",
    }
    components["securitySchemes"]["ApiKeyAuth"] = {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "description": f"Use value: {settings.demo_bearer_token}",
    }

    for path, path_item in schema.get("paths", {}).items():
        if any(path.startswith(p) for p in PROTECTED_PREFIXES):
            for method in path_item.values():
                if isinstance(method, dict):
                    method["security"] = [{"OAuth2Password": []}, {"ApiKeyAuth": []}]

    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = custom_openapi

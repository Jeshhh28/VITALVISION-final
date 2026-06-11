from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TokenRequest(BaseModel):
    username: str = Field(
        ...,
        description="Demo username",
        json_schema_extra={"example": "demo"},
    )
    password: str = Field(
        ...,
        description="Demo password",
        json_schema_extra={"example": "vitalvision123"},
    )


class TokenResponse(BaseModel):
    access_token: str = Field(..., description="Bearer token for Swagger Authorize button")
    token_type: str = Field(default="bearer")
    expires_in: int = Field(..., description="Token lifetime in seconds")
    username: str


class AuthInfoResponse(BaseModel):
    username: str
    display_name: str
    auth_method: str
    swagger_instructions: str
    demo_credentials: dict[str, str]
    demo_bearer_token: str

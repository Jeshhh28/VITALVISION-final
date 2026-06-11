from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MessageResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: str
    timestamp: float
    database: str


class ServiceInfoResponse(BaseModel):
    service: str
    version: str
    status: str
    docs_url: str
    auth_hint: str


class PaginationMeta(BaseModel):
    total: int
    skip: int
    limit: int


class PaginatedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[Any]
    meta: PaginationMeta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from schemas.common import MessageResponse
from schemas.session import (
    SessionCreateRequest,
    SessionListResponse,
    SessionResponse,
    SessionSummaryResponse,
    SessionUpdateRequest,
)
from services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get(
    "",
    response_model=SessionListResponse,
    summary="List stored sessions",
)
def list_sessions(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=200, description="Maximum records to return"),
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> SessionListResponse:
    service = SessionService(db)
    return service.list(skip=skip, limit=limit)


@router.get(
    "/summary",
    response_model=SessionSummaryResponse,
    summary="Aggregate session statistics",
)
def session_summary(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> SessionSummaryResponse:
    service = SessionService(db)
    return service.summary()


@router.get(
    "/{session_id}",
    response_model=SessionResponse,
    summary="Get session by ID",
)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> SessionResponse:
    service = SessionService(db)
    record = service.get(session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return record


@router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a session record",
)
def create_session(
    payload: SessionCreateRequest,
    db: Session = Depends(get_db),
    user: str = Depends(get_current_user),
) -> SessionResponse:
    service = SessionService(db)
    return service.create(payload, username=user)


@router.put(
    "/{session_id}",
    response_model=SessionResponse,
    summary="Replace/update session fields",
)
def update_session(
    session_id: int,
    payload: SessionUpdateRequest,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> SessionResponse:
    service = SessionService(db)
    record = service.update(session_id, payload)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return record


@router.patch(
    "/{session_id}",
    response_model=SessionResponse,
    summary="Partially update a session",
)
def patch_session(
    session_id: int,
    payload: SessionUpdateRequest,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> SessionResponse:
    service = SessionService(db)
    record = service.update(session_id, payload)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return record


@router.delete(
    "/{session_id}",
    response_model=MessageResponse,
    summary="Delete a session",
)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> MessageResponse:
    service = SessionService(db)
    deleted = service.delete(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return MessageResponse(message=f"Session {session_id} deleted")


@router.delete(
    "",
    response_model=MessageResponse,
    summary="Delete all sessions",
)
def delete_all_sessions(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> MessageResponse:
    service = SessionService(db)
    count = service.delete_all()
    return MessageResponse(message=f"Deleted {count} sessions")

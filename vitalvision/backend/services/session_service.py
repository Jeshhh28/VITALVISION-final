from sqlalchemy.orm import Session

from repositories.session_repository import SessionRepository
from schemas.session import (
    SessionCreateRequest,
    SessionListResponse,
    SessionResponse,
    SessionSummaryResponse,
    SessionUpdateRequest,
)


class SessionService:
    def __init__(self, db: Session):
        self.repo = SessionRepository(db)

    def create(self, payload: SessionCreateRequest, username: str) -> SessionResponse:
        record = self.repo.create(payload, username=username)
        return self._to_response(record)

    def get(self, session_id: int) -> SessionResponse | None:
        record = self.repo.get_by_id(session_id)
        if not record:
            return None
        return self._to_response(record)

    def list(self, skip: int, limit: int) -> SessionListResponse:
        items, total = self.repo.list_sessions(skip=skip, limit=limit)
        return SessionListResponse(
            items=[self._to_response(item) for item in items],
            meta={"total": total, "skip": skip, "limit": limit},
        )

    def update(self, session_id: int, payload: SessionUpdateRequest) -> SessionResponse | None:
        record = self.repo.get_by_id(session_id)
        if not record:
            return None
        updated = self.repo.update(record, payload)
        return self._to_response(updated)

    def delete(self, session_id: int) -> bool:
        record = self.repo.get_by_id(session_id)
        if not record:
            return False
        self.repo.delete(record)
        return True

    def delete_all(self) -> int:
        return self.repo.delete_all()

    def summary(self) -> SessionSummaryResponse:
        data = self.repo.summary()
        return SessionSummaryResponse(**data)

    @staticmethod
    def _to_response(record) -> SessionResponse:
        return SessionResponse(
            id=record.id,
            user_id=record.user_id,
            date=record.session_date,
            source=record.source,
            hr=record.hr,
            confidence=record.confidence,
            spo2=record.spo2,
            spo2Confidence=record.spo2_confidence,
            temp=record.temp,
            stress=record.stress,
            dominant=record.dominant_emotion,
            emotionDistrib=record.emotion_distrib,
            timeline=record.timeline,
            alerts=record.alerts,
            meta=record.meta,
            notes=record.notes,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

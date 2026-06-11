from datetime import datetime, timezone

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from models import SessionRecord
from schemas.session import SessionCreateRequest, SessionUpdateRequest


class SessionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, payload: SessionCreateRequest, username: str | None = None) -> SessionRecord:
        data = payload.model_dump(by_alias=False, exclude_none=True)
        record = SessionRecord(
            session_date=data.get("session_date") or datetime.now(timezone.utc),
            source=data.get("source"),
            hr=data["hr"],
            confidence=data["confidence"],
            spo2=data["spo2"],
            spo2_confidence=data.get("spo2_confidence"),
            temp=self._to_dict(data.get("temp")),
            stress=self._to_dict(data.get("stress")),
            dominant_emotion=data.get("dominant"),
            emotion_distrib=data.get("emotion_distrib"),
            timeline=data.get("timeline") or [],
            alerts=data.get("alerts") or [],
            meta=data.get("meta"),
            notes=data.get("notes"),
            raw_results=data.get("raw_results"),
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_by_id(self, session_id: int) -> SessionRecord | None:
        return self.db.get(SessionRecord, session_id)

    def list_sessions(self, skip: int = 0, limit: int = 50) -> tuple[list[SessionRecord], int]:
        total = self.db.scalar(select(func.count()).select_from(SessionRecord)) or 0
        stmt = (
            select(SessionRecord)
            .order_by(desc(SessionRecord.session_date))
            .offset(skip)
            .limit(limit)
        )
        items = list(self.db.scalars(stmt).all())
        return items, total

    def update(self, record: SessionRecord, payload: SessionUpdateRequest) -> SessionRecord:
        data = payload.model_dump(by_alias=False, exclude_unset=True)
        field_map = {
            "spo2_confidence": "spo2_confidence",
            "dominant": "dominant_emotion",
            "emotion_distrib": "emotion_distrib",
        }
        for key, value in data.items():
            attr = field_map.get(key, key)
            if key in {"temp", "stress"}:
                value = self._to_dict(value)
            setattr(record, attr, value)
        self.db.commit()
        self.db.refresh(record)
        return record

    def delete(self, record: SessionRecord) -> None:
        self.db.delete(record)
        self.db.commit()

    def delete_all(self) -> int:
        count = self.db.scalar(select(func.count()).select_from(SessionRecord)) or 0
        for record in self.db.scalars(select(SessionRecord)).all():
            self.db.delete(record)
        self.db.commit()
        return count

    def summary(self) -> dict:
        total = self.db.scalar(select(func.count()).select_from(SessionRecord)) or 0
        avg_hr = self.db.scalar(select(func.avg(SessionRecord.hr))) or 0
        avg_spo2 = self.db.scalar(select(func.avg(SessionRecord.spo2))) or 0
        latest = self.db.scalar(
            select(SessionRecord.session_date).order_by(desc(SessionRecord.session_date)).limit(1)
        )
        return {
            "total_sessions": int(total),
            "avg_hr": int(round(float(avg_hr))) if total else 0,
            "avg_spo2": int(round(float(avg_spo2))) if total else 0,
            "latest_session_date": latest,
        }

    @staticmethod
    def _to_dict(value):
        if value is None:
            return None
        if hasattr(value, "model_dump"):
            return value.model_dump(exclude_none=True)
        return value

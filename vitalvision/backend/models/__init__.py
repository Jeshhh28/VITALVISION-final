from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sessions: Mapped[list["SessionRecord"]] = relationship(
        "SessionRecord", back_populates="user"
    )


class SessionRecord(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    session_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    source: Mapped[str | None] = mapped_column(String(32), nullable=True)

    hr: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    spo2: Mapped[float] = mapped_column(nullable=False)
    spo2_confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)

    temp: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    stress: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    dominant_emotion: Mapped[str | None] = mapped_column(String(64), nullable=True)
    emotion_distrib: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    timeline: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    alerts: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    raw_results: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User | None"] = relationship("User", back_populates="sessions")

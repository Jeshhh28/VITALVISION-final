from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TempReading(BaseModel):
    label: str | None = None
    range: str | None = None
    value: float | None = None


class StressReading(BaseModel):
    level: str | None = None
    score: int | None = None
    color: str | None = None


class TimelinePoint(BaseModel):
    second: float | None = Field(default=None, alias="second")
    bpm: int | float

    model_config = ConfigDict(populate_by_name=True)


class AlertItem(BaseModel):
    id: int
    msg: str
    severity: str
    time: str


class AnalysisMeta(BaseModel):
    n_frames: int | None = None
    fps: float | None = None
    duration_s: float | None = None


class AnalysisResponse(BaseModel):
    hr: int
    confidence: int
    spo2: float
    spo2Confidence: int | None = Field(default=None, alias="spo2Confidence")
    temp: TempReading | dict | None = None
    stress: StressReading | dict | None = None
    dominant: str | None = None
    emotionDistrib: dict[str, float] | None = Field(default=None, alias="emotionDistrib")
    timeline: list[dict[str, Any] | TimelinePoint] = Field(default_factory=list)
    alerts: list[AlertItem | dict] = Field(default_factory=list)
    meta: AnalysisMeta | dict | None = None
    error: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class QualityCheckResponse(BaseModel):
    ok: bool
    issues: list[str]
    brightness: float
    blur_score: float
    face_stability: float


class SessionCreateRequest(BaseModel):
    hr: int = Field(..., ge=0, le=250, examples=[72])
    confidence: int = Field(..., ge=0, le=100, examples=[85])
    spo2: float = Field(..., ge=0, le=100, examples=[98.5])
    spo2_confidence: int | None = Field(default=None, ge=0, le=100, alias="spo2Confidence")
    temp: TempReading | dict | None = None
    stress: StressReading | dict | None = None
    dominant: str | None = Field(default=None, examples=["neutral"])
    emotion_distrib: dict[str, float] | None = Field(default=None, alias="emotionDistrib")
    timeline: list[dict[str, Any]] = Field(default_factory=list)
    alerts: list[dict[str, Any]] = Field(default_factory=list)
    meta: dict[str, Any] | None = None
    source: str | None = Field(default=None, examples=["live"])
    session_date: datetime | None = Field(default=None, description="Optional session timestamp")
    notes: str | None = None
    raw_results: dict[str, Any] | None = Field(
        default=None,
        description="Full analysis payload as returned by /analyse",
    )

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "hr": 72,
                "confidence": 85,
                "spo2": 98.5,
                "spo2Confidence": 80,
                "dominant": "neutral",
                "temp": {"label": "Normal", "range": "36.1–37.2°C", "value": 36.8},
                "stress": {"level": "Low-Moderate", "score": 2, "color": "#84CC16"},
                "emotionDistrib": {"neutral": 80, "happy": 20},
                "timeline": [{"second": 0, "bpm": 70}],
                "alerts": [],
                "source": "live",
            }
        },
    )


class SessionUpdateRequest(BaseModel):
    hr: int | None = Field(default=None, ge=0, le=250)
    confidence: int | None = Field(default=None, ge=0, le=100)
    spo2: float | None = Field(default=None, ge=0, le=100)
    spo2_confidence: int | None = Field(default=None, ge=0, le=100, alias="spo2Confidence")
    temp: TempReading | dict | None = None
    stress: StressReading | dict | None = None
    dominant: str | None = None
    emotion_distrib: dict[str, float] | None = Field(default=None, alias="emotionDistrib")
    timeline: list[dict[str, Any]] | None = None
    alerts: list[dict[str, Any]] | None = None
    meta: dict[str, Any] | None = None
    source: str | None = None
    notes: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class SessionResponse(BaseModel):
    id: int
    user_id: int | None = None
    date: datetime
    source: str | None = None
    hr: int
    confidence: int
    spo2: float
    spo2Confidence: int | None = None
    temp: dict | None = None
    stress: dict | None = None
    dominant: str | None = None
    emotionDistrib: dict | None = None
    timeline: list | None = None
    alerts: list | None = None
    meta: dict | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionListResponse(BaseModel):
    items: list[SessionResponse]
    meta: dict[str, int]


class SessionSummaryResponse(BaseModel):
    total_sessions: int
    avg_hr: int
    avg_spo2: int
    latest_session_date: datetime | None = None

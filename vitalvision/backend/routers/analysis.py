from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from repositories.session_repository import SessionRepository
from schemas.session import AnalysisResponse, QualityCheckResponse, SessionCreateRequest
from services.video_analysis import analyse_video_bytes, quality_check_bytes

router = APIRouter(tags=["Video Analysis"])


def _persist_analysis_session(db: Session, result: dict) -> None:
    payload = SessionCreateRequest(
        hr=result["hr"],
        confidence=result["confidence"],
        spo2=result["spo2"],
        spo2Confidence=result.get("spo2Confidence"),
        temp=result.get("temp"),
        stress=result.get("stress"),
        dominant=result.get("dominant"),
        emotionDistrib=result.get("emotionDistrib") or {},
        timeline=result.get("timeline") or [],
        alerts=result.get("alerts") or [],
        meta=result.get("meta"),
        raw_results=result,
    )
    record = SessionRepository(db).create(payload)
    print(f"[sessions] Saved to Neon PostgreSQL — id={record.id}, hr={record.hr}")


@router.post(
    "/analyse",
    response_model=AnalysisResponse,
    summary="Analyse uploaded video for vital signs",
    description=(
        "Accepts a face video (WebM/MP4) and returns heart rate, SpO2 estimate, "
        "temperature proxy, stress, emotions, timeline, and alerts. "
        "Public endpoint used by the React frontend at /processing."
    ),
)
async def analyse_video(
    file: UploadFile = File(..., description="Face video file (max 200 MB)"),
    db: Session = Depends(get_db),
):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video (MP4/WebM/AVI)")

    content = await file.read()
    if len(content) > 200 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum 200 MB.")

    try:
        result = analyse_video_bytes(content, file.content_type)
        _persist_analysis_session(db, result)
        return AnalysisResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Processing error: {exc}") from exc


@router.post(
    "/quality-check",
    response_model=QualityCheckResponse,
    summary="Pre-check video quality before analysis",
)
async def quality_check(file: UploadFile = File(..., description="Face video file")):
    content = await file.read()
    if len(content) > 200 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum 200 MB.")

    result = quality_check_bytes(content)
    return QualityCheckResponse(**result)

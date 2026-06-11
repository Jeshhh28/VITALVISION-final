"""
VitalVision — FastAPI Backend
Handles video processing when browser WASM compute is insufficient.
Implements rPPG (POS/CHROM), SpO2, emotion recognition, temperature proxy.

Run: uvicorn main:app --reload --port 8000
Install: pip install fastapi uvicorn opencv-python mediapipe numpy scipy deepface
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import cv2
import numpy as np
from scipy import signal
from scipy.signal import detrend
from scipy.fft import fft, fftfreq
import tempfile
import os
import time
from typing import Optional
try:
    from deepface import DeepFace
    print("DeepFace loaded successfully")
except Exception as e:
    print("DeepFace import failed:", e)
    DeepFace = None

app = FastAPI(title="VitalVision API", version="1.0.0")

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Utilities ─────────────────────────────────────────────────────────────

def bandpass_filter(
    signal_arr: np.ndarray,
    fps: float,
    low: float = 0.75,
    high: float = 4.0
) -> np.ndarray:

    if fps is None or fps <= 1:
        fps = 30.0

    nyq = fps / 2.0

    low_cut = low / nyq
    high_cut = high / nyq

    if low_cut <= 0:
        low_cut = 0.01

    if high_cut >= 1:
        high_cut = 0.99

    if low_cut >= high_cut:
        return signal_arr

    b, a = signal.butter(
        4,
        [low_cut, high_cut],
        btype="band"
    )

    return signal.filtfilt(b, a, signal_arr)


def iqr_reject_outliers(arr: np.ndarray) -> np.ndarray:
    """Remove outliers using IQR method."""
    q1, q3 = np.percentile(arr, [25, 75])
    iqr = q3 - q1
    mask = (arr >= q1 - 1.5 * iqr) & (arr <= q3 + 1.5 * iqr)
    return arr[mask]


def pos_rppg(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    """
    Plane-Orthogonal-to-Skin (POS) rPPG algorithm.
    Wang et al., IEEE TBME 2017.
    """
    eps = 1e-8
    r_n = r / (r.mean() + eps)
    g_n = g / (g.mean() + eps)
    b_n = b / (b.mean() + eps)
    x = 3 * r_n - 2 * g_n
    y = 1.5 * r_n + g_n - 1.5 * b_n
    sigma_x = x.std() + eps
    sigma_y = y.std() + eps
    return x - (sigma_x / sigma_y) * y


def chrom_rppg(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    """
    CHROM rPPG algorithm — De Haan & Jeanne, IEEE TBME 2013.
    Chrominance-based, more robust to motion artefacts.
    """
    eps = 1e-8
    r_n = r / (r.mean() + eps)
    g_n = g / (g.mean() + eps)
    b_n = b / (b.mean() + eps)
    xs = 3 * r_n - 2 * g_n
    ys = 1.5 * r_n + g_n - 1.5 * b_n
    xf = bandpass_filter(xs, 30.0)
    yf = bandpass_filter(ys, 30.0)
    alpha = xf.std() / (yf.std() + eps)
    return xf - alpha * yf


def estimate_heart_rate(filtered: np.ndarray, fps: float) -> dict:
    """
    FFT + Peak Detection heart rate estimation
    """

    # FFT estimate
    freqs, psd = signal.welch(
        filtered,
        fs=fps,
        nperseg=min(len(filtered), 256)
    )

    mask = (freqs >= 0.75) & (freqs <= 4.0)

    if not mask.any():
        return {"bpm": 72, "confidence": 0}

    peak_freq = freqs[mask][np.argmax(psd[mask])]
    fft_bpm = peak_freq * 60

    # Peak detection estimate
    peaks, _ = signal.find_peaks(
        filtered,
        distance=int(fps * 0.4)
    )

    if len(peaks) > 2:

        peak_intervals = np.diff(peaks) / fps

        mean_interval = np.mean(peak_intervals)

        peak_bpm = 60 / mean_interval

        bpm = round((fft_bpm + peak_bpm) / 2)

    else:
        bpm = round(fft_bpm)

    # Confidence
    total_energy = psd[mask].sum()
    peak_energy = psd[mask].max()

    confidence = min(
        99,
        round(
            float(
                peak_energy /
                (total_energy + 1e-8)
            ) * 100 * 3
        )
    )

    return {
        "bpm": max(40, min(200, bpm)),
        "confidence": confidence
    }


def estimate_spo2(r, g):
    r_f = bandpass_filter(detrend(r), 30)
    g_f = bandpass_filter(detrend(g), 30)
    ac_r = np.std(r_f)
    ac_g = np.std(g_f)
    dc_r = np.mean(r)
    dc_g = np.mean(g)
    if dc_r <= 0 or dc_g <= 0:
        return {"spo2": 98, "confidence": 30}
    if ac_r < 0.5 or ac_g < 0.5:
        return {"spo2": 98, "confidence": 20}
    ratio = (ac_r / dc_r) / (ac_g / dc_g)
    spo2 = np.clip(108 - 12 * ratio,92,100)
    signal_quality = ac_g / dc_g
    confidence = np.clip(int(signal_quality * 5000),50,95)
    return {"spo2": round(float(spo2), 1),"confidence": int(confidence)}


def estimate_temperature(r: np.ndarray, g:np.ndarray) -> dict:
    """Red-channel intensity proxy for body temperature."""
    mean_r = np.mean(signal.medfilt(r, 5))
    mean_g = np.mean(signal.medfilt(g, 5))

    skin_ratio = mean_r / (mean_g + 1e-8)
    temp_c = float(
        np.clip(
            36.0 + ((skin_ratio - 1.0) * 4.0),
            35.0,
            39.0
        )
    )
    if temp_c <= 37.2:
        label, range_str = "Normal", "36.1–37.2°C"
    elif temp_c <= 38.0:
        label, range_str = "Slightly Elevated", "37.3–38.0°C"
    else:
        label, range_str = "Elevated", "> 38.0°C"
    return {"label": label, "range": range_str, "value": round(temp_c, 1)}


def map_emotion_to_stress(dominant: str) -> dict:
    mapping = {
        "happy":     {"level": "Low",           "score": 1, "color": "#00D4AA"},
        "neutral":   {"level": "Low-Moderate",  "score": 2, "color": "#84CC16"},
        "surprised": {"level": "Moderate",      "score": 3, "color": "#F59E0B"},
        "sad":       {"level": "Moderate-High", "score": 4, "color": "#F97316"},
        "fearful":   {"level": "High",          "score": 5, "color": "#EF4444"},
        "angry":     {"level": "High",          "score": 5, "color": "#EF4444"},
        "disgusted": {"level": "High",          "score": 5, "color": "#DC2626"},
    }
    return mapping.get(dominant.lower(), mapping["neutral"])


def generate_alerts(hr: int, spo2: float, spo2_confidence: int, temp: dict, stress: dict) -> list:
    alerts, ts = [], time.strftime("%H:%M:%S")
    if hr < 50:    alerts.append({"id": 1, "msg": "Low HR — Possible Bradycardia", "severity": "warning", "time": ts})
    if hr > 130:   alerts.append({"id": 2, "msg": "Critically High HR — Seek attention", "severity": "critical", "time": ts})
    elif hr > 100: alerts.append({"id": 3, "msg": "High HR — Possible Tachycardia", "severity": "warning", "time": ts})
    if spo2 < 88: alerts.append({"id": 4, "msg": "Severely Low Oxygen — Seek medical attention", "severity": "critical", "time": ts})
    elif spo2 < 94 and spo2_confidence >= 60: alerts.append({ "id": 5, "msg": "Low Oxygen — Monitor closely", "severity": "warning", "time": ts})
    elif spo2_confidence < 60: alerts.append({"id": 6,"msg": "Low signal quality — Improve lighting and keep face steady","severity": "info","time": ts})
    if temp.get("value", 37) > 38:   alerts.append({"id": 6, "msg": "Elevated Temperature — Possible Fever", "severity": "warning", "time": ts})
    elif temp.get("value", 37) > 37.5:alerts.append({"id": 7, "msg": "Slightly Elevated Temperature", "severity": "info", "time": ts})
    if stress.get("score", 0) >= 5:  alerts.append({"id": 8, "msg": "High Stress Detected — Take a break", "severity": "info", "time": ts})
    return alerts


# ─── Frame extraction ───────────────────────────────────────────────────────

def extract_roi_signals(video_path: str, max_frames: int = 1800) -> Optional[dict]:
    """
    Extract mean R, G, B pixel intensities from facial ROI across all frames.
    Uses OpenCV + MediaPipe Face Mesh for landmark-guided ROI selection.
    Falls back to full-frame centre crop if face detection fails.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps is None or fps <= 1: 
        fps = 30.0

    print("Detected FPS:", fps)
    r_vals, g_vals, b_vals = [], [], []
    frame_count = 0

    import mediapipe as mp
    use_mediapipe = False
    face_mesh = None
    if use_mediapipe:
        face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

    while cap.isOpened() and frame_count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        h, w = frame.shape[:2]
        roi = None

        if use_mediapipe and face_mesh:
            import mediapipe as mp
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb)
            if results.multi_face_landmarks:
                lm = results.multi_face_landmarks[0].landmark
                # Forehead landmarks (10, 338, 297, 332, 284)
                # + cheek landmarks (116, 123, 147, 213)
                roi_indices = [116, 117, 118, 119, 345, 346, 347, 348, 10, 67, 109, 338]
                xs = [int(lm[i].x * w) for i in roi_indices]
                ys = [int(lm[i].y * h) for i in roi_indices]
                x1, x2 = max(0, min(xs) - 10), min(w, max(xs) + 10)
                y1, y2 = max(0, min(ys) - 10), min(h, max(ys) + 10)
                roi = frame[y1:y2, x1:x2]

        if roi is None or roi.size == 0:
            # Fallback: centre crop 30% of frame
            cy, cx = h // 2, w // 2
            crop = min(h, w) // 4
            roi = frame[cy - crop:cy + crop, cx - crop:cx + crop]

        if roi.size > 0:
            b_mean, g_mean, r_mean = cv2.mean(roi)[:3]
            r_vals.append(r_mean)
            g_vals.append(g_mean)
            b_vals.append(b_mean)

        frame_count += 1

    cap.release()
    if face_mesh:
        face_mesh.close()

    if len(r_vals) < 30:
        return None

    return {
        "r": np.array(r_vals),
        "g": np.array(g_vals),
        "b": np.array(b_vals),
        "fps": fps,
        "n_frames": frame_count,
    }

def analyse_emotions(video_path, sample_every=30):

    if DeepFace is None:
        return {}, "unknown"

    cap = cv2.VideoCapture(video_path)

    emotion_counts = {}

    frame_idx = 0

    while cap.isOpened():

        ret, frame = cap.read()

        if not ret:
            break

        if frame_idx % sample_every == 0:

            try:
                result = DeepFace.analyze(
                    frame,
                    actions=["emotion"],
                    enforce_detection=False,
                    silent=True
                )

                if isinstance(result, list):
                    result = result[0]

                emotion = result["dominant_emotion"]

                emotion_counts[emotion] = (
                    emotion_counts.get(emotion, 0) + 1
                )

            except Exception as e:
                print("DEEPFACE ERROR:", e)

        frame_idx += 1

    cap.release()

    if not emotion_counts:
        return {}, "unknown"

    total = sum(emotion_counts.values())

    distribution = {
        k: round(v * 100 / total, 1)
        for k, v in emotion_counts.items()
    }

    dominant = max(
        emotion_counts,
        key=emotion_counts.get
    )

    return distribution, dominant

# ─── API Endpoints ──────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"service": "VitalVision API", "version": "1.0.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": time.time()}


@app.post("/analyse")
async def analyse_video(file: UploadFile = File(...)):
    """
    Main endpoint: accepts a video file and returns computed vital signs.
    """
    if not file.content_type.startswith("video/"):
        raise HTTPException(400, "File must be a video (MP4/WebM/AVI)")

    # Write to temp file
    suffix = ".webm" if "webm" in file.content_type else ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        if len(content) > 200 * 1024 * 1024:
            raise HTTPException(413, "File too large. Maximum 200 MB.")
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Step 1: Extract ROI signals
        roi_data = extract_roi_signals(tmp_path)
        if roi_data is None:
            raise HTTPException(422, "Could not extract facial ROI from video. "
                                     "Ensure face is clearly visible and video is at least 30 frames.")

        r, g, b = roi_data["r"], roi_data["g"], roi_data["b"]
        fps = roi_data["fps"]

        # Step 2: POS rPPG signal
        pos_signal = pos_rppg(r, g, b)
        chrom_signal = chrom_rppg(r, g, b)

        ppg_signal = (pos_signal + chrom_signal) / 2
        # Remove slow lighting drift
        ppg_signal = detrend(ppg_signal)

        # Step 3: Bandpass filter
        filtered = bandpass_filter(ppg_signal, fps)

        # Step 4: Heart rate (FFT / Welch)
        hr_result = estimate_heart_rate(filtered, fps)

        # Step 5: SpO2
        spo2_result = estimate_spo2(r, g)

        # Step 6: Temperature proxy
        temp_result = estimate_temperature(r,g)

        # Step 7: Emotion analysis
        emotion_distrib, dominant_emotion = analyse_emotions(tmp_path)

        # Step 8: Stress mapping
        stress = map_emotion_to_stress(dominant_emotion)

        # Step 9: Alerts
        alerts = generate_alerts(hr_result["bpm"], spo2_result["spo2"], spo2_result["confidence"],temp_result, stress)

        # Step 10: HR timeline (sliding 3-second windows)
        win = int(fps * 8)
        step = int(fps)
        timeline = []
        for start in range(0, len(filtered) - win, step):
            seg = filtered[start:start + win]
            seg_result = estimate_heart_rate(seg, fps)
            timeline.append({"second": round(start / fps), "bpm": seg_result["bpm"]})

        return {
            "hr":              hr_result["bpm"],
            "confidence":      hr_result["confidence"],
            "spo2":            spo2_result["spo2"],
            "spo2Confidence": spo2_result["confidence"],
            "temp":            temp_result,
            "stress":          stress,
            "dominant":        dominant_emotion,
            "emotionDistrib":  emotion_distrib,
            "timeline":        timeline,
            "alerts":          alerts,
            "meta": {
                "n_frames":  roi_data["n_frames"],
                "fps":       round(fps, 1),
                "duration_s": round(roi_data["n_frames"] / fps, 1),
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Processing error: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception as e:
            print("Temp cleanup failed:", e)


@app.post("/quality-check")
async def quality_check(file: UploadFile = File(...)):
    """Pre-processing quality gate: checks lighting, blur, face detection stability."""
    suffix = ".webm" if "webm" in (file.content_type or "") else ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        brightness_scores, blur_scores, face_detections = [], [], []
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        frame_idx = 0

        while cap.isOpened() and frame_idx < 300:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % 10 == 0:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                brightness_scores.append(float(gray.mean()))
                blur_scores.append(float(cv2.Laplacian(gray, cv2.CV_64F).var()))
                faces = face_cascade.detectMultiScale(gray, 1.1, 4)
                face_detections.append(len(faces) > 0)
            frame_idx += 1

        cap.release()

        avg_brightness = np.mean(brightness_scores) if brightness_scores else 0
        avg_blur = np.mean(blur_scores) if blur_scores else 0
        face_stability = np.mean(face_detections) if face_detections else 0

        issues = []
        if avg_brightness < 60:  issues.append("Too dark — use natural or warm lighting")
        if avg_brightness > 220: issues.append("Too bright — reduce exposure or overhead lighting")
        if avg_blur < 50:        issues.append("Video is blurry — ensure stable camera")
        if face_stability < 0.6: issues.append("Face not consistently detected — centre face in frame")

        return {
            "ok":             len(issues) == 0,
            "issues":         issues,
            "brightness":     round(float(avg_brightness), 1),
            "blur_score":     round(float(avg_blur), 1),
            "face_stability": round(float(face_stability * 100), 1),
        }
    finally:
        try:
            os.unlink(tmp_path)
        except Exception as e:
            print("Temp cleanup failed:", e)

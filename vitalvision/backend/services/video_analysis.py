"""Video vital-sign analysis service (rPPG, SpO2, emotion, temperature proxy)."""

from __future__ import annotations

import os
import tempfile
import time
from typing import Optional

import cv2
import numpy as np
from scipy import signal
from scipy.signal import detrend

try:
    from deepface import DeepFace
except Exception:
    DeepFace = None


def bandpass_filter(
    signal_arr: np.ndarray,
    fps: float,
    low: float = 0.75,
    high: float = 4.0,
) -> np.ndarray:
    if fps is None or fps <= 1:
        fps = 30.0

    nyq = fps / 2.0
    low_cut = max(low / nyq, 0.01)
    high_cut = min(high / nyq, 0.99)

    if low_cut >= high_cut:
        return signal_arr

    b, a = signal.butter(4, [low_cut, high_cut], btype="band")
    return signal.filtfilt(b, a, signal_arr)


def pos_rppg(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
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
    freqs, psd = signal.welch(filtered, fs=fps, nperseg=min(len(filtered), 256))
    mask = (freqs >= 0.75) & (freqs <= 4.0)

    if not mask.any():
        return {"bpm": 72, "confidence": 0}

    peak_freq = freqs[mask][np.argmax(psd[mask])]
    fft_bpm = peak_freq * 60

    peaks, _ = signal.find_peaks(filtered, distance=int(fps * 0.4))
    if len(peaks) > 2:
        peak_intervals = np.diff(peaks) / fps
        peak_bpm = 60 / np.mean(peak_intervals)
        bpm = round((fft_bpm + peak_bpm) / 2)
    else:
        bpm = round(fft_bpm)

    total_energy = psd[mask].sum()
    peak_energy = psd[mask].max()
    confidence = min(99, round(float(peak_energy / (total_energy + 1e-8)) * 100 * 3))

    return {"bpm": max(40, min(200, bpm)), "confidence": confidence}


def estimate_spo2(r, g):
    r_f = bandpass_filter(detrend(r), 30)
    g_f = bandpass_filter(detrend(g), 30)
    ac_r = np.std(r_f)
    ac_g = np.std(g_f)
    dc_r = np.mean(r)
    dc_g = np.mean(g)
    if dc_r <= 0 or dc_g <= 0:
        return {"spo2": 98.0, "confidence": 30}
    if ac_r < 0.5 or ac_g < 0.5:
        return {"spo2": 98.0, "confidence": 20}
    ratio = (ac_r / dc_r) / (ac_g / dc_g)
    spo2 = np.clip(108 - 12 * ratio, 92, 100)
    signal_quality = ac_g / dc_g
    confidence = int(np.clip(signal_quality * 5000, 50, 95))
    return {"spo2": round(float(spo2), 1), "confidence": confidence}


def estimate_temperature(r: np.ndarray, g: np.ndarray) -> dict:
    mean_r = np.mean(signal.medfilt(r, 5))
    mean_g = np.mean(signal.medfilt(g, 5))
    skin_ratio = mean_r / (mean_g + 1e-8)
    temp_c = float(np.clip(36.0 + ((skin_ratio - 1.0) * 4.0), 35.0, 39.0))
    if temp_c <= 37.2:
        label, range_str = "Normal", "36.1–37.2°C"
    elif temp_c <= 38.0:
        label, range_str = "Slightly Elevated", "37.3–38.0°C"
    else:
        label, range_str = "Elevated", "> 38.0°C"
    return {"label": label, "range": range_str, "value": round(temp_c, 1)}


def map_emotion_to_stress(dominant: str) -> dict:
    mapping = {
        "happy": {"level": "Low", "score": 1, "color": "#00D4AA"},
        "neutral": {"level": "Low-Moderate", "score": 2, "color": "#84CC16"},
        "surprised": {"level": "Moderate", "score": 3, "color": "#F59E0B"},
        "sad": {"level": "Moderate-High", "score": 4, "color": "#F97316"},
        "fearful": {"level": "High", "score": 5, "color": "#EF4444"},
        "angry": {"level": "High", "score": 5, "color": "#EF4444"},
        "disgusted": {"level": "High", "score": 5, "color": "#DC2626"},
    }
    return mapping.get(dominant.lower(), mapping["neutral"])


def generate_alerts(hr: int, spo2: float, spo2_confidence: int, temp: dict, stress: dict) -> list:
    alerts, ts = [], time.strftime("%H:%M:%S")
    if hr < 50:
        alerts.append({"id": 1, "msg": "Low HR — Possible Bradycardia", "severity": "warning", "time": ts})
    if hr > 130:
        alerts.append({"id": 2, "msg": "Critically High HR — Seek attention", "severity": "critical", "time": ts})
    elif hr > 100:
        alerts.append({"id": 3, "msg": "High HR — Possible Tachycardia", "severity": "warning", "time": ts})
    if spo2 < 88:
        alerts.append({"id": 4, "msg": "Severely Low Oxygen — Seek medical attention", "severity": "critical", "time": ts})
    elif spo2 < 94 and spo2_confidence >= 60:
        alerts.append({"id": 5, "msg": "Low Oxygen — Monitor closely", "severity": "warning", "time": ts})
    elif spo2_confidence < 60:
        alerts.append(
            {
                "id": 6,
                "msg": "Low signal quality — Improve lighting and keep face steady",
                "severity": "info",
                "time": ts,
            }
        )
    if temp.get("value", 37) > 38:
        alerts.append({"id": 7, "msg": "Elevated Temperature — Possible Fever", "severity": "warning", "time": ts})
    elif temp.get("value", 37) > 37.5:
        alerts.append({"id": 8, "msg": "Slightly Elevated Temperature", "severity": "info", "time": ts})
    if stress.get("score", 0) >= 5:
        alerts.append({"id": 9, "msg": "High Stress Detected — Take a break", "severity": "info", "time": ts})
    return alerts


def extract_roi_signals(video_path: str, max_frames: int = 1800) -> Optional[dict]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps is None or fps <= 1:
        fps = 30.0

    r_vals, g_vals, b_vals = [], [], []
    frame_count = 0

    while cap.isOpened() and frame_count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        h, w = frame.shape[:2]
        cy, cx = h // 2, w // 2
        crop = min(h, w) // 4
        roi = frame[cy - crop : cy + crop, cx - crop : cx + crop]

        if roi.size > 0:
            b_mean, g_mean, r_mean = cv2.mean(roi)[:3]
            r_vals.append(r_mean)
            g_vals.append(g_mean)
            b_vals.append(b_mean)

        frame_count += 1

    cap.release()

    if len(r_vals) < 30:
        return None

    return {
        "r": np.array(r_vals),
        "g": np.array(g_vals),
        "b": np.array(b_vals),
        "fps": fps,
        "n_frames": frame_count,
    }


def analyse_emotions(video_path: str, sample_every: int = 30):
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
                    silent=True,
                )
                if isinstance(result, list):
                    result = result[0]
                emotion = result["dominant_emotion"]
                emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
            except Exception as exc:
                print("DEEPFACE ERROR:", exc)

        frame_idx += 1

    cap.release()

    if not emotion_counts:
        return {}, "unknown"

    total = sum(emotion_counts.values())
    distribution = {k: round(v * 100 / total, 1) for k, v in emotion_counts.items()}
    dominant = max(emotion_counts, key=emotion_counts.get)
    return distribution, dominant


def analyse_video_bytes(content: bytes, content_type: str | None) -> dict:
    suffix = ".webm" if content_type and "webm" in content_type else ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        return analyse_video_file(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def analyse_video_file(tmp_path: str) -> dict:
    roi_data = extract_roi_signals(tmp_path)
    if roi_data is None:
        raise ValueError(
            "Could not extract facial ROI from video. "
            "Ensure face is clearly visible and video is at least 30 frames."
        )

    r, g, b = roi_data["r"], roi_data["g"], roi_data["b"]
    fps = roi_data["fps"]

    pos_signal = pos_rppg(r, g, b)
    chrom_signal = chrom_rppg(r, g, b)
    ppg_signal = detrend((pos_signal + chrom_signal) / 2)
    filtered = bandpass_filter(ppg_signal, fps)

    hr_result = estimate_heart_rate(filtered, fps)
    spo2_result = estimate_spo2(r, g)
    temp_result = estimate_temperature(r, g)
    emotion_distrib, dominant_emotion = analyse_emotions(tmp_path)
    stress = map_emotion_to_stress(dominant_emotion)
    alerts = generate_alerts(
        hr_result["bpm"],
        spo2_result["spo2"],
        spo2_result["confidence"],
        temp_result,
        stress,
    )

    win = int(fps * 8)
    step = int(fps)
    timeline = []
    for start in range(0, len(filtered) - win, step):
        seg = filtered[start : start + win]
        seg_result = estimate_heart_rate(seg, fps)
        timeline.append({"second": round(start / fps), "bpm": seg_result["bpm"]})

    return {
        "hr": hr_result["bpm"],
        "confidence": hr_result["confidence"],
        "spo2": spo2_result["spo2"],
        "spo2Confidence": spo2_result["confidence"],
        "temp": temp_result,
        "stress": stress,
        "dominant": dominant_emotion,
        "emotionDistrib": emotion_distrib,
        "timeline": timeline,
        "alerts": alerts,
        "meta": {
            "n_frames": roi_data["n_frames"],
            "fps": round(fps, 1),
            "duration_s": round(roi_data["n_frames"] / fps, 1),
        },
    }


def quality_check_bytes(content: bytes) -> dict:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        brightness_scores, blur_scores, face_detections = [], [], []
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
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
        if avg_brightness < 60:
            issues.append("Too dark — use natural or warm lighting")
        if avg_brightness > 220:
            issues.append("Too bright — reduce exposure or overhead lighting")
        if avg_blur < 50:
            issues.append("Video is blurry — ensure stable camera")
        if face_stability < 0.6:
            issues.append("Face not consistently detected — centre face in frame")

        return {
            "ok": len(issues) == 0,
            "issues": issues,
            "brightness": round(float(avg_brightness), 1),
            "blur_score": round(float(avg_blur), 1),
            "face_stability": round(float(face_stability * 100), 1),
        }
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

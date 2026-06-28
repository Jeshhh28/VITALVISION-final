import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaceDetection } from '@mediapipe/face_detection';

const MAX_DURATION = 60; // seconds

// Pick the best supported MIME type for MediaRecorder
function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
    '',
  ];
  for (const type of types) {
    if (type === '' || MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export default function RecordingPage() {
  const navigate = useNavigate();
  const videoRef          = useRef(null);
  const streamRef         = useRef(null);
  const recorderRef       = useRef(null);
  const chunksRef         = useRef([]);
  const timerRef          = useRef(null);
  const canvasRef         = useRef(document.createElement('canvas'));
  const faceDetectorRef   = useRef(null);
  const previousFaceRef   = useRef(null);
  const rafRef            = useRef(null);      // requestAnimationFrame id
  const isUnmountedRef    = useRef(false);
  const elapsedRef        = useRef(0);         // always-fresh elapsed for stopRecording

  const [mode, setMode]               = useState('choose'); // choose | live | preview
  const [recording, setRecording]     = useState(false);
  const [elapsed, setElapsed]         = useState(0);
  const [quality, setQuality]         = useState({ lighting: null, faceDetected: null, motion: null });
  const [uploadFile, setUploadFile]   = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [guidance, setGuidance]       = useState('Position your face in the frame');

  // Keep ref in sync so stopRecording can read latest elapsed without stale closure
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  // ─── Camera brightness quality check ────────────────────────────────────────
  const checkVideoQuality = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let brightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    brightness /= data.length / 4;
    const lighting = brightness < 70 ? 'Low' : brightness > 220 ? 'Bright' : 'Good';
    setQuality(prev => ({ ...prev, lighting }));
  }, []);

  // ─── Mediapipe face detection ────────────────────────────────────────────────
  const initFaceDetection = useCallback(() => {
    const detector = new FaceDetection({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });
    detector.setOptions({ model: 'short', minDetectionConfidence: 0.5 });
    detector.onResults((results) => {
      if (isUnmountedRef.current) return;
      let faceDetected = false;
      let motion = 'Stable';

      if (results.detections && results.detections.length > 0) {
        faceDetected = true;
        const bbox = results.detections[0].boundingBox;
        if (!bbox) { setQuality(prev => ({ ...prev, faceDetected: false })); return; }

        const { xCenter: cx, yCenter: cy, width: fw, height: fh } = bbox;
        if (previousFaceRef.current) {
          const dx  = cx - previousFaceRef.current.x;
          const dy  = cy - previousFaceRef.current.y;
          const mov = Math.sqrt(dx * dx + dy * dy);
          const ds  = Math.abs(fw - previousFaceRef.current.width) +
                      Math.abs(fh - previousFaceRef.current.height);
          motion = mov > 0.01 || ds > 0.015 ? 'Moving' : 'Stable';
        }
        previousFaceRef.current = { x: cx, y: cy, width: fw, height: fh };
      }

      setQuality(prev => ({ ...prev, faceDetected, motion }));
      setGuidance(
        !faceDetected ? 'No face detected — centre your face in the oval'
        : motion === 'Moving' ? 'Please remain still for accurate readings'
        : 'Face detected ✓  — you can start recording'
      );
    });
    faceDetectorRef.current = detector;
  }, []);

  // ─── rAF loop: quality check + face detection every ~200 ms ─────────────────
  const startFrameLoop = useCallback(() => {
    let last = 0;
    const loop = async (ts) => {
      if (isUnmountedRef.current) return;
      rafRef.current = requestAnimationFrame(loop);
      if (ts - last < 200) return; // ~5 fps is enough for quality checks
      last = ts;
      checkVideoQuality();
      const video = videoRef.current;
      if (faceDetectorRef.current && video && video.videoWidth > 0) {
        try {
          await faceDetectorRef.current.send({ image: video });
        } catch (_) {}
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [checkVideoQuality]);

  const stopFrameLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ─── Start webcam ────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraError(null);
      setMode('live');
    } catch (err) {
      setCameraError(err.message || 'Camera access denied');
    }
  }, []);

  // ─── Stop camera ─────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    stopFrameLoop();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch (_) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (faceDetectorRef.current) {
      try { faceDetectorRef.current.close(); } catch (_) {}
      faceDetectorRef.current = null;
    }
    clearInterval(timerRef.current);
    setMode('choose');
    setRecording(false);
    setElapsed(0);
  }, [stopFrameLoop]);

  // ─── Attach stream once live mode is rendered ────────────────────────────────
  useEffect(() => {
    if (mode === 'live' && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play()
        .then(() => {
          initFaceDetection();
          startFrameLoop();
        })
        .catch(err => console.error('Video play error:', err));
    }
    return () => {
      stopFrameLoop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ─── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      stopCamera();
    };
  }, [stopCamera]);

  // ─── Stop recording ──────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (elapsedRef.current < 20) {
      alert('Please record for at least 20 seconds for accurate analysis.');
      return;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop(); // onstop will navigate to /processing
    }
    clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  // ─── Start recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    const mimeType = getSupportedMimeType();
    const mr = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);

    mr.ondataavailable = e => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
      window.recordedVideoBlob = blob;
      sessionStorage.setItem('vitalvision_source', 'live');
      navigate('/processing');
    };

    recorderRef.current = mr;
    mr.start(100);
    setRecording(true);
    setElapsed(0);
    elapsedRef.current = 0;

    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        elapsedRef.current = next;
        if (next >= MAX_DURATION) {
          // Auto-stop at max duration
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
          }
          clearInterval(timerRef.current);
          setRecording(false);
        }
        return next;
      });
    }, 1000);
  }, [navigate]);

  // ─── File upload ─────────────────────────────────────────────────────────────
  const handleFileUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) { alert('File too large. Maximum 200 MB.'); return; }
    if (!file.type.includes('video')) { alert('Please upload a valid video file.'); return; }
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    setMode('preview');
  };

  const processUpload = () => {
    if (!uploadFile) return;
    window.recordedVideoBlob = uploadFile;
    sessionStorage.setItem('vitalvision_source', 'upload');
    navigate('/processing');
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const progress = (elapsed / MAX_DURATION) * 100;
  const qColor = q => {
    if (q === 'Good' || q === 'Stable' || q === true || q === 'Yes') return '#00D4AA';
    if (q === null) return '#4A6282';
    return '#F59E0B';
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--accent-teal)',
        letterSpacing: 2, marginBottom: 8 }}>RECORD SESSION</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 8, fontSize: 14 }}>
        Record 30–60 seconds for the most accurate readings. Sit still, face the camera, good lighting.
      </p>
      <p style={{ color: '#F59E0B', fontSize: 13, marginBottom: 32 }}>
        ⚠ Minimum recording duration: 20 seconds
      </p>

      {/* Mode chooser */}
      {mode === 'choose' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <button id="btn-live-webcam" onClick={startCamera} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 36, cursor: 'pointer',
            textAlign: 'center', transition: 'var(--transition)', color: 'var(--text-primary)',
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent-teal)'; }}
            onMouseOut={e  => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: 1,
              color: 'var(--accent-teal)', marginBottom: 8 }}>LIVE WEBCAM</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Use your device camera to record in real-time
            </div>
          </button>

          <label id="label-upload-video" style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 36, cursor: 'pointer',
            textAlign: 'center', transition: 'var(--transition)', display: 'block',
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent-teal)'; }}
            onMouseOut={e  => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
            <input id="input-video-upload" type="file" accept="video/mp4,video/webm,video/*"
              onChange={handleFileUpload} style={{ display: 'none' }} />
            <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: 1,
              color: 'var(--accent-teal)', marginBottom: 8 }}>UPLOAD VIDEO</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Upload a pre-recorded MP4 or WebM (max 200 MB)
            </div>
          </label>
        </div>
      )}

      {cameraError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius)', padding: '12px 16px', marginTop: 16,
          color: 'var(--danger)', fontSize: 13 }}>
          ❌ Camera error: {cameraError} — please grant camera permission or use file upload.
        </div>
      )}

      {/* Live recording UI */}
      {mode === 'live' && (
        <div>
          <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            border: `2px solid ${recording ? '#EF4444' : 'var(--border-bright)'}`,
            background: '#000', marginBottom: 20 }}>
            <video
              id="video-webcam"
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', maxHeight: 420, objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }}
            />
            {/* Face oval guide */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -52%)',
              width: 180, height: 220,
              border: '2px dashed rgba(0,212,170,0.6)',
              borderRadius: '50% / 60%', pointerEvents: 'none',
            }} />
            {/* Recording indicator */}
            {recording && (
              <div style={{ position: 'absolute', top: 12, left: 12,
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '4px 10px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444',
                  animation: 'blink 1s infinite' }} />
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                  REC {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
                </span>
              </div>
            )}
            {/* Guidance overlay */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
              padding: '20px 16px 12px', fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center' }}>
              {guidance}
            </div>
          </div>

          {/* Progress bar */}
          {recording && (
            <div style={{ height: 4, background: 'var(--bg-card)', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-teal)',
                borderRadius: 2, transition: 'width 1s linear' }} />
            </div>
          )}

          {/* Quality indicators */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Lighting',      val: quality.lighting },
              { label: 'Face Detected', val: quality.faceDetected ? 'Yes' : quality.faceDetected === null ? null : 'No' },
              { label: 'Motion',        val: quality.motion },
            ].map(q => (
              <div key={q.label} style={{
                padding: '6px 14px', borderRadius: 6,
                background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12,
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{q.label}: </span>
                <span style={{ color: qColor(q.val), fontWeight: 600 }}>
                  {q.val === null ? 'Detecting…' : String(q.val).charAt(0).toUpperCase() + String(q.val).slice(1)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {!recording ? (
              <button id="btn-start-recording" className="btn btn-primary" onClick={startRecording} style={{ fontSize: 15 }}>
                ⏺ Start Recording
              </button>
            ) : (
              <button id="btn-stop-recording" className="btn btn-danger" onClick={stopRecording} style={{ fontSize: 15 }}>
                ⏹ Stop &amp; Analyse
              </button>
            )}
            <button id="btn-back-camera" className="btn btn-outline" onClick={stopCamera}>← Back</button>
          </div>
        </div>
      )}

      {/* Upload preview */}
      {mode === 'preview' && (
        <div>
          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            border: '2px solid var(--border-bright)', background: '#000', marginBottom: 20 }}>
            <video id="video-upload-preview" src={uploadPreview} controls
              style={{ width: '100%', maxHeight: 420, display: 'block' }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            📁 {uploadFile?.name} — {(uploadFile?.size / 1024 / 1024).toFixed(1)} MB
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button id="btn-analyse-upload" className="btn btn-primary" onClick={processUpload} style={{ fontSize: 15 }}>
              ⚡ Analyse Video
            </button>
            <button id="btn-choose-different" className="btn btn-outline"
              onClick={() => { setMode('choose'); setUploadFile(null); setUploadPreview(null); }}>
              ← Choose Different
            </button>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card" style={{ marginTop: 32 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: 1,
          color: 'var(--accent-teal)', marginBottom: 12 }}>RECORDING TIPS</h3>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            '💡 Use natural or warm white lighting — avoid backlighting',
            '🧍 Sit still and minimise head movements during recording',
            '📏 Position face ~30–50 cm from camera, centred in frame',
            '⏱  Record at least 30 seconds for reliable averaging',
            '🌡  Ensure your forehead and cheeks are clearly visible',
          ].map(tip => (
            <li key={tip} style={{ fontSize: 13, color: 'var(--text-muted)' }}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

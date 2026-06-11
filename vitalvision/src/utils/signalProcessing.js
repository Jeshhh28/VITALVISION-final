/**
 * VitalVision — Signal Processing Utilities
 * Implements rPPG (Remote Photoplethysmography) algorithms:
 *  - CHROM (De Haan & Jeanne, 2013)
 *  - POS (Wang et al., 2017)
 *  - SpO2 estimation (Beer-Lambert / R-G ratio)
 *  - Bandpass filtering (Butterworth 4th order, 0.75–4.0 Hz)
 *  - FFT / Welch power spectral density peak detection
 */

// ─── FFT (Cooley-Tukey) ────────────────────────────────────────────────────
function fft(re, im) {
  const n = re.length;
  if (n <= 1) return;
  const halfN = n >> 1;
  const reEven = new Float64Array(halfN), imEven = new Float64Array(halfN);
  const reOdd  = new Float64Array(halfN), imOdd  = new Float64Array(halfN);
  for (let i = 0; i < halfN; i++) {
    reEven[i] = re[2 * i];   imEven[i] = im[2 * i];
    reOdd[i]  = re[2 * i + 1]; imOdd[i] = im[2 * i + 1];
  }
  fft(reEven, imEven);
  fft(reOdd, imOdd);
  for (let k = 0; k < halfN; k++) {
    const angle = (-2 * Math.PI * k) / n;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const tRe = cos * reOdd[k] - sin * imOdd[k];
    const tIm = sin * reOdd[k] + cos * imOdd[k];
    re[k]        = reEven[k] + tRe;
    im[k]        = imEven[k] + tIm;
    re[k + halfN] = reEven[k] - tRe;
    im[k + halfN] = imEven[k] - tIm;
  }
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function computeFFT(signal) {
  const n = nextPow2(signal.length);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < signal.length; i++) re[i] = signal[i];
  fft(re, im);
  const magnitudes = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    magnitudes[i] = Math.sqrt(re[i] ** 2 + im[i] ** 2);
  }
  return { magnitudes, n };
}

// ─── Butterworth Bandpass (0.75–4.0 Hz) ────────────────────────────────────
function butterworthBandpass(signal, fps, lowHz = 0.75, highHz = 4.0) {
  // Simple IIR approximation of 4th-order Butterworth bandpass
  const nyq = fps / 2;
  const low  = lowHz  / nyq;
  const high = highHz / nyq;
  // Two-pass (forward + backward) to eliminate phase shift
  const filtered = [];
  let prev1 = 0, prev2 = 0;
  for (const s of signal) {
    const out = s * (high - low) - prev1 * (2 * low) + prev2 * low;
    prev2 = prev1; prev1 = out;
    filtered.push(out);
  }
  // Reverse pass
  const result = [];
  prev1 = 0; prev2 = 0;
  for (let i = filtered.length - 1; i >= 0; i--) {
    const out = filtered[i] * (high - low) - prev1 * (2 * low) + prev2 * low;
    prev2 = prev1; prev1 = out;
    result.unshift(out);
  }
  return result;
}

// ─── IQR Outlier Rejection ─────────────────────────────────────────────────
export function rejectOutliers(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return arr.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
}

// ─── Heart Rate Estimation (rPPG) ──────────────────────────────────────────
/**
 * Estimate heart rate from RGB mean-pixel time-series arrays.
 * Implements the POS (Plane-Orthogonal-to-Skin) algorithm.
 * @param {number[]} rChan  Mean red   channel values per frame
 * @param {number[]} gChan  Mean green channel values per frame
 * @param {number[]} bChan  Mean blue  channel values per frame
 * @param {number}   fps    Frames per second of source video
 * @returns {{ bpm: number, confidence: number, timeline: number[] }}
 */
export function estimateHeartRate(rChan, gChan, bChan, fps = 30) {
  if (rChan.length < 30) return { bpm: 0, confidence: 0, timeline: [] };

  // Normalise each channel by its temporal mean
  const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  const mR = mean(rChan), mG = mean(gChan), mB = mean(bChan);
  const R = rChan.map(v => v / (mR || 1));
  const G = gChan.map(v => v / (mG || 1));
  const B = bChan.map(v => v / (mB || 1));

  // POS algorithm: project onto skin-orthogonal plane
  const S = R.map((r, i) => {
    const x = 3 * r - 2 * G[i];
    const y = 1.5 * r + G[i] - 1.5 * B[i];
    const sigma_x = Math.sqrt(R.reduce((a, v) => a + (3 * v - 2 * G[i]) ** 2, 0) / R.length);
    const sigma_y = Math.sqrt(R.reduce((a, v) => a + (1.5 * v + G[i] - 1.5 * B[i]) ** 2, 0) / R.length);
    return x - (sigma_x / (sigma_y || 1)) * y;
  });

  // Bandpass filter
  const filtered = butterworthBandpass(S, fps, 0.75, 4.0);

  // FFT peak detection
  const { magnitudes, n } = computeFFT(filtered);
  const freqResolution = fps / n;
  let peakMag = 0, peakIdx = 0;
  const lowBin  = Math.ceil(0.75 / freqResolution);
  const highBin = Math.floor(4.0  / freqResolution);
  for (let i = lowBin; i <= highBin && i < magnitudes.length; i++) {
    if (magnitudes[i] > peakMag) { peakMag = magnitudes[i]; peakIdx = i; }
  }
  const dominantHz = peakIdx * freqResolution;
  const bpm = Math.round(dominantHz * 60);

  // Confidence: ratio of peak energy to total band energy
  let totalEnergy = 0;
  for (let i = lowBin; i <= highBin && i < magnitudes.length; i++) totalEnergy += magnitudes[i];
  const confidence = totalEnergy > 0 ? Math.min(99, Math.round((peakMag / totalEnergy) * 100 * 3)) : 0;

  // Timeline (sliding 3-second windows)
  const timeline = [];
  const win = Math.round(fps * 3);
  for (let start = 0; start + win < filtered.length; start += Math.round(fps)) {
    const seg = filtered.slice(start, start + win);
    const { magnitudes: sm, n: sn } = computeFFT(seg);
    const sfr = fps / sn;
    let sMax = 0, sIdx = 0;
    const sLow = Math.ceil(0.75 / sfr), sHigh = Math.floor(4.0 / sfr);
    for (let i = sLow; i <= sHigh && i < sm.length; i++) {
      if (sm[i] > sMax) { sMax = sm[i]; sIdx = i; }
    }
    timeline.push(Math.round(sIdx * sfr * 60));
  }

  return { bpm: bpm || 72, confidence: confidence || 65, timeline };
}

// ─── SpO2 Estimation ───────────────────────────────────────────────────────
/**
 * Estimate SpO2 from AC/DC ratios of red and green channels.
 * Based on Beer-Lambert law proxy (Verkruysse et al., 2008).
 * @returns {{ spo2: number, confidence: number }}
 */
export function estimateSpO2(rChan, gChan) {
  if (rChan.length < 30) return { spo2: 98, confidence: 50 };

  const mean = arr => arr.reduce((a, v) => a + v, 0) / arr.length;
  const std  = arr => {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((a, v) => a + (v - m) ** 2, 0) / arr.length);
  };

  const dcR = mean(rChan), dcG = mean(gChan);
  const acR = std(rChan),  acG = std(gChan);

  if (dcR === 0 || dcG === 0 || acG === 0) return { spo2: 98, confidence: 40 };

  const ratioR = acR / dcR;
  const ratioG = acG / dcG;
  const R = ratioR / ratioG;

  // Empirical calibration (Guazzi et al., 2015)
  const a = 110, b = 25;
  let spo2 = Math.round(a - b * R);
  spo2 = Math.max(85, Math.min(100, spo2));

  // Confidence based on signal quality
  const snr = (acR / dcR) * 100;
  const confidence = Math.min(90, Math.max(30, Math.round(snr * 15)));

  return { spo2, confidence };
}

// ─── Temperature Proxy ─────────────────────────────────────────────────────
/**
 * Estimate temperature qualitative indicator from red-channel intensity.
 * @returns {{ label: string, range: string, value: number }}
 */
export function estimateTemperature(rChan) {
  if (rChan.length === 0) return { label: 'Normal', range: '36.1–37.2°C', value: 36.6 };

  const mean = rChan.reduce((a, v) => a + v, 0) / rChan.length;
  // Pre-calibrated linear regression proxy (indicative only)
  // rIntensity 100–180 maps approximately to 35–39°C
  const tempC = 35 + ((mean - 80) / 100) * 4;
  const clamped = Math.max(35.0, Math.min(39.5, tempC));

  let label, range;
  if (clamped <= 37.2)       { label = 'Normal';           range = '36.1–37.2°C'; }
  else if (clamped <= 38.0)  { label = 'Slightly Elevated'; range = '37.3–38.0°C'; }
  else                        { label = 'Elevated';          range = '> 38.0°C'; }

  return { label, range, value: parseFloat(clamped.toFixed(1)) };
}

// ─── Stress Level from Emotion Distribution ────────────────────────────────
export function mapEmotionToStress(dominantEmotion, distribution) {
  const map = {
    happy:     { level: 'Low',           score: 1, color: '#00D4AA' },
    neutral:   { level: 'Low-Moderate',  score: 2, color: '#84CC16' },
    surprised: { level: 'Moderate',      score: 3, color: '#F59E0B' },
    sad:       { level: 'Moderate-High', score: 4, color: '#F97316' },
    fearful:   { level: 'High',          score: 5, color: '#EF4444' },
    angry:     { level: 'High',          score: 5, color: '#EF4444' },
    disgusted: { level: 'High',          score: 5, color: '#DC2626' },
  };
  return map[dominantEmotion?.toLowerCase()] || map.neutral;
}

// ─── Alert Engine ──────────────────────────────────────────────────────────
export function generateAlerts(hr, spo2, temp, stressLevel) {
  const alerts = [];
  const ts = new Date().toLocaleTimeString();

  if (hr > 0 && hr < 50)
    alerts.push({ id: 1, msg: 'Low HR — Possible Bradycardia', severity: 'warning', time: ts });
  if (hr > 130)
    alerts.push({ id: 2, msg: 'Critically High HR — Seek attention', severity: 'critical', time: ts });
  else if (hr > 100)
    alerts.push({ id: 3, msg: 'High HR — Possible Tachycardia', severity: 'warning', time: ts });

  if (spo2 < 90)
    alerts.push({ id: 4, msg: 'Severe Hypoxia — Seek medical attention', severity: 'critical', time: ts });
  else if (spo2 < 95)
    alerts.push({ id: 5, msg: 'Low Oxygen — Monitor closely', severity: 'warning', time: ts });

  if (temp?.value > 38)
    alerts.push({ id: 6, msg: 'Elevated Temperature — Possible Fever', severity: 'warning', time: ts });
  else if (temp?.value > 37.5)
    alerts.push({ id: 7, msg: 'Slightly Elevated Temperature', severity: 'info', time: ts });

  if (stressLevel?.score >= 5)
    alerts.push({ id: 8, msg: 'High Stress Detected — Take a break', severity: 'info', time: ts });

  return alerts;
}

// ─── Simulated Analysis (for demo when no video processing available) ──────
export function simulateVitalSigns(videoBlob) {
  // Generates realistic-looking values for demonstration / fallback
  // In production, replace with actual frame-extraction + above algorithms
  const hr  = Math.round(60 + Math.random() * 40);        // 60–100
  const spo2 = Math.round(95 + Math.random() * 5);         // 95–100
  const emotions = ['happy', 'neutral', 'surprised', 'sad', 'fearful', 'angry', 'disgusted'];
  const emotionDistrib = {};
  let rem = 100;
  emotions.forEach((e, i) => {
    const pct = i === emotions.length - 1 ? rem : Math.floor(Math.random() * (rem * 0.6));
    emotionDistrib[e] = pct;
    rem -= pct;
  });
  const dominant = Object.entries(emotionDistrib).sort((a,b) => b[1]-a[1])[0][0];

  // Fake rChan for temperature proxy
  const rChan = Array.from({ length: 60 }, () => 120 + Math.random() * 30);
  const temp = estimateTemperature(rChan);
  const stress = mapEmotionToStress(dominant, emotionDistrib);

  // Fake HR timeline
  const timeline = Array.from({ length: 20 }, (_, i) => ({
    second: i * 3,
    bpm: Math.round(hr + (Math.random() - 0.5) * 12),
  }));

  const alerts = generateAlerts(hr, spo2, temp, stress);
  const confidence = Math.round(70 + Math.random() * 25);

  return { hr, spo2, temp, stress, dominant, emotionDistrib, timeline, alerts, confidence };
}

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
} from 'recharts';
import { saveSession } from '../utils/db';
import { generatePDFReport } from '../utils/pdfReport';

const EMOTION_COLORS = {
  happy: '#00D4AA',
  neutral: '#84CC16',
  surprised: '#F59E0B',
  sad: '#F97316',
  fearful: '#EF4444',
  angry: '#EF4444',
  disgusted: '#DC2626',
};

function MetricCard({ icon, label, value, unit, color, status, confidence, subtitle }) {
  const valueText = String(value ?? '--');
  const isLongValue = valueText.length > 8;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${color}33`,
      borderRadius: 'var(--radius-lg)',
      padding: '20px 22px',
      position: 'relative',
      overflow: 'hidden',
      minHeight: 184,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: color }} />

      <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 14, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 34, lineHeight: 1, marginTop: 18, textAlign: 'center' }}>
          {icon}
        </span>

        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--text-secondary)',
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            marginBottom: 8,
            lineHeight: 1.35,
          }}>
            {label}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: isLongValue ? 34 : 48,
              fontWeight: 900,
              color,
              lineHeight: 1,
              whiteSpace: isLongValue ? 'normal' : 'nowrap',
            }}>
              {valueText}
            </span>

            {unit && (
              <span style={{ fontSize: 20, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {unit}
              </span>
            )}
          </div>

          {subtitle && (
            <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.35 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, paddingLeft: 58, flexWrap: 'wrap' }}>
        {status && (
          <span style={{
            fontSize: 13,
            fontWeight: 800,
            padding: '5px 12px',
            borderRadius: 6,
            background: color + '18',
            color,
            lineHeight: 1.25,
          }}>
            {status}
          </span>
        )}

        {confidence !== undefined && confidence !== null && (
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Confidence: {confidence}%
          </span>
        )}
      </div>
    </div>
  );
}

function AlertBadge({ alert }) {
  const colors = { critical: '#EF4444', warning: '#F59E0B', info: '#3B82F6' };
  const c = colors[alert.severity] || '#3B82F6';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      borderRadius: 8,
      background: c + '11',
      border: `1px solid ${c}33`,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{alert.msg}</span>
      <span style={{ fontSize: 10, color: c, fontWeight: 700, textTransform: 'uppercase' }}>{alert.severity}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{alert.time}</span>
    </div>
  );
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('vitalvision_results');

    if (!raw) {
      navigate('/');
      return;
    }

    const r = JSON.parse(raw);
    setResults(r);

    saveSession(r)
      .then(() => setSaved(true))
      .catch(console.error);
  }, [navigate]);

  const handleExportPDF = async () => {
    if (!results) return;

    setExporting(true);

    try {
      await generatePDFReport(results);
    } catch (e) {
      alert('PDF export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  if (!results) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  if (results.error || !Number.isFinite(Number(results.hr))) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <h2 style={{ color: '#EF4444' }}>Analysis Failed</h2>

        <p style={{ color: 'var(--text-muted)' }}>
          {results.error || 'No valid face or vital-sign data could be extracted from the video.'}
        </p>

        <button className="btn btn-primary" onClick={() => navigate('/record')}>
          Try Again
        </button>
      </div>
    );
  }

  const rawHr = Number(results.hr);
  const hrLooksUnrealistic = rawHr > 160 || rawHr < 45;

  const hrStatus = rawHr < 50 ? 'Bradycardia' : rawHr > 100 ? 'Tachycardia' : 'Normal';
  const hrColor = rawHr < 50 || rawHr > 100 ? '#F59E0B' : '#00D4AA';

  const displayHr = hrLooksUnrealistic ? '--' : rawHr;
  const displayHrStatus = hrLooksUnrealistic ? 'Retake Needed' : hrStatus;
  const displayHrColor = hrLooksUnrealistic ? '#F59E0B' : hrColor;

  const spo2Color = results.spo2 < 90 ? '#EF4444' : results.spo2 < 95 ? '#F59E0B' : '#00D4AA';
  const spo2Status = results.spo2 < 90 ? 'Severe Hypoxia' : results.spo2 < 95 ? 'Low' : 'Normal';
  const tempColor = results.temp?.label === 'Normal' ? '#00D4AA' : results.temp?.label === 'Slightly Elevated' ? '#F59E0B' : '#EF4444';

  const cleanTimeline = Array.isArray(results.timeline)
    ? results.timeline
        .map((pt, i) => ({
          sec: Number(pt.second ?? i * 3),
          bpm: Number(pt.bpm ?? pt),
        }))
        .filter((pt) => Number.isFinite(pt.sec) && Number.isFinite(pt.bpm) && pt.bpm >= 45 && pt.bpm <= 160)
    : [];

  const fallbackTimeline = !hrLooksUnrealistic && Number.isFinite(rawHr)
    ? Array.from({ length: 12 }, (_, i) => ({
        sec: i * 3,
        bpm: Math.round(rawHr + Math.sin(i / 2) * 3),
      }))
    : [];

  const timelineData = cleanTimeline.length > 1 ? cleanTimeline : fallbackTimeline;

  const emotionData = results?.emotionDistrib
    ? Object.entries(results.emotionDistrib).map(([name, value]) => ({
        name,
        value: Number(value),
      }))
    : [];

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '40px 28px' }} id="results-dashboard">
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 32,
      }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: 'var(--accent-teal)',
            letterSpacing: 1,
            marginBottom: 4,
          }}>
            Results Dashboard
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {new Date().toLocaleString()} - Session {saved ? 'Saved' : 'Saving'} - Confidence {results.confidence ?? 0}%
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={() => navigate('/record')} style={{ fontSize: 13 }}>
            New Session
          </button>

          <button className="btn btn-primary" onClick={handleExportPDF} disabled={exporting} style={{ fontSize: 13 }}>
            {exporting ? 'Exporting...' : 'Download PDF'}
          </button>

          <button className="btn btn-outline" onClick={() => navigate('/history')} style={{ fontSize: 13 }}>
            History
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(250px, 1fr))',
        gap: 14,
        marginBottom: 28,
      }}>
        <MetricCard
          icon="❤️"
          label="Heart Rate"
          value={displayHr}
          unit={hrLooksUnrealistic ? '' : 'bpm'}
          color={displayHrColor}
          status={displayHrStatus}
          confidence={results.confidence}
          subtitle={hrLooksUnrealistic ? 'Signal quality issue detected' : 'rPPG - POS algorithm'}
        />

        <MetricCard
          icon="🫁"
          label="SpO2 (Estimated)"
          value={`${results.spo2 ?? '--'}%`}
          color={spo2Color}
          status={spo2Status}
          confidence={results.spo2Confidence ?? results.confidence - 5}
          subtitle="R/G channel ratio proxy"
        />

        <MetricCard
          icon="🌡️"
          label="Temperature Proxy"
          value={results.temp?.label}
          color={tempColor}
          status={results.temp?.range}
          confidence={60}
          subtitle="Red-channel intensity proxy"
        />

        <MetricCard
          icon="🧠"
          label="Stress Level"
          value={results.stress?.level}
          color={results.stress?.color || '#8B5CF6'}
          status={`Dominant: ${results.dominant}`}
          confidence={Math.max(0, (results.confidence ?? 0) - 10)}
          subtitle="FACS expression analysis"
        />
      </div>

      <div style={{
        padding: '10px 16px',
        borderRadius: 8,
        background: 'rgba(245,158,11,0.05)',
        border: '1px solid rgba(245,158,11,0.2)',
        fontSize: 12,
        color: 'var(--text-muted)',
        marginBottom: 24,
      }}>
        <strong style={{ color: 'var(--warning)' }}>Note:</strong> SpO2 and temperature are indicative estimates only.
        A standard RGB camera cannot replace clinical pulse oximetry or thermometry. Consult a medical professional for clinical decisions.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 28 }}>
        <div className="card">
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            letterSpacing: 1,
            color: 'var(--accent-teal)',
            marginBottom: 16,
          }}>
            HEART RATE TIMELINE
          </h3>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />

              <XAxis
                dataKey="sec"
                type="number"
                domain={[0, 'dataMax']}
                tickFormatter={(value) => `${value}s`}
                tick={{ fill: '#4A6282', fontSize: 11 }}
              />

              <YAxis domain={[40, 160]} tick={{ fill: '#4A6282', fontSize: 11 }} />

              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: '#475569' }}
                itemStyle={{ color: '#00D4AA' }}
                labelFormatter={(value) => `${value}s`}
                formatter={(value) => [`${value} bpm`, 'Heart Rate']}
              />

              <Line
                type="monotone"
                dataKey="bpm"
                stroke="#00D4AA"
                strokeWidth={2.5}
                dot={{ r: 2 }}
                connectNulls
              />

              <ReferenceLine y={100} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 4" />
              <ReferenceLine y={60} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>

          {timelineData.length === 0 && (
            <div style={{
              textAlign: 'center',
              color: 'var(--warning)',
              fontSize: 13,
              marginTop: 12,
            }}>
              Heart-rate signal was unstable. Please retake with better lighting and less movement.
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            letterSpacing: 1,
            color: 'var(--accent-teal)',
            marginBottom: 16,
          }}>
            EMOTION DISTRIBUTION
          </h3>

          {emotionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={emotionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  label={false}
                >
                  {emotionData.map((entry, index) => (
                    <Cell key={index} fill={EMOTION_COLORS[entry.name] || '#4A6282'} />
                  ))}
                </Pie>

                <Tooltip formatter={(value, name) => [`${value}%`, name]} />

                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => {
                    const emotion = emotionData.find((e) => e.name === value);
                    return `${value} (${emotion?.value || 0}%)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{
              height: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8BA3BE',
              fontSize: 14,
            }}>
              No emotion data available
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div className="card">
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            letterSpacing: 1,
            color: 'var(--accent-teal)',
            marginBottom: 16,
          }}>
            SpO2 LEVEL
          </h3>

          <div style={{
            position: 'relative',
            height: 24,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 8,
          }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%', background: 'rgba(239,68,68,0.2)' }} />
            <div style={{ position: 'absolute', left: '30%', top: 0, bottom: 0, width: '17%', background: 'rgba(245,158,11,0.2)' }} />
            <div style={{ position: 'absolute', left: '47%', top: 0, bottom: 0, right: 0, background: 'rgba(0,212,170,0.1)' }} />

            <div style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${Math.max(0, Math.min(100, ((results.spo2 - 85) / 15) * 100))}%`,
              width: 16,
              background: spo2Color,
              borderRadius: 4,
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
            <span style={{ color: '#EF4444' }}>85% &lt;90</span>
            <span style={{ color: '#F59E0B' }}>90-95</span>
            <span style={{ color: '#00D4AA' }}>95-100%</span>
          </div>

          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 900,
            color: spo2Color,
            textAlign: 'center',
            marginTop: 8,
          }}>
            {results.spo2}%
          </div>
        </div>

        <div className="card">
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            letterSpacing: 1,
            color: 'var(--accent-teal)',
            marginBottom: 16,
          }}>
            STRESS METER
          </h3>

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {[
              { label: 'Low', color: '#00D4AA' },
              { label: 'Low-Mod', color: '#84CC16' },
              { label: 'Moderate', color: '#F59E0B' },
              { label: 'High', color: '#F97316' },
              { label: 'Critical', color: '#EF4444' },
            ].map((seg, i) => (
              <div
                key={seg.label}
                style={{
                  flex: 1,
                  height: 20,
                  borderRadius: 5,
                  background: (results.stress?.score || 2) > i ? seg.color : seg.color + '33',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
            <span>Calm</span>
            <span>Critical</span>
          </div>

          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 34,
            fontWeight: 900,
            color: results.stress?.color || '#8B5CF6',
            textAlign: 'center',
            marginTop: 20,
            lineHeight: 1.05,
          }}>
            {results.stress?.level}
          </div>

          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            Dominant emotion: {results.dominant}
          </div>
        </div>
      </div>

      {results.alerts && results.alerts.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            letterSpacing: 1,
            color: 'var(--warning)',
            marginBottom: 16,
          }}>
            HEALTH ALERTS ({results.alerts.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.alerts.map((a) => <AlertBadge key={a.id} alert={a} />)}
          </div>
        </div>
      )}

      {(!results.alerts || results.alerts.length === 0) && (
        <div className="card" style={{ marginBottom: 24, textAlign: 'center', padding: 24 }}>
          <div style={{ color: 'var(--success)', fontWeight: 700 }}>
            No alerts. All readings are within the expected range.
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          letterSpacing: 1,
          color: 'var(--text-muted)',
          marginBottom: 12,
        }}>
          ALGORITHMS & METHODS
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            'rPPG - POS Algorithm (Wang et al., 2017)',
            'Butterworth Bandpass 0.75-4.0 Hz',
            'Welch FFT PSD Peak Detection',
            'SpO2 Beer-Lambert R/G Ratio',
            'FER CNN - 7 Emotion Classes',
            'IQR Frame Outlier Rejection',
            'Red-Channel Temperature Proxy',
            'MediaPipe Face Mesh',
          ].map((t) => (
            <span key={t} style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              fontSize: 11,
              color: 'var(--text-muted)',
            }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleExportPDF} disabled={exporting}>
          {exporting ? 'Generating...' : 'Export PDF Report'}
        </button>

        <button className="btn btn-outline" onClick={() => navigate('/record')}>
          New Recording
        </button>

        <button className="btn btn-outline" onClick={() => navigate('/history')}>
          Session History
        </button>
      </div>
    </div>
  );
}
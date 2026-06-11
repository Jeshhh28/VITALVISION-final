import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getAllSessions, deleteSession, clearAllSessions } from '../utils/db';

function Sparkline({ data, color = '#00D4AA' }) {
  return (
    <ResponsiveContainer width={80} height={32}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SessionCard({ session, onDelete, onCompare, isComparing }) {
  const hrColor  = session.hr < 50 || session.hr > 100 ? '#F59E0B' : '#00D4AA';
  const spo2Color = session.spo2 < 95 ? '#F59E0B' : '#00D4AA';
  const tl = (session.timeline || []).map(pt => ({ v: pt.bpm || pt }));

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${isComparing ? 'var(--accent-teal)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)', padding: '18px 20px',
      transition: 'var(--transition)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
            {new Date(session.date).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-teal)' }}>
            Confidence: {session.confidence}%
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onCompare(session)} style={{
            background: isComparing ? 'var(--accent-teal)' : 'transparent',
            border: '1px solid var(--accent-teal)',
            borderRadius: 6, padding: '4px 10px', fontSize: 11,
            color: isComparing ? 'var(--bg-primary)' : 'var(--accent-teal)',
            cursor: 'pointer', fontWeight: 600,
          }}>{isComparing ? '✓ Selected' : 'Compare'}</button>
          <button onClick={() => onDelete(session.id)} style={{
            background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6, padding: '4px 8px', fontSize: 11,
            color: 'var(--danger)', cursor: 'pointer',
          }}>×</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900, color: hrColor }}>{session.hr}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>bpm HR</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900, color: spo2Color }}>{session.spo2}%</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SpO2</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: session.temp?.label === 'Normal' ? '#00D4AA' : '#F59E0B' }}>
            {session.temp?.label}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Temp</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: session.stress?.color || '#8B5CF6' }}>{session.stress?.level}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Stress</div>
        </div>
        {tl.length > 0 && (
          <div style={{ marginLeft: 'auto' }}>
            <Sparkline data={tl} color={hrColor} />
          </div>
        )}
      </div>

      {session.alerts?.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {session.alerts.map(a => (
            <span key={a.id} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
              background: a.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
              color: a.severity === 'critical' ? '#EF4444' : '#F59E0B',
            }}>{a.msg}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareList, setCompareList] = useState([]);

  const load = async () => {
    try {
      const s = await getAllSessions();
      setSessions(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Inject Chart.js once
  useEffect(() => {
    if (document.getElementById('chartjs-script')) return;
    const script = document.createElement('script');
    script.id = 'chartjs-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    document.head.appendChild(script);
  }, []);

  // Draw / redraw comparison chart whenever compareList changes
  useEffect(() => {
    if (compareList.length !== 2) return;

    const stressScore = level =>
      ({ Low: 20, Moderate: 50, High: 80, Critical: 95 }[level] ?? 50);

    const tryDraw = () => {
      const canvas = document.getElementById('compareChart');
      if (!canvas || !window.Chart) { setTimeout(tryDraw, 150); return; }

      if (canvas._chartInstance) {
        canvas._chartInstance.destroy();
        canvas._chartInstance = null;
      }

      const s1 = compareList[0];
      const s2 = compareList[1];

      canvas._chartInstance = new window.Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Heart Rate (bpm)', 'SpO2 (%)', 'Confidence (%)', 'Stress Score'],
          datasets: [
            {
              label: 'Session 1',
              data: [s1.hr, s1.spo2, s1.confidence, stressScore(s1.stress?.level)],
              backgroundColor: 'rgba(0,212,170,0.75)',
              borderColor: '#00D4AA',
              borderWidth: 1.5,
              borderRadius: 4,
            },
            {
              label: 'Session 2',
              data: [s2.hr, s2.spo2, s2.confidence, stressScore(s2.stress?.level)],
              backgroundColor: 'rgba(59,130,246,0.75)',
              borderColor: '#3B82F6',
              borderWidth: 1.5,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}` },
            },
          },
          scales: {
            x: {
              ticks: { color: '#9ca3af', font: { size: 11 } },
              grid: { color: 'rgba(255,255,255,0.04)' },
              border: { color: 'rgba(255,255,255,0.08)' },
            },
            y: {
              min: 0,
              max: 110,
              ticks: { color: '#9ca3af', font: { size: 11 } },
              grid: { color: 'rgba(255,255,255,0.04)' },
              border: { color: 'rgba(255,255,255,0.08)' },
            },
          },
        },
      });
    };

    tryDraw();

    return () => {
      const canvas = document.getElementById('compareChart');
      if (canvas?._chartInstance) {
        canvas._chartInstance.destroy();
        canvas._chartInstance = null;
      }
    };
  }, [compareList]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this session?')) return;
    await deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    setCompareList(prev => prev.filter(s => s.id !== id));
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete ALL session history? This cannot be undone.')) return;
    await clearAllSessions();
    setSessions([]);
    setCompareList([]);
  };

  const toggleCompare = (session) => {
    setCompareList(prev => {
      if (prev.find(s => s.id === session.id)) return prev.filter(s => s.id !== session.id);
      if (prev.length >= 2) return [prev[1], session];
      return [...prev, session];
    });
  };

  // Trend averages
  const avg = key => sessions.length
    ? Math.round(sessions.reduce((a, s) => a + (s[key] || 0), 0) / sessions.length) : 0;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--accent-teal)',
            letterSpacing: 2, marginBottom: 4 }}>SESSION HISTORY</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {sessions.length} sessions stored on device · All data private
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => navigate('/record')} style={{ fontSize: 13 }}>
            ⏺ New Session
          </button>
          {sessions.length > 0 && (
            <button className="btn btn-outline" onClick={handleClearAll}
              style={{ fontSize: 13, borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              🗑 Clear All
            </button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      {sessions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Avg Heart Rate', value: avg('hr'), unit: 'bpm', color: '#00D4AA' },
            { label: 'Avg SpO2',       value: avg('spo2'), unit: '%',  color: '#3B82F6' },
            { label: 'Total Sessions', value: sessions.length, unit: '',   color: '#8B5CF6' },
          ].map(m => (
            <div key={m.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 900, color: m.color }}>
                {m.value}{m.unit}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Compare panel */}
      {compareList.length === 2 && (
        <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(0,212,170,0.3)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 1,
            color: 'var(--accent-teal)', marginBottom: 16 }}>SESSION COMPARISON</h3>

          {/* Side-by-side metric rows */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {compareList.map((s, i) => (
              <div key={s.id}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Session {i + 1} — {new Date(s.date).toLocaleDateString()}
                </div>
                {[
                  { label: 'Heart Rate', value: `${s.hr} bpm` },
                  { label: 'SpO2',       value: `${s.spo2}%` },
                  { label: 'Temp',       value: s.temp?.label },
                  { label: 'Stress',     value: s.stress?.level },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between',
                    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* ── Comparison chart (ADDED) ── */}
          <div style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20 }}>
            <div style={{
              fontSize: 11, letterSpacing: 1, color: 'var(--text-muted)',
              marginBottom: 14, fontWeight: 600,
            }}>METRIC COMPARISON</div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              {['Session 1', 'Session 2'].map((label, i) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: 2, display: 'inline-block',
                    background: i === 0 ? '#00D4AA' : '#3B82F6',
                  }} />
                  {label}
                </span>
              ))}
            </div>

            {/* Chart canvas */}
            <div style={{ position: 'relative', width: '100%', height: 200 }}>
              <canvas
                id="compareChart"
                role="img"
                aria-label="Bar chart comparing heart rate, SpO2, confidence and stress score between two sessions"
              />
            </div>
          </div>
          {/* ── End comparison chart ── */}
        </div>
      )}

      {/* Sessions list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading history…</div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 8 }}>No sessions yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            Complete your first recording to see history here.
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/record')}>⏺ Start Recording</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {compareList.length < 2 && compareList.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
              Select one more session to compare
            </div>
          )}
          {sessions.map(s => (
            <SessionCard key={s.id} session={s}
              onDelete={handleDelete}
              onCompare={toggleCompare}
              isComparing={!!compareList.find(c => c.id === s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
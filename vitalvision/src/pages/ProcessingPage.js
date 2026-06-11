import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '/analyse';

const STEPS = [
  {
    id: "upload",
    label: "Uploading video",
    detail: "Sending recording to analysis engine..."
  },
  {
    id: "frames",
    label: "Processing video",
    detail: "Extracting frames and validating quality..."
  },
  {
    id: "analysis",
    label: "Analysing signal",
    detail: "Running vital-sign estimation algorithms..."
  },
  {
    id: "report",
    label: "Generating report",
    detail: "Preparing health summary and charts..."
  },
  {
    id: "done",
    label: "Finalising results",
    detail: "Loading dashboard..."
  }
];

export default function ProcessingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    // Simulate processing pipeline with realistic timing
    const delays = [800, 1200, 1500, 1000, 500];
    let step = 0;

    const run = async () => {
      if (step >= STEPS.length) {
        try {
          if (!window.recordedVideoBlob) {
            alert('No video was found for analysis. Please record or upload a video first.');
            navigate('/record');
            return;
          }

          const formData = new FormData();
          formData.append(
            'file',
            window.recordedVideoBlob,
            'video.webm'
          );

          const response = await fetch(
            BACKEND_URL,
            {
              method: 'POST',
              body: formData
            }
          );
        if (!response.ok) {
          throw new Error(
            await response.text()
          );
        }
        const r = await response.json();
        console.log("BACKEND RESPONSE:", r);
        console.log("EMOTIONS:", r.emotionDistrib);
        sessionStorage.setItem(
          "vitalvision_results",
          JSON.stringify(r)
        );

        console.log(
          "STORED:",
          JSON.parse(
            sessionStorage.getItem("vitalvision_results")
          )
        );
        setResults(r);
        sessionStorage.setItem(
          "vitalvision_results",
          JSON.stringify(r)
        );
        setDone(true);
      } catch (err) {
        console.error(err);
        alert(
          "Analysis failed:\n" +
          err.message
        );
        navigate("/record");
      }
      return;
    }
      setCurrentStep(step);
      setTimeout(() => { step++; run(); }, delays[step] || 500);
    };
    run();
  }, []);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate('/results'), 1000);
      return () => clearTimeout(t);
    }
  }, [done, navigate]);

  const overallProgress = Math.round(((currentStep + 1) / STEPS.length) * 100);

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '60px 24px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          {done ? '✅' : (
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              border: '3px solid var(--accent-teal)',
              borderTopColor: 'transparent',
              margin: '0 auto',
              animation: 'spin 0.8s linear infinite',
            }} />
          )}
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--accent-teal)',
          letterSpacing: 2, marginBottom: 8 }}>
          {done ? 'ANALYSIS COMPLETE' : 'ANALYSING VIDEO'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {done ? 'Redirecting to your results dashboard…' : 'Processing vital signs from video data…'}
        </p>
      </div>

      {/* Overall progress bar */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>OVERALL PROGRESS</span>
          <span style={{ fontSize: 12, color: 'var(--accent-teal)', fontWeight: 700 }}>{overallProgress}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${overallProgress}%`,
            background: 'linear-gradient(90deg, #00D4AA, #0099FF)',
            borderRadius: 4,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Steps list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STEPS.map((step, i) => {
          const state = i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending';
          return (
            <div key={step.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10,
              background: state === 'active' ? 'rgba(0,212,170,0.08)' : 'transparent',
              border: `1px solid ${state === 'active' ? 'rgba(0,212,170,0.25)' : 'transparent'}`,
              transition: 'all 0.3s',
            }}>
              {/* Icon */}
              <div style={{ width: 24, height: 24, flexShrink: 0 }}>
                {state === 'done' ? (
                  <div style={{ width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--accent-teal)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✓</div>
                ) : state === 'active' ? (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    border: '2px solid var(--accent-teal)', borderTopColor: 'transparent',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                ) : (
                  <div style={{ width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--bg-card)', border: '1px solid var(--border)' }} />
                )}
              </div>

              {/* Label */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: state === 'pending' ? 400 : 600,
                  color: state === 'done' ? 'var(--success)' : state === 'active' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {step.label}
                </div>
                {state === 'active' && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{step.detail}</div>
                )}
              </div>

              {/* Time indicator */}
              {state === 'done' && (
                <span style={{ fontSize: 11, color: 'var(--accent-teal)', fontWeight: 600 }}>✓</span>
              )}
            </div>
          );
        })}
      </div>

{/* Partial results preview */}
{/* Analysis status */}
<div
  style={{
    marginTop: 28,
    padding: 16,
    background: 'rgba(0,212,170,0.05)',
    border: '1px solid rgba(0,212,170,0.15)',
    borderRadius: 'var(--radius)',
    fontSize: 12,
    color: 'var(--text-muted)'
  }}
>
  <div
    style={{
      fontWeight: 600,
      color: 'var(--accent-teal)',
      marginBottom: 8,
      fontSize: 11,
      letterSpacing: 1
    }}
  >
    ANALYSIS IN PROGRESS
  </div>

  <div>
    Results will appear automatically when processing completes.
  </div>
</div>

</div>
);
}
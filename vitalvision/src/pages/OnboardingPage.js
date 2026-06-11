import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  ShieldCheck,
  Thermometer,
  UserRound,
} from 'lucide-react';

const features = [
  { icon: HeartPulse, title: 'Heart Rate' },
  { icon: Activity, title: 'SpO2 Estimate' },
  { icon: Thermometer, title: 'Temperature Proxy' },
  { icon: UserRound, title: 'Stress Indicator' },
  { icon: ClipboardList, title: 'Health Alerts' },
  { icon: FileText, title: 'PDF Report' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();

  const [checks, setChecks] = useState({
    camera: null,
    browser: null,
    wasm: null,
  });

  useEffect(() => {
    setChecks({
      camera: !!navigator.mediaDevices?.getUserMedia,
      browser: window.isSecureContext && typeof window !== 'undefined',
      wasm: typeof WebAssembly !== 'undefined',
    });
  }, []);

  const allOk = Object.values(checks).every(Boolean);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 24px 56px' }}>
      <section
        style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '42px 38px',
          boxShadow: 'var(--shadow-soft)',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 0.8fr',
            gap: 32,
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 12px',
                borderRadius: 999,
                background: '#ecfdf5',
                color: 'var(--accent-teal)',
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 18,
              }}
            >
              <ShieldCheck size={15} />
              CHRISTIAN MEDICAL COLLEGE VELLORE
            </div>

            <h1
              style={{
                fontSize: 42,
                lineHeight: 1.1,
                fontWeight: 850,
                color: 'var(--text-primary)',
                marginBottom: 14,
              }}
            >
              VitalVision
            </h1>

            <p
              style={{
                fontSize: 19,
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
                maxWidth: 620,
                marginBottom: 10,
              }}
            >
              A simple video-based screening system for estimated vital signs and professional reports.
            </p>

            <p
              style={{
                fontSize: 14,
                color: 'var(--text-muted)',
                lineHeight: 1.7,
                maxWidth: 650,
              }}
            >
              Record or upload a short face video. VitalVision prepares estimated readings, alerts, and a downloadable session report.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginTop: 28,
              }}
            >
              <button className="btn btn-primary" onClick={() => navigate('/record')}>
                <Camera size={18} />
                Start Session
              </button>

              <button className="btn btn-outline" onClick={() => navigate('/history')}>
                <ClipboardList size={18} />
                View History
              </button>
            </div>
          </div>

          <div className="card">
            <h3
              style={{
                fontSize: 15,
                color: 'var(--text-primary)',
                marginBottom: 16,
              }}
            >
              System Status
            </h3>

            {[
              { label: 'Camera access', ok: checks.camera },
              { label: 'Secure browser', ok: checks.browser },
              { label: 'Analysis support', ok: checks.wasm },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <CheckCircle2
                  size={18}
                  color={item.ok ? 'var(--success)' : 'var(--text-muted)'}
                />

                <span
                  style={{
                    flex: 1,
                    color: 'var(--text-secondary)',
                    fontSize: 14,
                  }}
                >
                  {item.label}
                </span>

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color:
                      item.ok === null
                        ? 'var(--text-muted)'
                        : item.ok
                          ? 'var(--success)'
                          : 'var(--danger)',
                  }}
                >
                  {item.ok === null ? 'Checking' : item.ok ? 'Ready' : 'No'}
                </span>
              </div>
            ))}

            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 8,
                background: allOk ? '#ecfdf5' : '#fffbeb',
                color: allOk ? '#166534' : '#92400e',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {allOk
                ? 'Ready to begin a new screening session.'
                : 'You can still use uploaded videos if camera access is unavailable.'}
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 18,
            color: 'var(--text-primary)',
            marginBottom: 18,
          }}
        >
          What VitalVision Includes
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 14,
          }}
        >
          {features.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 16,
                  background: '#f8fafc',
                }}
              >
                <Icon size={22} color="var(--accent-teal)" />

                <div
                  style={{
                    marginTop: 12,
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                  }}
                >
                  {item.title}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        style={{
          padding: 16,
          borderRadius: 10,
          border: '1px solid #f1d59b',
          background: '#fffbeb',
          color: '#78350f',
          fontSize: 13,
          lineHeight: 1.65,
        }}
      >
        <strong>Medical Disclaimer:</strong> VitalVision readings are indicative only and are not a replacement for clinical diagnosis, treatment, or certified medical devices.
      </section>
    </div>
  );
}
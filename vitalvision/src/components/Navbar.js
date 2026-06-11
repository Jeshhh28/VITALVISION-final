import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, ClipboardList, Home, Video } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();

  const links = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/record', label: 'Record', icon: Video },
    { to: '/history', label: 'History', icon: ClipboardList },
  ];

  return (
    <nav
      style={{
        background: '#ffffff',
        borderBottom: '1px solid var(--border)',
        padding: '0 28px',
        minHeight: 68,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 8px rgba(15, 23, 42, 0.04)',
      }}
    >
      <Link
        to="/"
        style={{
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: '#e6f4f1',
            color: 'var(--accent-teal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Activity size={22} strokeWidth={2.5} />
        </div>

        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1.1,
            }}
          >
            VitalVision
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              marginTop: 2,
            }}
          >
            Clinical screening report system
          </div>
        </div>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {links.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 13px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 700,
                color: active ? 'var(--accent-teal)' : 'var(--text-secondary)',
                background: active ? 'var(--accent-teal-dim)' : 'transparent',
              }}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-muted)',
        }}
      >
        CMC Vellore Internship Project
      </div>
    </nav>
  );
}
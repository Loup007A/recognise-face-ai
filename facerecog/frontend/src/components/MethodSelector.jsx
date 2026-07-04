import React from 'react';

const s = {
  wrapper: {
    display: 'flex', gap: 10, marginBottom: 24,
    flexWrap: 'wrap',
  },
  tab: (active, color) => ({
    flex: '1 1 140px',
    padding: '14px 16px',
    borderRadius: 'var(--radius-lg)',
    border: `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? `${color}14` : 'var(--surface)',
    color: active ? color : 'var(--text-dim)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center',
    boxShadow: active ? `0 0 16px ${color}22` : 'none',
  }),
  icon: { fontSize: 22, marginBottom: 4 },
  label: { fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700 },
};

const METHODS = [
  { id: 'face', icon: '🪪', label: 'Visage', color: '#00ff88' },
  { id: 'voice', icon: '🎙️', label: 'Voix', color: '#00ccff' },
  { id: 'fingerprint', icon: '👆', label: 'Empreinte', color: '#ff6b35' },
];

export default function MethodSelector({ active, onChange }) {
  return (
    <div style={s.wrapper}>
      {METHODS.map(m => (
        <div key={m.id} style={s.tab(active === m.id, m.color)} onClick={() => onChange(m.id)}>
          <div style={s.icon}>{m.icon}</div>
          <div style={s.label}>{m.label}</div>
        </div>
      ))}
    </div>
  );
}

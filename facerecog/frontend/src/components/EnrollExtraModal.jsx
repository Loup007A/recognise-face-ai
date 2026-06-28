import React, { useState } from 'react';
import VoiceRecognition from './VoiceRecognition.jsx';
import FingerprintAuth from './FingerprintAuth.jsx';

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(7,7,9,0.95)',
    backdropFilter: 'blur(16px)',
    zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border-bright)',
    borderRadius: 'var(--radius-lg)',
    width: '100%', maxWidth: 480,
    padding: '28px',
    animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
  },
  title: { fontWeight: 800, fontSize: '1.15rem', marginBottom: 4, letterSpacing: '-0.02em' },
  subtitle: { color: 'var(--text-dim)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', marginBottom: 20 },
  tabs: { display: 'flex', gap: 8, marginBottom: 18 },
  tab: (active) => ({
    flex: 1, padding: '9px 10px',
    borderRadius: 'var(--radius)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'rgba(0,255,136,0.08)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-dim)',
    fontFamily: 'var(--font-mono)', fontSize: '0.76rem',
    cursor: 'pointer', textAlign: 'center',
  }),
  skip: {
    marginTop: 16, width: '100%', padding: '11px',
    background: 'transparent', border: '1px solid var(--border-bright)',
    borderRadius: 'var(--radius)', color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)', fontSize: '0.85rem', cursor: 'pointer',
  },
};

export default function EnrollExtraModal({ userId, onDone }) {
  const [tab, setTab] = useState('voice'); // 'voice' | 'fingerprint'
  const [voiceDone, setVoiceDone] = useState(false);
  const [fingerprintDone, setFingerprintDone] = useState(false);

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={s.title}>🔐 Renforcer la sécurité (optionnel)</div>
        <div style={s.subtitle}>// Ajoutez une 2ème méthode d'identification</div>

        <div style={s.tabs}>
          <div style={s.tab(tab === 'voice')} onClick={() => setTab('voice')}>
            🎙️ Voix {voiceDone && '✓'}
          </div>
          <div style={s.tab(tab === 'fingerprint')} onClick={() => setTab('fingerprint')}>
            👆 Empreinte {fingerprintDone && '✓'}
          </div>
        </div>

        {tab === 'voice' ? (
          <VoiceRecognition pendingUserId={userId} onEnrolled={() => setVoiceDone(true)} />
        ) : (
          <FingerprintAuth pendingUserId={userId} onEnrolled={() => setFingerprintDone(true)} />
        )}

        <button style={s.skip} onClick={onDone}>
          {voiceDone || fingerprintDone ? 'Terminer →' : 'Passer cette étape'}
        </button>
      </div>
    </div>
  );
}

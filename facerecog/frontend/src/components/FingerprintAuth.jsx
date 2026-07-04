import React, { useState } from 'react';
import { useWebAuthn } from '../hooks/useWebAuthn.js';

const s = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
  },
  title: { fontWeight: 800, fontSize: '1.05rem', marginBottom: 4, letterSpacing: '-0.02em' },
  subtitle: { color: 'var(--text-dim)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', marginBottom: 20 },
  fingerButton: (active) => ({
    width: 88, height: 88,
    borderRadius: '50%',
    border: `2px solid ${active ? 'var(--accent3)' : 'var(--border-bright)'}`,
    background: active ? 'rgba(255,107,53,0.12)' : 'var(--surface2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 36,
    cursor: 'pointer',
    margin: '0 auto',
    transition: 'all 0.25s',
    boxShadow: active ? '0 0 24px rgba(255,107,53,0.35)' : 'none',
  }),
  statusText: {
    textAlign: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.82rem',
    color: 'var(--text-mid)',
    marginTop: 14,
    minHeight: 20,
  },
  resultBox: (ok) => ({
    marginTop: 16,
    padding: '14px 16px',
    background: ok ? 'rgba(0,255,136,0.08)' : 'rgba(255,68,102,0.08)',
    border: `1px solid ${ok ? 'rgba(0,255,136,0.25)' : 'rgba(255,68,102,0.25)'}`,
    borderRadius: 'var(--radius)',
    fontSize: '0.88rem',
    color: ok ? 'var(--accent)' : '#ff8899',
  }),
  unsupportedBox: {
    padding: '14px 16px',
    background: 'rgba(255,204,68,0.08)',
    border: '1px solid rgba(255,204,68,0.25)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    color: 'var(--yellow)',
  },
};

export default function FingerprintAuth({ pendingUserId, onMatch, onEnrolled }) {
  const { register, authenticate, loading, error, supported } = useWebAuthn();
  const [result, setResult] = useState(null);

  const isEnroll = !!pendingUserId;

  async function handleClick() {
    setResult(null);
    try {
      if (isEnroll) {
        await register(pendingUserId);
        setResult({ ok: true, text: 'Empreinte biométrique enregistrée sur cet appareil !' });
        if (onEnrolled) onEnrolled();
      } else {
        const res = await authenticate();
        setResult({ ok: true, text: `Identifié : ${res.user.name}` });
        if (onMatch) onMatch(res);
      }
    } catch {
      setResult(null); // error already set by hook
    }
  }

  if (!supported) {
    return (
      <div style={s.card}>
        <div style={s.title}>👆 Empreinte digitale</div>
        <div style={s.subtitle}>// WebAuthn / Touch ID / Windows Hello</div>
        <div style={s.unsupportedBox}>
          ⚠ Votre navigateur ou appareil ne supporte pas l'authentification biométrique WebAuthn.
        </div>
      </div>
    );
  }

  return (
    <div style={s.card}>
      <div style={s.title}>👆 Empreinte digitale</div>
      <div style={s.subtitle}>
        {isEnroll ? '// Associer Touch ID / Windows Hello à votre profil' : '// Authentification biométrique'}
      </div>

      <div style={s.fingerButton(loading)} onClick={!loading ? handleClick : undefined}>
        {loading ? '⏳' : '👆'}
      </div>

      <div style={s.statusText}>
        {loading
          ? 'Suivez les instructions de votre appareil...'
          : isEnroll
            ? 'Cliquez pour enregistrer Touch ID, Face ID ou Windows Hello'
            : 'Cliquez pour vous identifier avec votre empreinte'}
      </div>

      {error && <div style={s.resultBox(false)}>⚠ {error}</div>}
      {result && <div style={s.resultBox(result.ok)}>{result.ok ? '✓' : '✗'} {result.text}</div>}
    </div>
  );
}

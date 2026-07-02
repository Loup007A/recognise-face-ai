import React, { useState, useCallback } from 'react';
import { captureVoicePrint } from '../utils/voiceFeatures.js';
import { useSpeechCommand, speak } from '../hooks/useSpeechCommand.js';
import { api } from '../utils/api.js';

const s = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
  },
  title: { fontWeight: 800, fontSize: '1.05rem', marginBottom: 4, letterSpacing: '-0.02em' },
  subtitle: { color: 'var(--text-dim)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', marginBottom: 20 },
  micButton: (active) => ({
    width: 88, height: 88,
    borderRadius: '50%',
    border: `2px solid ${active ? 'var(--accent2)' : 'var(--border-bright)'}`,
    background: active ? 'rgba(0,204,255,0.12)' : 'var(--surface2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 32,
    cursor: 'pointer',
    margin: '0 auto',
    transition: 'all 0.25s',
    boxShadow: active ? '0 0 24px rgba(0,204,255,0.35)' : 'none',
    animation: active ? 'pulse-ring 1.4s ease-in-out infinite' : 'none',
  }),
  progressRing: {
    width: '100%', height: 4,
    background: 'var(--surface2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 16,
  },
  progressFill: (pct) => ({
    height: '100%', width: `${pct}%`,
    background: 'var(--accent2)',
    transition: 'width 0.1s linear',
  }),
  statusText: {
    textAlign: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.82rem',
    color: 'var(--text-mid)',
    marginTop: 14,
    minHeight: 20,
  },
  transcriptBox: {
    marginTop: 12,
    padding: '10px 14px',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    color: 'var(--text)',
    minHeight: 20,
    fontStyle: 'italic',
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
  modeTabs: {
    display: 'flex', gap: 8, marginBottom: 20,
  },
  tab: (active) => ({
    flex: 1,
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    border: `1px solid ${active ? 'var(--accent2)' : 'var(--border)'}`,
    background: active ? 'rgba(0,204,255,0.1)' : 'transparent',
    color: active ? 'var(--accent2)' : 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.78rem',
    cursor: 'pointer',
    textAlign: 'center',
  }),
};

export default function VoiceRecognition({ pendingUserId, onMatch, onEnrolled }) {
  const [mode, setMode] = useState(pendingUserId ? 'enroll' : 'identify'); // 'identify' | 'command' | 'enroll'
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const { start: startListening, listening, transcript, supported: speechSupported } = useSpeechCommand();

  const handleCaptureVoicePrint = useCallback(async () => {
    setCapturing(true);
    setProgress(0);
    setError('');
    setResult(null);
    try {
      const descriptor = await captureVoicePrint(setProgress);

      if (mode === 'enroll' && pendingUserId) {
        await api.enrollVoice(pendingUserId, descriptor);
        setResult({ ok: true, text: 'Empreinte vocale enregistrée avec succès !' });
        speak('Empreinte vocale enregistrée.');
        if (onEnrolled) onEnrolled();
      } else {
        const res = await api.matchVoice(descriptor);
        if (res.match) {
          setResult({ ok: true, text: `Identifié : ${res.user.name} (${res.confidence}% de confiance)` });
          speak(`Bonjour ${res.user.name}`);
          if (onMatch) onMatch(res);
        } else {
          setResult({ ok: false, text: 'Voix non reconnue dans la base de données.' });
          speak('Voix non reconnue.');
        }
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la capture audio.');
    } finally {
      setCapturing(false);
    }
  }, [mode, pendingUserId, onMatch, onEnrolled]);

  const handleVoiceCommand = useCallback(() => {
    setError('');
    startListening(
      (text) => {
        const lower = text.toLowerCase();
        if (lower.includes('scanner') || lower.includes('identifie') || lower.includes('reconnais')) {
          speak('Lancement du scan vocal.');
          handleCaptureVoicePrint();
        } else if (lower.includes('bonjour')) {
          speak('Bonjour ! Dites « scanner » pour lancer la reconnaissance.');
        } else {
          speak(`Commande non reconnue : ${text}`);
        }
      }
    );
  }, [startListening, handleCaptureVoicePrint]);

  return (
    <div style={s.card}>
      <div style={s.title}>🎙️ Reconnaissance vocale</div>
      <div style={s.subtitle}>
        {pendingUserId ? '// Enregistrer votre empreinte vocale' : '// Identification par la voix'}
      </div>

      {!pendingUserId && (
        <div style={s.modeTabs}>
          <div style={s.tab(mode === 'identify')} onClick={() => setMode('identify')}>
            Empreinte vocale
          </div>
          {speechSupported && (
            <div style={s.tab(mode === 'command')} onClick={() => setMode('command')}>
              Commande vocale
            </div>
          )}
        </div>
      )}

      {mode === 'command' && !pendingUserId ? (
        <>
          <div style={s.micButton(listening)} onClick={handleVoiceCommand}>
            {listening ? '🔴' : '🎤'}
          </div>
          <div style={s.statusText}>
            {listening ? 'Je vous écoute...' : 'Cliquez et dites « scanner » pour lancer l\'identification'}
          </div>
          {transcript && <div style={s.transcriptBox}>"{transcript}"</div>}
        </>
      ) : (
        <>
          <div style={s.micButton(capturing)} onClick={!capturing ? handleCaptureVoicePrint : undefined}>
            {capturing ? '🔵' : '🎙️'}
          </div>
          <div style={s.statusText}>
            {capturing
              ? 'Parlez normalement pendant 2-3 secondes...'
              : pendingUserId
                ? 'Cliquez et parlez pour enregistrer votre voix'
                : 'Cliquez et parlez pour vous identifier'}
          </div>
          {capturing && (
            <div style={s.progressRing}>
              <div style={s.progressFill(progress)} />
            </div>
          )}
        </>
      )}

      {error && (
        <div style={{ ...s.resultBox(false), marginTop: 14 }}>⚠ {error}</div>
      )}
      {result && (
        <div style={s.resultBox(result.ok)}>
          {result.ok ? '✓' : '✗'} {result.text}
        </div>
      )}
    </div>
  );
}

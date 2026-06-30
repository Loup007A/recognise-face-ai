import React, { useState, useEffect } from 'react';
import ConsentModal from './components/ConsentModal.jsx';
import FaceCamera from './components/FaceCamera.jsx';
import VoiceRecognition from './components/VoiceRecognition.jsx';
import FingerprintAuth from './components/FingerprintAuth.jsx';
import MethodSelector from './components/MethodSelector.jsx';
import EnrollExtraModal from './components/EnrollExtraModal.jsx';
import { api } from './utils/api.js';

const CONSENT_KEY = 'faceid_consent_v1';

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    borderBottom: '1px solid var(--border)',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(13,13,18,0.95)',
    backdropFilter: 'blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  logoIcon: {
    width: 32, height: 32,
    background: 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,204,255,0.2))',
    border: '1px solid rgba(0,255,136,0.4)',
    borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15,
  },
  logoText: {
    fontWeight: 800, fontSize: '1.05rem',
    letterSpacing: '-0.03em',
    fontFamily: 'var(--font-sans)',
  },
  badge: {
    padding: '3px 8px',
    background: 'rgba(0,255,136,0.1)',
    border: '1px solid rgba(0,255,136,0.25)',
    borderRadius: 3,
    fontSize: '0.68rem',
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.08em',
  },
  main: {
    flex: 1,
    padding: '32px 24px',
    maxWidth: 820,
    margin: '0 auto',
    width: '100%',
  },
  hero: {
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    lineHeight: 1.1,
    marginBottom: 10,
  },
  heroSub: {
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.85rem',
    lineHeight: 1.6,
  },
  statsRow: {
    display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20,
  },
  statChip: {
    padding: '6px 14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-mid)',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
    marginTop: 28,
  },
  infoCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 18px',
  },
  infoCardIcon: { fontSize: 20, marginBottom: 8 },
  infoCardTitle: { fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 },
  infoCardText: { fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 },
  footer: {
    borderTop: '1px solid var(--border)',
    padding: '16px 24px',
    display: 'flex', gap: 16, flexWrap: 'wrap',
    alignItems: 'center', justifyContent: 'space-between',
  },
  footerText: {
    fontSize: '0.78rem',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
  },
  footerLink: {
    color: 'var(--text-dim)',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '0.78rem',
    fontFamily: 'var(--font-mono)',
    background: 'none', border: 'none',
  },
  declinedMsg: {
    flex: 1,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 16, textAlign: 'center',
    padding: 40,
  },
  noConsentIcon: {
    width: 64, height: 64,
    background: 'rgba(255,100,53,0.1)',
    border: '1px solid rgba(255,100,53,0.3)',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, margin: '0 auto',
  },
  matchBanner: (ok) => ({
    marginTop: 20,
    padding: '16px 20px',
    background: ok ? 'rgba(0,255,136,0.08)' : 'rgba(255,68,102,0.08)',
    border: `1px solid ${ok ? 'rgba(0,255,136,0.25)' : 'rgba(255,68,102,0.25)'}`,
    borderRadius: 'var(--radius-lg)',
  }),
};

function InfoCard({ icon, title, text }) {
  return (
    <div style={s.infoCard}>
      <div style={s.infoCardIcon}>{icon}</div>
      <div style={s.infoCardTitle}>{title}</div>
      <div style={s.infoCardText}>{text}</div>
    </div>
  );
}

export default function App() {
  const [consent, setConsent] = useState(() => localStorage.getItem(CONSENT_KEY) === 'true');
  const [showConsent, setShowConsent] = useState(() => localStorage.getItem(CONSENT_KEY) !== 'true');
  const [declined, setDeclined] = useState(false);
  const [stats, setStats] = useState(null);
  const [method, setMethod] = useState('face'); // 'face' | 'voice' | 'fingerprint'
  const [enrollUserId, setEnrollUserId] = useState(null); // shows EnrollExtraModal after face registration
  const [lastMatch, setLastMatch] = useState(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
  }, []);

  function refreshStats() {
    api.getStats().then(setStats).catch(() => {});
  }

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, 'true');
    setConsent(true);
    setShowConsent(false);
  }

  function handleDecline() {
    setShowConsent(false);
    setDeclined(true);
  }

  function revokeConsent() {
    localStorage.removeItem(CONSENT_KEY);
    setConsent(false);
    setDeclined(false);
    setShowConsent(true);
  }

  function handleNewFaceUser(user) {
    refreshStats();
    setEnrollUserId(user.id); // prompt to add voice/fingerprint
  }

  function handleVoiceOrFingerprintMatch(result) {
    setLastMatch(result);
    refreshStats();
  }

  return (
    <div style={s.page}>
      {/* Consent modal */}
      {showConsent && <ConsentModal onAccept={handleAccept} onDecline={handleDecline} />}

      {/* Post-registration enrollment prompt */}
      {enrollUserId && (
        <EnrollExtraModal userId={enrollUserId} onDone={() => setEnrollUserId(null)} />
      )}

      {/* Header */}
      <header style={s.header}>
        <div style={s.logo}>
          <div style={s.logoIcon}>👤</div>
          <span style={s.logoText}>FaceID</span>
          <span style={s.badge}>BETA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {consent && (
            <button style={s.footerLink} onClick={revokeConsent}>
              Révoquer consentement
            </button>
          )}
          {stats && (
            <span style={{ ...s.footerLink, cursor: 'default', textDecoration: 'none', color: 'var(--text-dim)' }}>
              {stats.total_users} profils
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={s.main}>
        <div style={s.hero} className="fade-in">
          <h1 style={s.heroTitle}>
            Reconnaissance<br />
            <span style={{ color: 'var(--accent)' }}>Multi-biométrique</span>
          </h1>
          <p style={s.heroSub}>
            Visage · Voix · Empreinte digitale — Identification sécurisée multi-facteurs<br />
            Données stockées localement (SQLite) · Conformité RGPD
          </p>
          {stats && (
            <div style={s.statsRow}>
              <div style={s.statChip}>👤 {stats.total_users} profils</div>
              <div style={s.statChip}>🔍 {stats.total_scans} reconnaissances</div>
              <div style={s.statChip}>🎙️ {stats.with_voiceprint} empreintes vocales</div>
              <div style={s.statChip}>👆 {stats.with_fingerprint} empreintes digitales</div>
            </div>
          )}
        </div>

        {declined ? (
          <div style={s.declinedMsg}>
            <div style={s.noConsentIcon}>🔒</div>
            <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Accès refusé</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', maxWidth: 400 }}>
              Vous avez refusé les conditions d'utilisation. Ce service requiert votre consentement
              pour traiter vos données biométriques.
            </p>
            <button
              onClick={() => { setDeclined(false); setShowConsent(true); }}
              style={{ padding: '11px 24px', background: 'var(--surface)',
                border: '1px solid var(--border-bright)', borderRadius: 'var(--radius)',
                color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.88rem',
                cursor: 'pointer' }}>
              Voir les conditions
            </button>
          </div>
        ) : consent ? (
          <>
            <MethodSelector active={method} onChange={setMethod} />

            {method === 'face' && (
              <FaceCamera onNewUser={handleNewFaceUser} />
            )}

            {method === 'voice' && (
              <VoiceRecognition onMatch={handleVoiceOrFingerprintMatch} />
            )}

            {method === 'fingerprint' && (
              <FingerprintAuth onMatch={handleVoiceOrFingerprintMatch} />
            )}

            {lastMatch?.match && (method === 'voice' || method === 'fingerprint') && (
              <div style={s.matchBanner(true)}>
                <strong style={{ color: 'var(--accent)' }}>✓ Bonjour, {lastMatch.user.name} !</strong>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: 4 }}>
                  Identifié via {lastMatch.method === 'voice' ? 'empreinte vocale' : 'empreinte digitale'}
                  {' '}— Confiance : {lastMatch.confidence}%
                </div>
              </div>
            )}

            <div style={s.infoGrid}>
              <InfoCard
                icon="🪪"
                title="Visage"
                text="68 points de repère faciaux analysés en temps réel via TensorFlow.js."
              />
              <InfoCard
                icon="🎙️"
                title="Voix"
                text="Empreinte vocale par analyse spectrale, ou commande vocale en français."
              />
              <InfoCard
                icon="👆"
                title="Empreinte digitale"
                text="Touch ID, Face ID ou Windows Hello via le standard sécurisé WebAuthn."
              />
              <InfoCard
                icon="🗑️"
                title="Droit à l'effacement"
                text="Supprimez toutes vos données biométriques à tout moment. Conformément au RGPD."
              />
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>
              Veuillez accepter les conditions pour utiliser le service.
            </p>
            <button
              onClick={() => setShowConsent(true)}
              style={{ padding: '11px 24px', background: 'var(--accent)',
                border: 'none', borderRadius: 'var(--radius)',
                color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: '0.88rem',
                fontWeight: 700, cursor: 'pointer' }}>
              Voir les conditions
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={s.footer}>
        <span style={s.footerText}>© 2024 FaceID — Démonstration technique</span>
        <div style={{ display: 'flex', gap: 16 }}>
          <button style={s.footerLink} onClick={() => setShowConsent(true)}>CGU / Politique de confidentialité</button>
          <span style={s.footerText}>RGPD · Art. 9</span>
        </div>
      </footer>
    </div>
  );
}

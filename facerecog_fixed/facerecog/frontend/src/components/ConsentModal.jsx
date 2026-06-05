import React, { useState } from 'react';

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(7,7,9,0.96)',
    backdropFilter: 'blur(12px)',
    zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
    animation: 'fadeIn 0.3s ease',
  },
  modal: {
    background: 'var(--surface)',
    border: '1px solid var(--border-bright)',
    borderRadius: 'var(--radius-lg)',
    maxWidth: 600,
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '24px 28px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  headerIcon: {
    width: 36, height: 36,
    background: 'rgba(255,100,53,0.15)',
    border: '1px solid rgba(255,100,53,0.3)',
    borderRadius: 'var(--radius)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16,
  },
  title: {
    fontFamily: 'var(--font-sans)',
    fontWeight: 800,
    fontSize: '1.1rem',
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
    marginTop: 2,
  },
  body: {
    padding: '20px 28px',
    overflowY: 'auto',
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: '0.85rem',
    color: 'var(--accent2)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
    fontFamily: 'var(--font-mono)',
  },
  text: {
    fontSize: '0.88rem',
    color: 'var(--text-mid)',
    lineHeight: 1.65,
  },
  highlight: {
    background: 'rgba(0,255,136,0.07)',
    border: '1px solid rgba(0,255,136,0.2)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    fontSize: '0.85rem',
    color: 'var(--text)',
    lineHeight: 1.6,
    marginTop: 12,
  },
  warningBox: {
    background: 'rgba(255,100,53,0.08)',
    border: '1px solid rgba(255,100,53,0.25)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    fontSize: '0.85rem',
    color: '#ffaa88',
    lineHeight: 1.6,
    marginTop: 12,
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '16px',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    marginTop: 16,
  },
  checkbox: {
    width: 18, height: 18,
    accentColor: 'var(--accent)',
    marginTop: 1,
    cursor: 'pointer',
    flexShrink: 0,
  },
  checkLabel: {
    fontSize: '0.85rem',
    color: 'var(--text)',
    lineHeight: 1.5,
    cursor: 'pointer',
  },
  footer: {
    padding: '16px 28px 20px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
  },
  btnDecline: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid var(--border-bright)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-dim)',
    fontSize: '0.85rem',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  btnAccept: {
    padding: '10px 24px',
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius)',
    color: 'var(--bg)',
    fontSize: '0.85rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '0.04em',
  },
  btnAcceptDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};

export default function ConsentModal({ onAccept, onDecline }) {
  const [checks, setChecks] = useState({ cgu: false, biometric: false, age: false });

  const allChecked = checks.cgu && checks.biometric && checks.age;

  const toggle = (key) => setChecks(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} className="slide-up">
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>⚠️</div>
          <div>
            <div style={styles.title}>Conditions d'utilisation & Consentement</div>
            <div style={styles.subtitle}>Lecture obligatoire avant utilisation</div>
          </div>
        </div>

        {/* Body */}
        <div style={styles.body}>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>📋 Qu'est-ce que ce service ?</div>
            <p style={styles.text}>
              FaceID est un système de démonstration de reconnaissance faciale par intelligence artificielle.
              Il analyse les traits de votre visage via la caméra de votre appareil afin de vous identifier
              ou de créer un profil dans la base de données.
            </p>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>🔒 Données biométriques collectées</div>
            <p style={styles.text}>
              En utilisant ce service, vous acceptez que les données suivantes soient collectées et stockées :
            </p>
            <div style={styles.highlight}>
              • <strong>Descripteur facial (128 valeurs numériques)</strong> — représentation mathématique unique de votre visage<br />
              • <strong>Nom</strong>, <strong>date de naissance</strong>, <strong>âge calculé</strong>, <strong>ethnie</strong> (optionnel)<br />
              • <strong>Logs d'utilisation</strong> anonymisés (date, action effectuée)
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>⚖️ Base légale (RGPD)</div>
            <p style={styles.text}>
              Conformément au Règlement Général sur la Protection des Données (RGPD / GDPR),
              la collecte de données biométriques repose sur votre <strong>consentement explicite et éclairé</strong>.
              Les données biométriques sont des données sensibles au sens de l'article 9 du RGPD.
            </p>
            <div style={styles.warningBox}>
              ⚠️ <strong>Important :</strong> Ne partagez pas ce service avec des mineurs de moins de 13 ans.
              Vous devez avoir au moins 13 ans pour vous enregistrer.
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>🗑️ Vos droits</div>
            <p style={styles.text}>
              Vous disposez des droits suivants sur vos données :<br /><br />
              • <strong>Droit d'accès</strong> — consulter les données vous concernant<br />
              • <strong>Droit de rectification</strong> — corriger des données inexactes<br />
              • <strong>Droit à l'effacement</strong> — supprimer définitivement votre profil<br />
              • <strong>Droit d'opposition</strong> — vous opposer au traitement<br /><br />
              La suppression de vos données est disponible directement depuis l'interface.
            </p>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>🔧 Finalité du traitement</div>
            <p style={styles.text}>
              Vos données sont utilisées <strong>exclusivement</strong> pour la reconnaissance faciale au sein de ce service.
              Elles ne sont ni vendues, ni partagées avec des tiers, ni utilisées à des fins commerciales.
              La reconnaissance s'effectue par comparaison mathématique de descripteurs — aucune image n'est stockée.
            </p>
          </div>

          {/* Checkboxes */}
          <label style={{
            ...styles.checkboxRow,
            borderColor: checks.cgu ? 'var(--accent)' : 'var(--border)',
          }}>
            <input type="checkbox" style={styles.checkbox} checked={checks.cgu} onChange={() => toggle('cgu')} />
            <span style={styles.checkLabel}>
              J'ai lu et j'accepte les <strong>Conditions Générales d'Utilisation</strong> et la
              <strong> Politique de Confidentialité</strong> de ce service.
            </span>
          </label>

          <label style={{
            ...styles.checkboxRow,
            borderColor: checks.biometric ? 'var(--accent)' : 'var(--border)',
          }}>
            <input type="checkbox" style={styles.checkbox} checked={checks.biometric} onChange={() => toggle('biometric')} />
            <span style={styles.checkLabel}>
              Je consens au <strong>traitement de mes données biométriques</strong> (descripteur facial)
              aux fins de reconnaissance décrites ci-dessus.
            </span>
          </label>

          <label style={{
            ...styles.checkboxRow,
            borderColor: checks.age ? 'var(--accent)' : 'var(--border)',
          }}>
            <input type="checkbox" style={styles.checkbox} checked={checks.age} onChange={() => toggle('age')} />
            <span style={styles.checkLabel}>
              Je confirme avoir <strong>au moins 13 ans</strong> et utiliser ce service pour moi-même.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.btnDecline} onClick={onDecline}
            onMouseEnter={e => e.target.style.color = 'var(--text)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-dim)'}>
            Refuser
          </button>
          <button
            style={{ ...styles.btnAccept, ...(!allChecked ? styles.btnAcceptDisabled : {}) }}
            onClick={() => allChecked && onAccept()}
            disabled={!allChecked}
          >
            Accepter et continuer →
          </button>
        </div>
      </div>
    </div>
  );
}

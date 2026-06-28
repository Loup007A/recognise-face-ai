import React, { useState } from 'react';
import { api } from '../utils/api.js';

const ETHNICITIES = [
  'Préfère ne pas répondre',
  'Africain(e)',
  'Asiatique de l\'Est',
  'Asiatique du Sud',
  'Asiatique du Sud-Est',
  'Caucasien(ne) / Européen(ne)',
  'Hispanique / Latino(a)',
  'Moyen-Oriental(e)',
  'Amérindien(ne)',
  'Métis(se) / Mixte',
  'Autre',
];

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
  title: {
    fontWeight: 800,
    fontSize: '1.2rem',
    marginBottom: 4,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    color: 'var(--text-dim)',
    fontSize: '0.82rem',
    fontFamily: 'var(--font-mono)',
    marginBottom: 24,
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: '0.92rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    transition: 'border-color 0.2s',
    marginBottom: 16,
  },
  select: {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: '0.92rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    cursor: 'pointer',
    marginBottom: 20,
  },
  ageTag: {
    display: 'inline-block',
    background: 'rgba(0,255,136,0.1)',
    border: '1px solid rgba(0,255,136,0.3)',
    borderRadius: 'var(--radius)',
    padding: '4px 10px',
    fontSize: '0.8rem',
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
    marginBottom: 16,
  },
  error: {
    background: 'rgba(255,68,102,0.1)',
    border: '1px solid rgba(255,68,102,0.3)',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    color: '#ff8899',
    fontSize: '0.85rem',
    marginBottom: 16,
  },
  row: { display: 'flex', gap: 10, marginTop: 4 },
  btnCancel: {
    flex: 1, padding: '11px',
    background: 'transparent',
    border: '1px solid var(--border-bright)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-dim)',
    fontSize: '0.88rem',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  btnSubmit: {
    flex: 2, padding: '11px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: 'var(--bg)',
    fontSize: '0.88rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.04em',
  },
};

function calcAge(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const age = Math.floor((Date.now() - d) / (365.25 * 24 * 60 * 60 * 1000));
  return isNaN(age) || age < 0 || age > 120 ? null : age;
}

export default function RegisterForm({ descriptor, onSuccess, onCancel }) {
  const [form, setForm] = useState({ name: '', birth_date: '', ethnicity: 'Préfère ne pas répondre' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const age = calcAge(form.birth_date);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit() {
    if (!form.name.trim()) return setError('Veuillez entrer votre nom.');
    if (!form.birth_date) return setError('Veuillez entrer votre date de naissance.');
    if (age === null || age < 13) return setError('Vous devez avoir au moins 13 ans.');

    setLoading(true);
    setError('');
    try {
      const res = await api.registerFace({
        name: form.name.trim(),
        birth_date: form.birth_date,
        ethnicity: form.ethnicity !== 'Préfère ne pas répondre' ? form.ethnicity : null,
        descriptor: Array.from(descriptor),
        consent_accepted: true,
      });
      onSuccess(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={s.title}>Visage non reconnu</div>
        <div style={s.subtitle}>// Créer un nouveau profil</div>

        {error && <div style={s.error}>⚠ {error}</div>}

        <label style={s.label}>Votre nom complet</label>
        <input
          style={s.input}
          placeholder="Ex : Jean Dupont"
          value={form.name}
          onChange={e => update('name', e.target.value)}
          maxLength={100}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />

        <label style={s.label}>Date de naissance</label>
        <input
          style={s.input}
          type="date"
          value={form.birth_date}
          onChange={e => update('birth_date', e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        {age !== null && <div style={s.ageTag}>Âge calculé : {age} ans</div>}

        <label style={s.label}>Ethnie (optionnel)</label>
        <select
          style={s.select}
          value={form.ethnicity}
          onChange={e => update('ethnicity', e.target.value)}
        >
          {ETHNICITIES.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <div style={s.row}>
          <button style={s.btnCancel} onClick={onCancel} disabled={loading}>
            Annuler
          </button>
          <button style={s.btnSubmit} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Enregistrement...' : '→ Créer mon profil'}
          </button>
        </div>
      </div>
    </div>
  );
}

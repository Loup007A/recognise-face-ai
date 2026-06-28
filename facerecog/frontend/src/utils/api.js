const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // ── Face ──────────────────────────────────────────────────────────────────
  matchFace: (descriptor) =>
    request('/api/face/match', {
      method: 'POST',
      body: JSON.stringify({ descriptor: Array.from(descriptor) }),
    }),

  registerFace: (payload) =>
    request('/api/face/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteData: (id) =>
    request(`/api/face/delete/${id}`, { method: 'DELETE' }),

  getStats: () => request('/api/stats'),

  health: () => request('/api/health'),

  // ── Voice ─────────────────────────────────────────────────────────────────
  matchVoice: (descriptor) =>
    request('/api/voice/match', {
      method: 'POST',
      body: JSON.stringify({ descriptor }),
    }),

  enrollVoice: (userId, descriptor) =>
    request('/api/voice/enroll', {
      method: 'POST',
      body: JSON.stringify({ userId, descriptor }),
    }),

  // ── WebAuthn (fingerprint / biometric) ──────────────────────────────────────
  webauthnRegisterOptions: (userId) =>
    request('/api/webauthn/register/options', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  webauthnRegisterVerify: (userId, response) =>
    request('/api/webauthn/register/verify', {
      method: 'POST',
      body: JSON.stringify({ userId, response }),
    }),

  webauthnAuthOptions: () =>
    request('/api/webauthn/auth/options', { method: 'POST' }),

  webauthnAuthVerify: (response) =>
    request('/api/webauthn/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ response }),
    }),
};

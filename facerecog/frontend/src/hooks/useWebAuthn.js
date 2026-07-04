import { useState, useCallback } from 'react';
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { api } from '../utils/api.js';

export function useWebAuthn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supported = browserSupportsWebAuthn();

  const register = useCallback(async (userId) => {
    setLoading(true);
    setError('');
    try {
      const options = await api.webauthnRegisterOptions(userId);
      // Force platform authenticator (Touch ID / Face ID / Windows Hello)
      // to prevent the browser from offering a USB security key
      if (options.authenticatorSelection) {
        options.authenticatorSelection.authenticatorAttachment = 'platform';
      } else {
        options.authenticatorSelection = { authenticatorAttachment: 'platform' };
      }
      const attResp = await startRegistration(options);
      const result = await api.webauthnRegisterVerify(userId, attResp);
      return result;
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Enregistrement annulé ou non autorisé.'
        : err.message || 'Erreur lors de l\'enregistrement biométrique.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const authenticate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const options = await api.webauthnAuthOptions();
      const authResp = await startAuthentication(options);
      const result = await api.webauthnAuthVerify(authResp);
      return result;
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Authentification annulée ou échouée.'
        : err.message || 'Erreur lors de l\'authentification.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { register, authenticate, loading, error, supported };
}

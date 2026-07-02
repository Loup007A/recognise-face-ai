const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { db } = require('./db');

const router = express.Router();

// rpID must match the domain the frontend is served from (no protocol, no port)
const RP_NAME = 'FaceID Recognition System';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function saveChallenge(userId, challenge, type) {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  db.prepare(
    `INSERT INTO webauthn_challenges (id, user_id, challenge, type, expires_at) VALUES (?, ?, ?, ?, ?)`
  ).run(uuidv4(), userId || null, challenge, type, expiresAt);
}

function consumeChallenge(challenge, type) {
  const row = db.prepare(
    `SELECT * FROM webauthn_challenges WHERE challenge = ? AND type = ? ORDER BY created_at DESC LIMIT 1`
  ).get(challenge, type);
  if (!row) return null;
  db.prepare(`DELETE FROM webauthn_challenges WHERE id = ?`).run(row.id);
  if (new Date(row.expires_at) < new Date()) return null;
  return row;
}

// ─── Registration: start ──────────────────────────────────────────────────────
// Body: { userId } — user must already exist (created via face registration first)
router.post('/register/options', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required.' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(user.id),
      userName: user.name,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Touch ID / Face ID / Windows Hello
        userVerification: 'required',
        residentKey: 'preferred',
      },
      excludeCredentials: user.webauthn_credential_id
        ? [{ id: user.webauthn_credential_id }]
        : [],
    });

    saveChallenge(userId, options.challenge, 'registration');
    res.json(options);
  } catch (err) {
    console.error('WebAuthn register options error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Registration: verify ──────────────────────────────────────────────────────
router.post('/register/verify', async (req, res) => {
  try {
    const { userId, response } = req.body;
    if (!userId || !response) return res.status(400).json({ error: 'Missing userId or response.' });

    const expectedChallenge = response?.response?.clientDataJSON
      ? JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString()).challenge
      : null;

    const challengeRow = expectedChallenge ? consumeChallenge(expectedChallenge, 'registration') : null;
    if (!challengeRow) {
      return res.status(400).json({ error: 'Challenge invalide ou expiré. Réessayez.' });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Vérification échouée.' });
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    db.prepare(
      `UPDATE users SET webauthn_credential_id = ?, webauthn_public_key = ?, webauthn_counter = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      credentialID,
      Buffer.from(credentialPublicKey).toString('base64'),
      counter,
      userId
    );

    db.prepare(
      `INSERT INTO recognition_logs (id, user_id, action, method, ip_address) VALUES (?, ?, ?, ?, ?)`
    ).run(uuidv4(), userId, 'webauthn_registered', 'fingerprint', req.ip);

    res.json({ success: true, message: 'Empreinte biométrique enregistrée.' });
  } catch (err) {
    console.error('WebAuthn register verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Authentication: start ─────────────────────────────────────────────────────
// No userId needed — passkey flow lets the device pick the right credential
router.post('/auth/options', async (req, res) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
    });

    saveChallenge(null, options.challenge, 'authentication');
    res.json(options);
  } catch (err) {
    console.error('WebAuthn auth options error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Authentication: verify ─────────────────────────────────────────────────────
router.post('/auth/verify', async (req, res) => {
  try {
    const { response } = req.body;
    if (!response) return res.status(400).json({ error: 'Missing response.' });

    const credentialId = response.id;
    const user = db.prepare('SELECT * FROM users WHERE webauthn_credential_id = ?').get(credentialId);
    if (!user) {
      return res.status(404).json({ error: 'Aucun utilisateur associé à cette empreinte.' });
    }

    const expectedChallenge = JSON.parse(
      Buffer.from(response.response.clientDataJSON, 'base64url').toString()
    ).challenge;

    const challengeRow = consumeChallenge(expectedChallenge, 'authentication');
    if (!challengeRow) {
      return res.status(400).json({ error: 'Challenge invalide ou expiré. Réessayez.' });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: user.webauthn_credential_id,
        credentialPublicKey: Buffer.from(user.webauthn_public_key, 'base64'),
        counter: user.webauthn_counter,
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ error: 'Authentification échouée.' });
    }

    db.prepare(`UPDATE users SET webauthn_counter = ? WHERE id = ?`).run(
      verification.authenticationInfo.newCounter,
      user.id
    );

    db.prepare(
      `INSERT INTO recognition_logs (id, user_id, action, method, confidence, ip_address) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuidv4(), user.id, 'recognized', 'fingerprint', 100, req.ip);

    res.json({
      match: true,
      confidence: 100,
      method: 'fingerprint',
      user: { id: user.id, name: user.name, age: user.age, ethnicity: user.ethnicity },
    });
  } catch (err) {
    console.error('WebAuthn auth verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

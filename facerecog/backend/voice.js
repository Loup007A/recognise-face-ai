const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');

const router = express.Router();

// Voice descriptors are arrays of numeric features (MFCC-like, extracted client-side)
const VOICE_VECTOR_LENGTH = 32; // must match frontend extraction length
const VOICE_THRESHOLD = 0.22;   // euclidean distance threshold (normalized features)

function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

// ─── Match voice against database ──────────────────────────────────────────────
router.post('/match', (req, res) => {
  try {
    const { descriptor } = req.body;
    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== VOICE_VECTOR_LENGTH) {
      return res.status(400).json({ error: `Invalid voice descriptor. Expected ${VOICE_VECTOR_LENGTH}-dim array.` });
    }

    const users = db.prepare(
      `SELECT id, name, age, ethnicity, voice_descriptor FROM users WHERE consent_accepted = 1 AND voice_descriptor IS NOT NULL`
    ).all();

    if (users.length === 0) {
      return res.json({ match: false, reason: 'empty_db' });
    }

    let best = null;
    let bestDistance = Infinity;

    for (const user of users) {
      const stored = JSON.parse(user.voice_descriptor);
      const dist = euclideanDistance(descriptor, stored);
      if (dist < bestDistance) {
        bestDistance = dist;
        best = user;
      }
    }

    const confidence = Math.max(0, Math.min(100, Math.round((1 - bestDistance / 0.6) * 100)));

    if (bestDistance < VOICE_THRESHOLD) {
      db.prepare(
        `INSERT INTO recognition_logs (id, user_id, action, method, confidence, ip_address) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(uuidv4(), best.id, 'recognized', 'voice', confidence, req.ip);

      return res.json({
        match: true,
        confidence,
        method: 'voice',
        user: { id: best.id, name: best.name, age: best.age, ethnicity: best.ethnicity },
      });
    }

    db.prepare(
      `INSERT INTO recognition_logs (id, user_id, action, method, confidence, ip_address) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuidv4(), null, 'not_recognized', 'voice', confidence, req.ip);

    res.json({ match: false, reason: 'no_match', bestDistance });
  } catch (err) {
    console.error('Voice match error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Enroll voiceprint for an existing user ────────────────────────────────────
router.post('/enroll', (req, res) => {
  try {
    const { userId, descriptor } = req.body;
    if (!userId || !descriptor || !Array.isArray(descriptor) || descriptor.length !== VOICE_VECTOR_LENGTH) {
      return res.status(400).json({ error: 'Missing userId or invalid descriptor.' });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    db.prepare(
      `UPDATE users SET voice_descriptor = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(JSON.stringify(descriptor), userId);

    db.prepare(
      `INSERT INTO recognition_logs (id, user_id, action, method, ip_address) VALUES (?, ?, ?, ?, ?)`
    ).run(uuidv4(), userId, 'voice_enrolled', 'voice', req.ip);

    res.json({ success: true, message: 'Empreinte vocale enregistrée.' });
  } catch (err) {
    console.error('Voice enroll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

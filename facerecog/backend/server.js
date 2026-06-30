require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { db, migrate: runMigrate } = require('./db');
const webauthnRoutes = require('./webauthn');
const voiceRoutes = require('./voice');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure tables exist even if migrate wasn't run as a separate build step
runMigrate();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

// ─── Sub-routers ──────────────────────────────────────────────────────────────
app.use('/api/webauthn', webauthnRoutes);
app.use('/api/voice', voiceRoutes);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Match face descriptor against database
app.post('/api/face/match', (req, res) => {
  try {
    const { descriptor } = req.body;

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({ error: 'Invalid face descriptor. Expected 128-dimensional array.' });
    }

    const users = db.prepare(
      `SELECT id, name, birth_date, age, ethnicity, face_descriptor FROM users WHERE consent_accepted = 1`
    ).all();

    if (users.length === 0) {
      return res.json({ match: false, reason: 'empty_db' });
    }

    let bestMatch = null;
    let bestDistance = Infinity;
    const THRESHOLD = 0.5;

    for (const user of users) {
      const storedDescriptor = JSON.parse(user.face_descriptor);
      const distance = euclideanDistance(descriptor, storedDescriptor);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = user;
      }
    }

    const confidence = Math.max(0, Math.min(100, Math.round((1 - bestDistance / 1.5) * 100)));

    if (bestDistance < THRESHOLD) {
      db.prepare(
        `INSERT INTO recognition_logs (id, user_id, action, method, confidence, ip_address) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(uuidv4(), bestMatch.id, 'recognized', 'face', confidence, req.ip);

      return res.json({
        match: true,
        confidence,
        method: 'face',
        user: {
          id: bestMatch.id,
          name: bestMatch.name,
          age: bestMatch.age,
          ethnicity: bestMatch.ethnicity,
          hasVoiceprint: !!bestMatch.voice_descriptor,
        }
      });
    } else {
      db.prepare(
        `INSERT INTO recognition_logs (id, user_id, action, method, confidence, ip_address) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(uuidv4(), null, 'not_recognized', 'face', confidence, req.ip);

      return res.json({ match: false, reason: 'no_match', bestDistance });
    }
  } catch (err) {
    console.error('Match error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register new user
app.post('/api/face/register', (req, res) => {
  try {
    const { name, birth_date, ethnicity, descriptor, consent_accepted } = req.body;

    if (!consent_accepted) {
      return res.status(400).json({ error: 'Consent is required to register.' });
    }

    if (!name || !birth_date || !descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({ error: 'Missing required fields or invalid descriptor.' });
    }

    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]{2,100}$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({ error: 'Invalid name format.' });
    }

    const birthDateObj = new Date(birth_date);
    if (isNaN(birthDateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid birth date.' });
    }

    const today = new Date();
    const age = Math.floor((today - birthDateObj) / (365.25 * 24 * 60 * 60 * 1000));

    if (age < 13) {
      return res.status(400).json({ error: 'You must be at least 13 years old to register.' });
    }
    if (age > 120) {
      return res.status(400).json({ error: 'Invalid birth date.' });
    }

    // Check if face already exists
    const existing = db.prepare(
      `SELECT id, name, face_descriptor FROM users WHERE consent_accepted = 1`
    ).all();
    for (const user of existing) {
      const distance = euclideanDistance(descriptor, JSON.parse(user.face_descriptor));
      if (distance < 0.45) {
        return res.status(409).json({
          error: 'This face is already registered.',
          existing_name: user.name
        });
      }
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO users (id, name, birth_date, age, ethnicity, face_descriptor, consent_accepted, consent_date)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`
    ).run(id, name.trim(), birth_date, age, ethnicity || null, JSON.stringify(descriptor));

    db.prepare(
      `INSERT INTO recognition_logs (id, user_id, action, method, ip_address) VALUES (?, ?, ?, ?, ?)`
    ).run(uuidv4(), id, 'registered', 'face', req.ip);

    const user = db.prepare('SELECT id, name, age, ethnicity, created_at FROM users WHERE id = ?').get(id);

    res.status(201).json({ success: true, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get stats (public, anonymized)
app.get('/api/stats', (req, res) => {
  try {
    const users = db.prepare('SELECT COUNT(*) as count FROM users WHERE consent_accepted = 1').get();
    const logs = db.prepare('SELECT COUNT(*) as count FROM recognition_logs').get();
    const withVoice = db.prepare('SELECT COUNT(*) as count FROM users WHERE voice_descriptor IS NOT NULL').get();
    const withFingerprint = db.prepare('SELECT COUNT(*) as count FROM users WHERE webauthn_credential_id IS NOT NULL').get();
    res.json({
      total_users: users.count,
      total_scans: logs.count,
      with_voiceprint: withVoice.count,
      with_fingerprint: withFingerprint.count,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete own data (RGPD right to erasure)
app.delete('/api/face/delete/:id', (req, res) => {
  try {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid ID.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true, message: 'Your data has been permanently deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

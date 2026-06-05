require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

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
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ─── Cosine similarity helper ─────────────────────────────────────────────────
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Match face descriptor against database
app.post('/api/face/match', async (req, res) => {
  try {
    const { descriptor } = req.body;

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({ error: 'Invalid face descriptor. Expected 128-dimensional array.' });
    }

    const result = await pool.query(
      'SELECT id, name, birth_date, age, ethnicity, face_descriptor FROM users WHERE consent_accepted = true'
    );

    if (result.rows.length === 0) {
      return res.json({ match: false, reason: 'empty_db' });
    }

    let bestMatch = null;
    let bestDistance = Infinity;
    const THRESHOLD = 0.5; // Euclidean distance threshold for face-api.js 128-dim

    for (const user of result.rows) {
      const storedDescriptor = user.face_descriptor;
      const distance = euclideanDistance(descriptor, storedDescriptor);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = user;
      }
    }

    const confidence = Math.max(0, Math.min(100, Math.round((1 - bestDistance / 1.5) * 100)));

    if (bestDistance < THRESHOLD) {
      // Log recognition
      await pool.query(
        'INSERT INTO recognition_logs (user_id, action, confidence, ip_address) VALUES ($1, $2, $3, $4)',
        [bestMatch.id, 'recognized', confidence, req.ip]
      );

      return res.json({
        match: true,
        confidence,
        user: {
          id: bestMatch.id,
          name: bestMatch.name,
          age: bestMatch.age,
          ethnicity: bestMatch.ethnicity,
        }
      });
    } else {
      await pool.query(
        'INSERT INTO recognition_logs (user_id, action, confidence, ip_address) VALUES ($1, $2, $3, $4)',
        [null, 'not_recognized', confidence, req.ip]
      );

      return res.json({ match: false, reason: 'no_match', bestDistance });
    }
  } catch (err) {
    console.error('Match error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register new user
app.post('/api/face/register', async (req, res) => {
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
    const existing = await pool.query('SELECT id, name, face_descriptor FROM users WHERE consent_accepted = true');
    for (const user of existing.rows) {
      const distance = euclideanDistance(descriptor, user.face_descriptor);
      if (distance < 0.45) {
        return res.status(409).json({
          error: 'This face is already registered.',
          existing_name: user.name
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO users (name, birth_date, age, ethnicity, face_descriptor, consent_accepted, consent_date)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, name, age, ethnicity, created_at`,
      [name.trim(), birth_date, age, ethnicity || null, descriptor, true]
    );

    await pool.query(
      'INSERT INTO recognition_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
      [result.rows[0].id, 'registered', req.ip]
    );

    res.status(201).json({
      success: true,
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get stats (public, anonymized)
app.get('/api/stats', async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) as count FROM users WHERE consent_accepted = true');
    const logs = await pool.query('SELECT COUNT(*) as count FROM recognition_logs');
    res.json({
      total_users: parseInt(users.rows[0].count),
      total_scans: parseInt(logs.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete own data (RGPD right to erasure)
app.delete('/api/face/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid ID.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
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

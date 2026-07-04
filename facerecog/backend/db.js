const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Render/Railway disks: use a persistent directory if available, else local file
const DATA_DIR = process.env.SQLITE_DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'facerecog.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      age INTEGER,
      ethnicity TEXT,
      face_descriptor TEXT NOT NULL,        -- JSON array of 128 floats
      voice_descriptor TEXT,                 -- JSON array of voice features (nullable)
      webauthn_credential_id TEXT,           -- base64url credential ID (nullable)
      webauthn_public_key TEXT,              -- base64 public key (nullable)
      webauthn_counter INTEGER DEFAULT 0,
      consent_accepted INTEGER DEFAULT 0,
      consent_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recognition_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,                  -- 'recognized' | 'not_recognized' | 'registered' | 'voice_match' | 'webauthn_verified'
      method TEXT DEFAULT 'face',            -- 'face' | 'voice' | 'fingerprint'
      confidence REAL,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      challenge TEXT NOT NULL,
      type TEXT NOT NULL,                    -- 'registration' | 'authentication'
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_user_id ON recognition_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_webauthn_cred ON users(webauthn_credential_id);
  `);
  console.log('✅ SQLite migrations completed —', DB_PATH);
}

module.exports = { db, migrate, DB_PATH };

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.SQLITE_DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'facerecog.db');

// Only create directory if it doesn't already exist
// (at build time on Render, /var/data doesn't exist yet — that's OK,
//  the server.js will call migrate() again at runtime when the disk IS mounted)
if (DATA_DIR !== __dirname) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    // Directory not available yet (build phase) — will retry at runtime
    console.warn(`[db] Cannot create ${DATA_DIR}: ${e.message} — will use fallback`);
  }
}

// Fallback: if DATA_DIR isn't usable, use __dirname (local dev or build phase)
let db;
try {
  db = new Database(DB_PATH);
} catch (e) {
  console.warn(`[db] Cannot open ${DB_PATH}, falling back to local: ${e.message}`);
  db = new Database(path.join(__dirname, 'facerecog.db'));
}

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
      face_descriptor TEXT NOT NULL,
      voice_descriptor TEXT,
      webauthn_credential_id TEXT,
      webauthn_public_key TEXT,
      webauthn_counter INTEGER DEFAULT 0,
      consent_accepted INTEGER DEFAULT 0,
      consent_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recognition_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      method TEXT DEFAULT 'face',
      confidence REAL,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      challenge TEXT NOT NULL,
      type TEXT NOT NULL,
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

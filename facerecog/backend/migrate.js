require('dotenv').config();
const { migrate } = require('./db');

try {
  migrate();
  process.exit(0);
} catch (err) {
  console.error('❌ Migration failed:', err);
  process.exit(1);
}

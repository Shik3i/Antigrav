const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Determine DB file path: env var for Docker, fallback for local dev
// Note: We go one level up because this file is in /database/
const dbFilePath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'timerapp.db');

// Ensure parent directory exists
const dbDir = path.dirname(dbFilePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbFilePath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database');
    applyDatabasePragmas(db);
  }
});

function applyDatabasePragmas(database) {
  database.run('PRAGMA journal_mode=WAL;');
  database.run('PRAGMA synchronous=NORMAL;');
  database.run('PRAGMA temp_store=MEMORY;');
  database.run('PRAGMA foreign_keys=ON;');
  database.run('PRAGMA busy_timeout = 5000;');
  database.run('PRAGMA cache_size = -20000;');
  database.run('PRAGMA mmap_size = 536870912;');
}

module.exports = db;

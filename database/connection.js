const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function createDatabaseConnection(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename, { timeout: 5000 });
  database.exec('PRAGMA busy_timeout=5000');
  database.exec('PRAGMA journal_mode=WAL');
  database.exec('PRAGMA synchronous=NORMAL');
  database.exec('PRAGMA temp_store=MEMORY');
  database.exec('PRAGMA foreign_keys=ON');
  database.exec('PRAGMA cache_size=-20000');
  database.exec('PRAGMA mmap_size=536870912');
  return database;
}

const dbFilePath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'timerapp.db');
const db = createDatabaseConnection(dbFilePath);

module.exports = db;
module.exports.createDatabaseConnection = createDatabaseConnection;
module.exports.dbFilePath = dbFilePath;

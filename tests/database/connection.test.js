const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
test('createDatabaseConnection applies required pragmas', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'koala-connection-'));
  const filename = path.join(directory, 'connection.db');
  process.env.DB_PATH = path.join(directory, 'module-default.db');
  const connectionModule = require('../../database/connection');
  const { createDatabaseConnection } = connectionModule;
  const database = createDatabaseConnection(filename);

  try {
    assert.equal(database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.equal(database.prepare('PRAGMA busy_timeout').get().timeout, 5000);
    assert.equal(database.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  } finally {
    database.close();
    connectionModule.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

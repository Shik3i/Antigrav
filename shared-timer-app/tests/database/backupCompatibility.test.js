const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabaseConnection } = require('../../database/connection');

test('VACUUM INTO creates a readable independent backup', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'koala-backup-'));
  const source = createDatabaseConnection(path.join(directory, 'source.db'));
  const destination = path.join(directory, 'backup.db');
  try {
    source.exec('CREATE TABLE marker (value TEXT NOT NULL)');
    source.prepare('INSERT INTO marker (value) VALUES (?)').run('safe');
    source.prepare('VACUUM INTO ?').run(destination);
    const backup = createDatabaseConnection(destination);
    try { assert.equal(backup.prepare('SELECT value FROM marker').get().value, 'safe'); }
    finally { backup.close(); }
  } finally {
    source.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

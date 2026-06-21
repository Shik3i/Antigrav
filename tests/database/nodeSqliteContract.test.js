const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

test('node:sqlite supports the database operations required by the app', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'koala-node-sqlite-'));
  const filename = path.join(directory, 'contract.db');
  const database = new DatabaseSync(filename);

  try {
    database.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, label TEXT NOT NULL)');
    const insert = database.prepare('INSERT INTO items (label) VALUES (?)').run('alpha');
    assert.equal(Number(insert.lastInsertRowid), 1);
    assert.equal(Number(insert.changes), 1);
    assert.deepEqual(
      { ...database.prepare('SELECT * FROM items WHERE id = ?').get(1) },
      { id: 1, label: 'alpha' }
    );
    assert.deepEqual(
      database.prepare('SELECT * FROM items ORDER BY id').all().map((row) => ({ ...row })),
      [{ id: 1, label: 'alpha' }]
    );
  } finally {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

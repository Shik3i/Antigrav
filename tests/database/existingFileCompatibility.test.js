const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabaseConnection } = require('../../database/connection');
const { initializeDatabaseSchema } = require('../../database/schema');

test('existing sqlite files are migrated in place without losing representative rows', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'koala-existing-'));
  const filename = path.join(directory, 'existing.db');
  const database = createDatabaseConnection(filename);
  try {
    database.exec(`
      CREATE TABLE Users (id TEXT PRIMARY KEY, displayName TEXT NOT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE Rooms (id TEXT PRIMARY KEY);
      CREATE TABLE TimerEvents (
        id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT, roomId TEXT, durationMinutes INTEGER,
        completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES Users(id), FOREIGN KEY(roomId) REFERENCES Rooms(id)
      );
      INSERT INTO Users (id, displayName) VALUES ('legacy-user', 'Legacy User');
      INSERT INTO Rooms (id) VALUES ('legacy-room');
      INSERT INTO TimerEvents (userId, roomId, durationMinutes) VALUES ('legacy-user', 'legacy-room', 25);
    `);

    initializeDatabaseSchema(database);

    assert.equal(database.prepare("SELECT displayName FROM Users WHERE id = 'legacy-user'").get().displayName, 'Legacy User');
    assert.equal(database.prepare("SELECT durationMinutes FROM TimerEvents WHERE userId = 'legacy-user'").get().durationMinutes, 25);
    assert.equal(database.prepare("SELECT type FROM pragma_table_info('TimerEvents') WHERE name = 'durationMinutes'").get().type, 'REAL');
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'Rooms'").get().count, 0);
  } finally {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

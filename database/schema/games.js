const { addColumn } = require('./utils');

function initializeGamesSchema(database) {
    // LeaderboardSettings: visibility toggle for games
    database.exec(`CREATE TABLE IF NOT EXISTS LeaderboardSettings (
      game_id TEXT PRIMARY KEY,
      is_hidden BOOLEAN DEFAULT 0
    )`);

    // TimerEvents: stores history of completed timers for stats
    // Note: No foreign key to Rooms anymore as rooms are RAM-only.
    database.exec(`CREATE TABLE IF NOT EXISTS TimerEvents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      roomId TEXT,
      roomName TEXT,
      durationMinutes REAL,
      completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    // Migration: Ensure durationMinutes is REAL and remove FK to Rooms
    addColumn(database, 'TimerEvents', 'roomName', 'TEXT');
    addColumn(database, 'TimerEvents', 'durationMinutes', 'REAL');
    const timerColumns = database.prepare('PRAGMA table_info(TimerEvents)').all();
    const durationColumn = timerColumns.find((column) => column.name === 'durationMinutes');
    const hasRoomsForeignKey = database.prepare('PRAGMA foreign_key_list(TimerEvents)').all()
      .some((foreignKey) => foreignKey.table === 'Rooms');

    if (hasRoomsForeignKey || (durationColumn && durationColumn.type !== 'REAL')) {
      database.exec('PRAGMA foreign_keys=OFF');
      database.exec('BEGIN IMMEDIATE');
      try {
        database.exec('DROP TABLE IF EXISTS TimerEvents_new');
        database.exec('CREATE TABLE TimerEvents_new (id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT, roomId TEXT, roomName TEXT, durationMinutes REAL, completedAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(userId) REFERENCES Users(id))');
        database.exec('INSERT INTO TimerEvents_new (id, userId, roomId, roomName, durationMinutes, completedAt) SELECT id, userId, roomId, roomName, durationMinutes, completedAt FROM TimerEvents');
        database.exec('DROP TABLE TimerEvents');
        database.exec('ALTER TABLE TimerEvents_new RENAME TO TimerEvents');
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      } finally {
        database.exec('PRAGMA foreign_keys=ON');
      }
    }
    database.exec('DROP TABLE IF EXISTS Rooms');

    // GameScores: stores historical performance entries
    database.exec(`CREATE TABLE IF NOT EXISTS GameScores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      gameId TEXT NOT NULL,
      score INTEGER NOT NULL,
      coinsEarned INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    // Phase 19 Migration: Remove sessionLog column from GameScores
    if (hasColumn(database, 'GameScores', 'sessionLog')) {
      database.exec('BEGIN IMMEDIATE');
      try {
        database.exec('DROP TABLE IF EXISTS GameScores_new');
        database.exec('CREATE TABLE GameScores_new (id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT NOT NULL, gameId TEXT NOT NULL, score INTEGER NOT NULL, coinsEarned INTEGER NOT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(userId) REFERENCES Users(id))');
        database.exec('INSERT INTO GameScores_new (id, userId, gameId, score, coinsEarned, createdAt) SELECT id, userId, gameId, score, coinsEarned, createdAt FROM GameScores');
        database.exec('DROP TABLE GameScores');
        database.exec('ALTER TABLE GameScores_new RENAME TO GameScores');
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }

    // UserGameStats: stores per-game statistics
    database.exec(`CREATE TABLE IF NOT EXISTS UserGameStats (
      userId TEXT NOT NULL,
      gameId TEXT NOT NULL,
      highscore INTEGER DEFAULT 0,
      sprintHighscore INTEGER DEFAULT 0,
      totalScore INTEGER DEFAULT 0,
      totalLines INTEGER DEFAULT 0,
      maxLevel INTEGER DEFAULT 1,
      playCount INTEGER DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (userId, gameId),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Phase 19 Migration: Add maxLevel to UserGameStats
    addColumn(database, 'UserGameStats', 'maxLevel', 'INTEGER DEFAULT 1');
    addColumn(database, 'UserGameStats', 'sprintHighscore', 'INTEGER DEFAULT 0');
}

module.exports = {
    initializeGamesSchema
};
const { addColumn, hasColumn, seedWordleDictionary } = require('./utils');

function initializeWordleSchema(database) {
    // --- Wordle Minigame ---
    database.exec(`CREATE TABLE IF NOT EXISTS wordle_dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      is_used BOOLEAN DEFAULT 0,
      definition TEXT,
      funny_quote TEXT,
      used_at DATETIME
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS Wordle_DailyWords (
      date TEXT PRIMARY KEY,
      word TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS Wordle_DailyResults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      guesses TEXT NOT NULL, -- JSON array of guesses
      won BOOLEAN NOT NULL,
      earnedCoins INTEGER DEFAULT 0,
      hintUsed BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, date),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS Wordle_UserStats (
      userId TEXT PRIMARY KEY,
      totalPlayed INTEGER DEFAULT 0,
      totalWins INTEGER DEFAULT 0,
      currentStreak INTEGER DEFAULT 0,
      maxStreak INTEGER DEFAULT 0,
      totalHintsBought INTEGER DEFAULT 0,
      lastStreakDate TEXT,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Migration: Add hintUsed to existing Wordle_DailyResults
    addColumn(database, 'Wordle_DailyResults', 'hintUsed', 'BOOLEAN DEFAULT 0');

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

    // Wordle 2.0: Seed the dictionary from JSON if empty and sync with history
    seedWordleDictionary(database);

    // Migration: Ensure wordle_history_migrated is set
    const wordleMigration = database.prepare(
      "SELECT value FROM ServerSettings WHERE key = 'wordle_history_migrated'"
    ).get();
    if (!wordleMigration || wordleMigration.value !== '1') {
      database.exec(`
        INSERT OR REPLACE INTO Wordle_UserStats
          (userId, totalPlayed, totalWins, currentStreak, maxStreak, lastStreakDate, totalHintsBought)
        SELECT userId, COUNT(*), SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END), 0, 0, NULL, 0
        FROM Wordle_DailyResults
        GROUP BY userId
      `);
      database.exec("INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('wordle_history_migrated', '1')");
    }
}

module.exports = {
    initializeWordleSchema
};
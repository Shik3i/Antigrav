const { addColumn } = require('./utils');

function initializeColorSyncSchema(database) {
    // ColorSync_Scores: stores color sync game scores
    database.exec(`CREATE TABLE IF NOT EXISTS ColorSync_Scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      score REAL NOT NULL,
      target_color TEXT NOT NULL,
      guessed_color TEXT NOT NULL,
      mode TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS ColorSync_Daily (
      date TEXT PRIMARY KEY,
      target_color TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS ColorSync_DailyResults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      score REAL NOT NULL,
      guessed_color TEXT NOT NULL,
      date TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, date),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS ColorSync_Lobbies (
      id TEXT PRIMARY KEY,
      creatorId TEXT NOT NULL,
      target_color TEXT NOT NULL,
      status TEXT DEFAULT 'waiting',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(creatorId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS ColorSync_LobbyParticipants (
      lobby_id TEXT NOT NULL,
      userId TEXT NOT NULL,
      score REAL,
      guessed_color TEXT,
      submitted_at DATETIME,
      PRIMARY KEY(lobby_id, userId),
      FOREIGN KEY(lobby_id) REFERENCES ColorSync_Lobbies(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_colorsync_scores_userId ON ColorSync_Scores(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_colorsync_lobby_participants_lobbyId ON ColorSync_LobbyParticipants(lobby_id)');
}

module.exports = {
    initializeColorSyncSchema
};
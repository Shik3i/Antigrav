const { addColumn } = require('./utils');

function initializeEsportsSchema(database) {
    // TeamMappings: maps lol esports acronyms to polymarket acronyms (e.g., EINS -> ES1)
    database.exec(`CREATE TABLE IF NOT EXISTS TeamMappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      originalCode TEXT UNIQUE NOT NULL,
      polymarketCode TEXT NOT NULL
    )`);

    // EsportsTeams: stores all fetched esports teams for autocomplete
    database.exec(`CREATE TABLE IF NOT EXISTS EsportsTeams (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      league TEXT,
      image TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Bets: user wagers on esports matches
    database.exec(`CREATE TABLE IF NOT EXISTS Bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      matchName TEXT NOT NULL,
      chosenTeam TEXT NOT NULL,
      polymarketTeam TEXT,
      stake INTEGER NOT NULL,
      odds REAL NOT NULL,
      polymarketUrl TEXT,
      eventDate DATETIME NOT NULL,
      status TEXT DEFAULT 'open',
      league TEXT,
      team1Logo TEXT,
      team2Logo TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    // Migration: Add polymarketTeam to Bets
    addColumn(database, 'Bets', 'polymarketTeam', 'TEXT');
    addColumn(database, 'Bets', 'league', 'TEXT');
    addColumn(database, 'Bets', 'team1Logo', 'TEXT');
    addColumn(database, 'Bets', 'team2Logo', 'TEXT');

    // Countdowns: user-created countdown timers
    database.exec(`CREATE TABLE IF NOT EXISTS Countdowns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventName TEXT NOT NULL,
      targetDate TEXT NOT NULL,
      userId TEXT,
      creatorName TEXT,
      isPublic BOOLEAN DEFAULT 0,
      isGlobal BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_esports_teams_name ON EsportsTeams(name)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_esports_teams_updated ON EsportsTeams(updated_at DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_countdowns_userId ON Countdowns(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_countdowns_visibility ON Countdowns(isPublic, isGlobal)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_bets_userid ON Bets(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_bets_status ON Bets(status)');
}

module.exports = {
    initializeEsportsSchema
};
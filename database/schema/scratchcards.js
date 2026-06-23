const { addColumn } = require('./utils');

function initializeScratchcardsSchema(database) {
    // ScratchcardPools: Manual superadmin assignment of teams to scratchcard types
    database.exec(`CREATE TABLE IF NOT EXISTS ScratchcardPools (
      card_type TEXT NOT NULL,
      team_code TEXT NOT NULL,
      PRIMARY KEY(card_type, team_code)
    )`);

    // ScratchcardConfigs: Superadmin configuration for economy (price, win chance, reward)
    database.exec(`CREATE TABLE IF NOT EXISTS ScratchcardConfigs (
      card_type TEXT PRIMARY KEY,
      price INTEGER NOT NULL,
      win_chance REAL NOT NULL,
      reward_amount INTEGER NOT NULL
    )`);

    // scratchcard_packs: stores scratchcard pack configurations
    database.exec(`CREATE TABLE IF NOT EXISTS scratchcard_packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      region_label TEXT,
      scope TEXT NOT NULL CHECK (scope IN ('Regional', 'International')),
      price INTEGER NOT NULL,
      win_chance REAL DEFAULT 0.3,
      reward_amount INTEGER, -- For non-weighted fixed reward
      is_weighted BOOLEAN DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // scratchcard_pack_teams: links packs to teams
    database.exec(`CREATE TABLE IF NOT EXISTS scratchcard_pack_teams (
      pack_id INTEGER NOT NULL,
      team_code TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      PRIMARY KEY(pack_id, team_code),
      FOREIGN KEY(pack_id) REFERENCES scratchcard_packs(id) ON DELETE CASCADE
    )`);

    // Scratchcards: stores purchased but not yet claimed cards
    database.exec(`CREATE TABLE IF NOT EXISTS Scratchcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      grid TEXT NOT NULL,
      winAmount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'purchased',
      price INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    // Migrations
    addColumn(database, 'Scratchcards', 'price', 'INTEGER DEFAULT 0');
    addColumn(database, 'scratchcard_packs', 'max_daily_limit', 'INTEGER DEFAULT 0');
    addColumn(database, 'scratchcard_packs', 'is_special', 'BOOLEAN DEFAULT 0');

    // Indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_scratchcards_userId ON Scratchcards(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_scratchcards_status ON Scratchcards(status)');
}

module.exports = {
    initializeScratchcardsSchema
};
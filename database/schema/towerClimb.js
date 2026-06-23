const { addColumn } = require('./utils');

function initializeTowerClimbSchema(database) {
    // TowerClimbRounds: stores tower climb game rounds
    database.exec(`CREATE TABLE IF NOT EXISTS TowerClimbRounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      bet INTEGER NOT NULL,
      tilesPerLevel INTEGER NOT NULL,
      levelCount INTEGER NOT NULL DEFAULT 8,
      currentLevel INTEGER NOT NULL DEFAULT 0,
      currentMultiplier REAL NOT NULL DEFAULT 1,
      selectedTiles TEXT NOT NULL DEFAULT '[]',
      trapPattern TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      payout INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolvedAt DATETIME,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_tower_rounds_user_created ON TowerClimbRounds(userId, createdAt DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_tower_rounds_user_status ON TowerClimbRounds(userId, status)');
    database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_tower_rounds_user_running ON TowerClimbRounds(userId) WHERE status = 'running'");
}

module.exports = {
    initializeTowerClimbSchema
};
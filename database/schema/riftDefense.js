const { addColumn } = require('./utils');

function initializeRiftDefenseSchema(database) {
    // RiftDefense_Towers: stores user towers
    database.exec(`CREATE TABLE IF NOT EXISTS RiftDefense_Towers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      teamCode TEXT NOT NULL,
      starLevel INTEGER DEFAULT 1,
      rarityTier INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Migration: Add rarityTier to RiftDefense_Towers
    addColumn(database, 'RiftDefense_Towers', 'rarityTier', 'INTEGER DEFAULT 0');

    database.exec(`CREATE TABLE IF NOT EXISTS RiftDefense_Stats (
      userId TEXT PRIMARY KEY,
      highestWave INTEGER DEFAULT 0,
      totalMinionsKilled INTEGER DEFAULT 0,
      totalBossesKilled INTEGER DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_riftdefense_userId ON RiftDefense_Towers(userId)');
}

module.exports = {
    initializeRiftDefenseSchema
};
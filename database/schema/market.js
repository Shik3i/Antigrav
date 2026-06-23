const { addColumn } = require('./utils');

function initializeMarketSchema(database) {
    // MMO_MarketPrices: stores MMO market prices
    database.exec(`CREATE TABLE IF NOT EXISTS MMO_MarketPrices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemName TEXT NOT NULL,
      price BIGINT NOT NULL,
      updatedBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      isDeleted INTEGER DEFAULT 0
    )`);

    // Migration: Add createdAt to MMO_MarketPrices
    addColumn(database, 'MMO_MarketPrices', 'createdAt', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

    // GlobalGameStats: for fast global tracking of game winnings
    database.exec(`CREATE TABLE IF NOT EXISTS GlobalGameStats (
      gameId TEXT PRIMARY KEY,
      totalPayout INTEGER DEFAULT 0,
      totalWins INTEGER DEFAULT 0,
      totalPlayed INTEGER DEFAULT 0
    )`);

    // Migration: Add totalPlayed to GlobalGameStats
    addColumn(database, 'GlobalGameStats', 'totalPlayed', 'INTEGER DEFAULT 0');

    // Seed initial global game stats
    const insertGlobalStats = database.prepare(
      'INSERT OR IGNORE INTO GlobalGameStats (gameId, totalPayout, totalWins, totalPlayed) VALUES (?, ?, ?, ?)'
    );

    // Tower Climb stats
    const towerStats = database.prepare(
      "SELECT COUNT(*) AS played, SUM(CASE WHEN status = 'cashed_out' THEN 1 ELSE 0 END) AS wins, SUM(payout) AS payout FROM TowerClimbRounds"
    ).get();
    insertGlobalStats.run('tower-climb', towerStats.payout || 0, towerStats.wins || 0, towerStats.played || 0);

    // Scratchcards stats
    const scratchcardStats = database.prepare(
      'SELECT COUNT(*) AS played, SUM(winAmount) AS payout, SUM(CASE WHEN winAmount > 0 THEN 1 ELSE 0 END) AS wins FROM Scratchcards'
    ).get();
    insertGlobalStats.run('scratchcards', scratchcardStats.payout || 0, scratchcardStats.wins || 0, scratchcardStats.played || 0);

    // Initialize Lotto stats
    insertGlobalStats.run('lotto', 0, 0, 0);

    // Indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_market_deleted_name ON MMO_MarketPrices(isDeleted, itemName)');
}

module.exports = {
    initializeMarketSchema
};
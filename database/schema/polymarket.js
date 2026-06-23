const { addColumn } = require('./utils');

function initializePolymarketSchema(database) {
    // PolymarketGeneralBets: for user-submitted custom bets
    database.exec(`CREATE TABLE IF NOT EXISTS PolymarketGeneralBets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL UNIQUE,
      outcomes TEXT NOT NULL, -- JSON
      status TEXT DEFAULT 'open',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Migration: Add winnerIndex to PolymarketGeneralBets
    addColumn(database, 'PolymarketGeneralBets', 'winnerIndex', 'INTEGER');

    // PolymarketUserBets: for user bets on custom Polymarket events
    database.exec(`CREATE TABLE IF NOT EXISTS PolymarketUserBets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      polymarketBetId INTEGER NOT NULL,
      outcomeIndex INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(polymarketBetId) REFERENCES PolymarketGeneralBets(id) ON DELETE CASCADE
    )`);

    // Migration: Add shares and priceAtBet to PolymarketUserBets
    addColumn(database, 'PolymarketUserBets', 'shares', 'REAL DEFAULT 0.0');
    addColumn(database, 'PolymarketUserBets', 'priceAtBet', 'REAL DEFAULT 0.0');
}

module.exports = {
    initializePolymarketSchema
};
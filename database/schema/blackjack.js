const { addColumn } = require('./utils');

function initializeBlackjackSchema(database) {
    // BlackjackStats: stores blackjack game statistics
    database.exec(`CREATE TABLE IF NOT EXISTS BlackjackStats (
      userId TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      gamesPlayed INTEGER NOT NULL DEFAULT 0,
      blackjacksHit INTEGER NOT NULL DEFAULT 0,
      totalWagered INTEGER NOT NULL DEFAULT 0,
      totalWon INTEGER NOT NULL DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_totalWon ON BlackjackStats(totalWon DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_gamesPlayed ON BlackjackStats(gamesPlayed DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_blackjacksHit ON BlackjackStats(blackjacksHit DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_totalWagered ON BlackjackStats(totalWagered DESC)');
}

module.exports = {
    initializeBlackjackSchema
};
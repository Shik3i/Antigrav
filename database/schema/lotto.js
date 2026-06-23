const { addColumn } = require('./utils');

function initializeLottoSchema(database) {
    // LottoDrawings: stores lottery draw results
    database.exec(`CREATE TABLE IF NOT EXISTS LottoDrawings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drawDate TEXT NOT NULL UNIQUE,
      numbers TEXT NOT NULL,
      superzahl INTEGER NOT NULL,
      totalTickets INTEGER DEFAULT 0,
      totalWinners INTEGER DEFAULT 0,
      totalPayout INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // LottoTickets: stores user lottery tickets
    database.exec(`CREATE TABLE IF NOT EXISTS LottoTickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      drawDate TEXT NOT NULL,
      numbers TEXT NOT NULL,
      superzahl INTEGER NOT NULL,
      matchCount INTEGER DEFAULT 0,
      superzahlMatch BOOLEAN DEFAULT 0,
      winClass INTEGER DEFAULT 0,
      winAmount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_user ON LottoTickets(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_draw ON LottoTickets(drawDate, status)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_user_draw ON LottoTickets(userId, drawDate)');
}

module.exports = {
    initializeLottoSchema
};
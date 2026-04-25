const db = require('../connection');

const getLottoConfig = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM GlobalGameStats WHERE gameId = 'lotto'", (err, stats) => {
      if (err) return reject(err);
      const finalStats = stats || { totalPayout: 0, totalWins: 0, totalPlayed: 0 };
      db.get("SELECT COUNT(*) as totalPending FROM LottoTickets WHERE status = 'pending'", (err, pendRow) => {
        if (err) return reject(err);
        finalStats.totalPending = pendRow ? pendRow.totalPending : 0;
        db.get("SELECT * FROM LottoDrawings ORDER BY drawDate DESC LIMIT 1", (err, lastDraw) => {
          if (err) return reject(err);
          if (!lastDraw) return resolve({ stats: finalStats, lastDraw: null });
          db.all("SELECT winClass, COUNT(*) as winnerCount FROM LottoTickets WHERE drawDate = ? AND winClass > 0 GROUP BY winClass", [lastDraw.drawDate], (err, winnerRows) => {
            if (err) return reject(err);
            const winnersByClass = {};
            winnerRows.forEach(row => winnersByClass[row.winClass] = row.winnerCount);
            lastDraw.winnersByClass = winnersByClass;
            resolve({ stats: finalStats, lastDraw });
          });
        });
      });
    });
  });
};

const purchaseLottoTickets = (userId, tickets, drawDate) => {
  return new Promise((resolve, reject) => {
    const totalCost = tickets.length * 100;
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (err, user) => {
        if (err || !user || user.koala_balance < totalCost) return db.run('ROLLBACK', () => reject(new Error(user ? 'Not enough KoalaCoins.' : 'User not found.')));
        db.all("SELECT numbers, superzahl FROM LottoTickets WHERE userId = ? AND drawDate = ?", [userId, drawDate], (err, existingRows) => {
          if (err) return db.run('ROLLBACK', () => reject(err));
          if ((existingRows ? existingRows.length : 0) + tickets.length > 100) return db.run('ROLLBACK', () => reject(new Error('Tägliches Limit erreicht. (Max 100)')));
          db.run('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?', [totalCost, userId]);
          db.run('UPDATE GlobalGameStats SET totalPlayed = totalPlayed + ? WHERE gameId = ?', [tickets.length, 'lotto']);
          db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, -totalCost, `Lotto Kauf (${tickets.length}x)`]);
          const stmt = db.prepare('INSERT INTO LottoTickets (userId, drawDate, numbers, superzahl) VALUES (?, ?, ?, ?)');
          tickets.forEach(t => stmt.run([userId, drawDate, JSON.stringify(t.numbers.sort((a,b) => a-b)), t.superzahl]));
          stmt.finalize();
          db.run('COMMIT', (err) => err ? reject(err) : resolve({ newBalance: user.koala_balance - totalCost }));
        });
      });
    });
  });
};

const getUserLottoTicketCountForDraw = (userId, drawDate) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM LottoTickets WHERE userId = ? AND drawDate = ?", [userId, drawDate], (err, row) => err ? reject(err) : resolve(row ? row.count : 0));
  });
};

const executeLottoDraw = (drawDate, drawnNumbers, drawnSuperzahl) => {
  const { determineWinClass, getPayoutForClass } = require('../config/lotto.js');
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.all("SELECT * FROM LottoTickets WHERE drawDate = ? AND status = 'pending'", [drawDate], (err, tickets) => {
        if (err) return db.run('ROLLBACK', () => reject(err));
        let totalPayout = 0; let totalWinners = 0; const userPayouts = {};
        for (const ticket of tickets) {
          const ticketNumbers = JSON.parse(ticket.numbers);
          const winClass = determineWinClass(ticketNumbers, ticket.superzahl, drawnNumbers, drawnSuperzahl);
          const payout = getPayoutForClass(winClass);
          db.run("UPDATE LottoTickets SET matchCount = ?, superzahlMatch = ?, winClass = ?, winAmount = ?, status = 'drawn' WHERE id = ?", [ticketNumbers.filter(n => drawnNumbers.includes(n)).length, ticket.superzahl === drawnSuperzahl ? 1 : 0, winClass, payout, ticket.id]);
          if (payout > 0) { totalPayout += payout; totalWinners++; userPayouts[ticket.userId] = (userPayouts[ticket.userId] || 0) + payout; }
        }
        for (const [userId, amount] of Object.entries(userPayouts)) {
          db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [amount, userId]);
          db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, amount, `Lotto Gewinn (${drawDate})`]);
        }
        db.run('UPDATE GlobalGameStats SET totalPayout = totalPayout + ?, totalWins = totalWins + ? WHERE gameId = ?', [totalPayout, totalWinners, 'lotto']);
        db.run('INSERT INTO LottoDrawings (drawDate, numbers, superzahl, totalTickets, totalWinners, totalPayout) VALUES (?, ?, ?, ?, ?, ?)', [drawDate, JSON.stringify(drawnNumbers), drawnSuperzahl, tickets.length, totalWinners, totalPayout]);
        db.run('COMMIT', (err) => err ? reject(err) : resolve({ drawDate, numbers: drawnNumbers, superzahl: drawnSuperzahl, totalTickets: tickets.length, totalWinners, totalPayout }));
      });
    });
  });
};

const getUserLottoHistory = (userId, limit = 999) => {
  return new Promise((resolve, reject) => {
    const q = 'SELECT t.*, d.numbers as drawNumbers, d.superzahl as drawSuperzahl, d.totalPayout as drawTotalPayout FROM LottoTickets t LEFT JOIN LottoDrawings d ON t.drawDate = d.drawDate WHERE t.userId = ? ORDER BY t.drawDate DESC, t.winAmount DESC LIMIT ?';
    db.all(q, [userId, limit], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const getLottoDrawHistory = (limit = 30) => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM LottoDrawings ORDER BY drawDate DESC LIMIT ?", [limit], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const getUserLifetimeLottoTicketCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM LottoTickets WHERE userId = ?', [userId], (err, row) => err ? reject(err) : resolve(row ? row.count : 0));
  });
};

module.exports = {
  getLottoConfig,
  purchaseLottoTickets,
  getUserLottoTicketCountForDraw,
  executeLottoDraw,
  getUserLottoHistory,
  getLottoDrawHistory,
  getUserLifetimeLottoTicketCount,
};

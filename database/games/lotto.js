const db = require('../connection');

async function getLottoConfig() {
  const stats = db.prepare("SELECT * FROM GlobalGameStats WHERE gameId = 'lotto'").get()
    || { totalPayout: 0, totalWins: 0, totalPlayed: 0 };
  stats.totalPending = db.prepare("SELECT COUNT(*) AS count FROM LottoTickets WHERE status = 'pending'").get().count;
  const lastDraw = db.prepare('SELECT * FROM LottoDrawings ORDER BY drawDate DESC LIMIT 1').get();
  if (!lastDraw) return { stats, lastDraw: null };
  lastDraw.winnersByClass = {};
  for (const row of db.prepare('SELECT winClass, COUNT(*) AS winnerCount FROM LottoTickets WHERE drawDate = ? AND winClass > 0 GROUP BY winClass').all(lastDraw.drawDate)) {
    lastDraw.winnersByClass[row.winClass] = row.winnerCount;
  }
  return { stats, lastDraw };
}

async function purchaseLottoTickets(userId, tickets, drawDate) {
  const totalCost = tickets.length * 100;
  db.exec('BEGIN IMMEDIATE');
  try {
    const user = db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found.');
    if (user.koala_balance < totalCost) throw new Error('Not enough KoalaCoins.');
    const existingCount = db.prepare('SELECT COUNT(*) AS count FROM LottoTickets WHERE userId = ? AND drawDate = ?').get(userId, drawDate).count;
    if (existingCount + tickets.length > 100) throw new Error('Tägliches Limit erreicht. (Max 100)');
    db.prepare('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?').run(totalCost, userId);
    db.prepare("UPDATE GlobalGameStats SET totalPlayed = totalPlayed + ? WHERE gameId = 'lotto'").run(tickets.length);
    db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)')
      .run(userId, -totalCost, `Lotto Kauf (${tickets.length}x)`);
    const insert = db.prepare('INSERT INTO LottoTickets (userId, drawDate, numbers, superzahl) VALUES (?, ?, ?, ?)');
    for (const ticket of tickets) insert.run(userId, drawDate, JSON.stringify([...ticket.numbers].sort((a, b) => a - b)), ticket.superzahl);
    db.exec('COMMIT');
    return { newBalance: user.koala_balance - totalCost };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

const getUserLottoTicketCountForDraw = async (userId, drawDate) => db.prepare(
  'SELECT COUNT(*) AS count FROM LottoTickets WHERE userId = ? AND drawDate = ?'
).get(userId, drawDate).count;

async function executeLottoDraw(drawDate, drawnNumbers, drawnSuperzahl) {
  const { determineWinClass, getPayoutForClass } = require('../../config/lotto.js');
  db.exec('BEGIN IMMEDIATE');
  try {
    const tickets = db.prepare("SELECT * FROM LottoTickets WHERE drawDate = ? AND status = 'pending'").all(drawDate);
    let totalPayout = 0; let totalWinners = 0; const userPayouts = {};
    const update = db.prepare("UPDATE LottoTickets SET matchCount = ?, superzahlMatch = ?, winClass = ?, winAmount = ?, status = 'drawn' WHERE id = ?");
    for (const ticket of tickets) {
      const numbers = JSON.parse(ticket.numbers);
      const winClass = determineWinClass(numbers, ticket.superzahl, drawnNumbers, drawnSuperzahl);
      const payout = getPayoutForClass(winClass);
      update.run(numbers.filter((number) => drawnNumbers.includes(number)).length, ticket.superzahl === drawnSuperzahl ? 1 : 0, winClass, payout, ticket.id);
      if (payout > 0) { totalPayout += payout; totalWinners += 1; userPayouts[ticket.userId] = (userPayouts[ticket.userId] || 0) + payout; }
    }
    for (const [userId, amount] of Object.entries(userPayouts)) {
      db.prepare('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?').run(amount, userId);
      db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)').run(userId, amount, `Lotto Gewinn (${drawDate})`);
    }
    db.prepare("UPDATE GlobalGameStats SET totalPayout = totalPayout + ?, totalWins = totalWins + ? WHERE gameId = 'lotto'").run(totalPayout, totalWinners);
    db.prepare('INSERT INTO LottoDrawings (drawDate, numbers, superzahl, totalTickets, totalWinners, totalPayout) VALUES (?, ?, ?, ?, ?, ?)')
      .run(drawDate, JSON.stringify(drawnNumbers), drawnSuperzahl, tickets.length, totalWinners, totalPayout);
    db.exec('COMMIT');
    return { drawDate, numbers: drawnNumbers, superzahl: drawnSuperzahl, totalTickets: tickets.length, totalWinners, totalPayout };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

const getUserLottoHistory = async (userId, limit = 999) => db.prepare(`
  SELECT t.*, d.numbers AS drawNumbers, d.superzahl AS drawSuperzahl, d.totalPayout AS drawTotalPayout
  FROM LottoTickets t LEFT JOIN LottoDrawings d ON t.drawDate = d.drawDate
  WHERE t.userId = ? ORDER BY t.drawDate DESC, t.winAmount DESC LIMIT ?
`).all(userId, limit);
const getLottoDrawHistory = async (limit = 30) => db.prepare('SELECT * FROM LottoDrawings ORDER BY drawDate DESC LIMIT ?').all(limit);
const getUserLifetimeLottoTicketCount = async (userId) => db.prepare('SELECT COUNT(*) AS count FROM LottoTickets WHERE userId = ?').get(userId).count;

module.exports = { getLottoConfig, purchaseLottoTickets, getUserLottoTicketCountForDraw, executeLottoDraw, getUserLottoHistory, getLottoDrawHistory, getUserLifetimeLottoTicketCount };

const db = require('../connection');

const statsSql = `INSERT INTO BlackjackStats (userId, username, gamesPlayed, blackjacksHit, totalWagered, totalWon, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(userId) DO UPDATE SET username=excluded.username, gamesPlayed=gamesPlayed+excluded.gamesPlayed,
    blackjacksHit=blackjacksHit+excluded.blackjacksHit, totalWagered=totalWagered+excluded.totalWagered,
    totalWon=totalWon+excluded.totalWon, updatedAt=CURRENT_TIMESTAMP`;

const getBlackjackStats = async (userId) => db.prepare('SELECT * FROM BlackjackStats WHERE userId = ?').get(userId)
  || { userId, gamesPlayed: 0, blackjacksHit: 0, totalWagered: 0, totalWon: 0 };
async function upsertBlackjackStats(userId, username, delta = {}) {
  const { gamesPlayed = 0, blackjacksHit = 0, totalWagered = 0, totalWon = 0 } = delta;
  return Number(db.prepare(statsSql).run(userId, username, gamesPlayed, blackjacksHit, totalWagered, totalWon).changes);
}

async function applyBlackjackSettlement(results = []) {
  if (!Array.isArray(results) || results.length === 0) return [];
  db.exec('BEGIN IMMEDIATE');
  try {
    const updateBalance = db.prepare('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?');
    const insertTransaction = db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)');
    const updateStats = db.prepare(statsSql);
    for (const result of results) {
      if (result.payout > 0) {
        updateBalance.run(result.payout, result.userId);
        const reason = result.settlementType === 'sideBet'
          ? `Blackjack Side Bet Win (${result.sideBetKey || 'sideBet'}: ${result.bet})`
          : `Blackjack Win (Bet: ${result.bet})`;
        insertTransaction.run(result.userId, result.payout, reason);
      }
      if (result.settlementType !== 'sideBet') {
        updateStats.run(result.userId, result.username, 1, result.blackjack ? 1 : 0, result.bet || 0, result.payout || 0);
      }
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const userIds = [...new Set(results.map((result) => result && result.userId).filter(Boolean))];
  if (userIds.length === 0) return [];
  return db.prepare(`SELECT id AS userId, koala_balance AS balance FROM Users WHERE id IN (${userIds.map(() => '?').join(',')})`).all(...userIds);
}

async function applyBlackjackRoundBuyIn(entries = []) {
  const normalized = Array.isArray(entries) ? entries.filter((entry) => entry?.userId && Number(entry.amount) > 0)
    .map((entry) => ({ userId: String(entry.userId), amount: Number(entry.amount) + Math.max(0, Number(entry.sideBetAmount || 0)) })) : [];
  if (normalized.length === 0) return [];
  const amounts = new Map();
  for (const entry of normalized) amounts.set(entry.userId, (amounts.get(entry.userId) || 0) + entry.amount);
  const userIds = [...amounts.keys()];
  db.exec('BEGIN IMMEDIATE');
  try {
    const balances = new Map(db.prepare(`SELECT id, koala_balance FROM Users WHERE id IN (${userIds.map(() => '?').join(',')})`)
      .all(...userIds).map((row) => [String(row.id), Number(row.koala_balance || 0)]));
    for (const userId of userIds) {
      if (!balances.has(userId)) throw new Error('User not found.');
      if (balances.get(userId) < amounts.get(userId)) throw new Error('Not enough KoalaCoins.');
    }
    const update = db.prepare('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?');
    const transaction = db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)');
    for (const userId of userIds) {
      const amount = amounts.get(userId);
      update.run(amount, userId);
      transaction.run(userId, -amount, `Blackjack Round Buy-In (${amount})`);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return db.prepare(`SELECT id AS userId, koala_balance AS balance FROM Users WHERE id IN (${userIds.map(() => '?').join(',')})`).all(...userIds);
}

async function applyBlackjackBetDelta(userId, deltaCents = 0, reason = 'Blackjack Bet') {
  if (!userId) throw new Error('userId is required');
  const delta = Number(deltaCents || 0);
  if (!Number.isFinite(delta)) throw new Error('deltaCents must be a finite number');
  const select = db.prepare('SELECT CAST(koala_balance AS INTEGER) AS koala_balance FROM Users WHERE id = ?');
  if (delta === 0) return Number((select.get(userId) || {}).koala_balance || 0);
  db.exec('BEGIN IMMEDIATE');
  try {
    const user = select.get(userId);
    if (!user) throw new Error('User not found');
    if (delta > 0 && Number(user.koala_balance || 0) < delta) throw new Error('Not enough KoalaCoins.');
    const change = -delta;
    db.prepare('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?').run(change, userId);
    db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)').run(userId, change, reason);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return Number(select.get(userId).koala_balance);
}

async function getBlackjackLeaderboard(sortBy = 'totalWon', limit = 50) {
  const allowed = ['totalWon', 'gamesPlayed', 'blackjacksHit', 'totalWagered'];
  const column = allowed.includes(sortBy) ? sortBy : 'totalWon';
  return db.prepare(`SELECT bs.*, u.displayName, u.preferences FROM BlackjackStats bs JOIN Users u ON bs.userId=u.id ORDER BY bs.${column} DESC LIMIT ?`).all(limit);
}
const getUserBlackjackGames = async (userId) => (db.prepare('SELECT COALESCE(gamesPlayed, 0) AS gamesPlayed FROM BlackjackStats WHERE userId = ?').get(userId) || {}).gamesPlayed || 0;

module.exports = { getBlackjackStats, upsertBlackjackStats, applyBlackjackSettlement, applyBlackjackRoundBuyIn,
  applyBlackjackBetDelta, getBlackjackLeaderboard, getUserBlackjackGames };

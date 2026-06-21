const db = require('./connection');
const { logError } = require('./logging');

async function updateUserBalance(id, newBalance) {
  return Number(db.prepare('UPDATE Users SET koala_balance = ? WHERE id = ?').run(newBalance, id).changes);
}

async function getTopUsersByCoins(limit = 10) {
  return db.prepare(`
    SELECT id, displayName, username, koala_balance FROM Users
    WHERE password_hash IS NOT NULL ORDER BY koala_balance DESC LIMIT ?
  `).all(limit);
}

async function addKoalaCoins(userId, amountCents, reason) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const user = db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found');
    db.prepare('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?').run(amountCents, userId);
    db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)')
      .run(userId, amountCents, reason);
    db.exec('COMMIT');
    const updated = db.prepare('SELECT CAST(koala_balance AS INTEGER) AS koala_balance FROM Users WHERE id = ?')
      .get(userId);
    return updated ? Number(updated.koala_balance) : 0;
  } catch (error) {
    db.exec('ROLLBACK');
    logError(`addKoalaCoins failed: ${error.message}`, error.stack, JSON.stringify({ userId, amountCents, reason }))
      .catch(() => {});
    throw error;
  }
}

async function getKoalaTransactions(userId, limit = 5) {
  const queryLimit = limit === 0 || limit === '0' ? 1000 : limit;
  return db.prepare('SELECT * FROM KoalaTransactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, queryLimit);
}

async function getUserBalance(userId) {
  const row = db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId);
  return row ? row.koala_balance : 0;
}

async function getUserAchievements(userId) {
  return db.prepare('SELECT achievementId, claimedAt FROM UserAchievements WHERE userId = ?').all(userId);
}

async function claimAchievement(userId, achievementId) {
  return Number(db.prepare('INSERT INTO UserAchievements (userId, achievementId) VALUES (?, ?)')
    .run(userId, achievementId).lastInsertRowid);
}

async function getAchievementSettings() {
  return db.prepare('SELECT * FROM AchievementSettings').all();
}

async function updateAchievementSetting(achievementId, multiplier) {
  return Number(db.prepare('INSERT OR REPLACE INTO AchievementSettings (achievementId, multiplier) VALUES (?, ?)')
    .run(achievementId, multiplier).changes);
}

async function updateDailyClaimTime(userId) {
  return Number(db.prepare('UPDATE Users SET last_daily_claim = CURRENT_TIMESTAMP WHERE id = ?')
    .run(userId).changes);
}

async function getUserDailyClaim(userId) {
  const row = db.prepare('SELECT last_daily_claim FROM Users WHERE id = ?').get(userId);
  return row ? row.last_daily_claim : null;
}

async function checkDailyMission(userId, missionId) {
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare('SELECT last_completed_at FROM UserMissions WHERE userId = ? AND mission_id = ?')
    .get(userId, missionId);
  return Boolean(row && row.last_completed_at && row.last_completed_at.startsWith(today));
}

async function completeDailyMission(userId, missionId, rewardCents) {
  const today = new Date().toISOString().split('T')[0];
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO UserMissions (userId, mission_id, last_completed_at) VALUES (?, ?, ?)
      ON CONFLICT(userId, mission_id) DO UPDATE SET last_completed_at = ?
    `).run(userId, missionId, today, today);
    const update = db.prepare('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?')
      .run(rewardCents, userId);
    if (Number(update.changes) !== 1) throw new Error('User not found');
    db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)')
      .run(userId, rewardCents, `Daily Mission: ${missionId}`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

async function getUserUpgrades(userId) {
  return db.prepare(`
    SELECT uu.upgrade_id, uu.current_level, config.display_name, config.base_price,
      config.price_step, config.max_level, config.description
    FROM UserUpgrades uu
    JOIN GameUpgrades_Config config ON uu.upgrade_id = config.upgrade_id
    WHERE uu.userId = ?
  `).all(userId);
}

async function getUserTotalSpent(userId) {
  const row = db.prepare(`
    SELECT COALESCE(ABS(SUM(amount)), 0) AS total
    FROM KoalaTransactions WHERE user_id = ? AND amount < 0
  `).get(userId);
  return row ? row.total : 0;
}

module.exports = {
  updateUserBalance,
  getTopUsersByCoins,
  addKoalaCoins,
  getKoalaTransactions,
  getUserBalance,
  getUserAchievements,
  claimAchievement,
  getAchievementSettings,
  updateAchievementSetting,
  updateDailyClaimTime,
  getUserDailyClaim,
  checkDailyMission,
  completeDailyMission,
  getUserUpgrades,
  getUserTotalSpent
};

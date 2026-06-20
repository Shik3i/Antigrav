const db = require('../connection');

const getGameUpgradesConfig = async () => db.prepare('SELECT * FROM GameUpgrades_Config ORDER BY category ASC').all();

async function purchaseUpgrade(userId, upgradeId, price) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const user = db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId);
    if (!user || user.koala_balance < price) throw new Error('Insufficient balance');
    db.prepare('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?').run(price, userId);
    db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)')
      .run(userId, -price, `Purchase Upgrade: ${upgradeId}`);
    db.prepare(`
      INSERT INTO UserUpgrades (userId, upgrade_id, current_level) VALUES (?, ?, 1)
      ON CONFLICT(userId, upgrade_id) DO UPDATE SET current_level = current_level + 1
    `).run(userId, upgradeId);
    db.exec('COMMIT');
    return { success: true };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

const getLeaderboardSettings = async () => db.prepare('SELECT * FROM LeaderboardSettings').all();

async function updateLeaderboardSetting(gameId, isHidden) {
  return Number(db.prepare(`
    INSERT INTO LeaderboardSettings (game_id, is_hidden) VALUES (?, ?)
    ON CONFLICT(game_id) DO UPDATE SET is_hidden = excluded.is_hidden
  `).run(gameId, isHidden ? 1 : 0).changes);
}

module.exports = { getGameUpgradesConfig, purchaseUpgrade, getLeaderboardSettings, updateLeaderboardSetting };

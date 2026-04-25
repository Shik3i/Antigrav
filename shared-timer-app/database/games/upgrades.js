const db = require('../connection');

const getGameUpgradesConfig = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM GameUpgrades_Config ORDER BY category ASC', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const purchaseUpgrade = (userId, upgradeId, price) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (err, user) => {
        if (err || !user || user.koala_balance < price) {
          db.run('ROLLBACK');
          return reject(err || new Error('Insufficient balance'));
        }
        db.run('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?', [price, userId]);
        db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, -price, `Purchase Upgrade: ${upgradeId}`]);
        db.run(
          'INSERT INTO UserUpgrades (userId, upgrade_id, current_level) VALUES (?, ?, 1) ON CONFLICT(userId, upgrade_id) DO UPDATE SET current_level = current_level + 1',
          [userId, upgradeId],
          function (err) {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
            db.run('COMMIT', (err) => err ? reject(err) : resolve({ success: true }));
          }
        );
      });
    });
  });
};

const getLeaderboardSettings = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM LeaderboardSettings', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const updateLeaderboardSetting = (gameId, isHidden) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO LeaderboardSettings (game_id, is_hidden)
      VALUES (?, ?)
      ON CONFLICT(game_id) DO UPDATE SET is_hidden = excluded.is_hidden
    `;
    db.run(query, [gameId, isHidden ? 1 : 0], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

module.exports = {
  getGameUpgradesConfig,
  purchaseUpgrade,
  getLeaderboardSettings,
  updateLeaderboardSetting,
};

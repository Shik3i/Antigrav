const db = require('./connection');
const { logError, logSystemEvent } = require('./logging');

/**
 * Economy and Progression Logic
 */

const updateUserBalance = (id, newBalance) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Users SET koala_balance = ? WHERE id = ?', [newBalance, id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getTopUsersByCoins = (limit = 10) => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT id, displayName, username, koala_balance 
      FROM Users 
      WHERE password_hash IS NOT NULL 
      ORDER BY koala_balance DESC 
      LIMIT ?
    `, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const addKoalaCoins = (userId, amountCents, reason) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(`UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?`, [amountCents, userId], function (err) {
        if (err) {
          logError(`addKoalaCoins: Update user failed: ${err.message}`, err.stack, JSON.stringify({ userId, amountCents, reason }));
          return db.run('ROLLBACK', () => reject(err));
        }
      });
      db.run(`INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)`, [userId, amountCents, reason], function (err) {
        if (err) {
          logError(`addKoalaCoins: Insert transaction failed: ${err.message}`, err.stack, JSON.stringify({ userId, amountCents, reason }));
          return db.run('ROLLBACK', () => reject(err));
        }
      });
      db.run('COMMIT', (err) => {
        if (err) {
          logError(`addKoalaCoins: Commit failed: ${err.message}`, err.stack, JSON.stringify({ userId, amountCents, reason }));
          return reject(err);
        }
        // Return the new balance as a plain JS Number
        db.get(`SELECT CAST(koala_balance AS INTEGER) AS koala_balance FROM Users WHERE id = ?`, [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row ? Number(row.koala_balance) : 0);
        });
      });
    });
  });
};

const getKoalaTransactions = (userId, limit = 5) => {
  const queryLimit = (limit === 0 || limit === "0") ? 100 : limit;
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM KoalaTransactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`, [userId, queryLimit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getUserBalance = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.koala_balance : 0);
    });
  });
};

const getUserAchievements = (userId) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT achievementId, claimedAt FROM UserAchievements WHERE userId = ?`, [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const claimAchievement = (userId, achievementId) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO UserAchievements (userId, achievementId) VALUES (?, ?)`, [userId, achievementId], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

const getAchievementSettings = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM AchievementSettings', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const updateAchievementSetting = (achievementId, multiplier) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR REPLACE INTO AchievementSettings (achievementId, multiplier) VALUES (?, ?)', 
      [achievementId, multiplier], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateDailyClaimTime = (userId) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE Users SET last_daily_claim = CURRENT_TIMESTAMP WHERE id = ?`, [userId], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getUserDailyClaim = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT last_daily_claim FROM Users WHERE id = ?`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.last_daily_claim : null);
    });
  });
};

function checkDailyMission(userId, missionId) {
  const today = new Date().toISOString().split('T')[0];
  return new Promise((resolve, reject) => {
    db.get('SELECT last_completed_at FROM UserMissions WHERE userId = ? AND mission_id = ?', [userId, missionId], (err, row) => {
      if (err) return reject(err);
      if (row && row.last_completed_at && row.last_completed_at.startsWith(today)) resolve(true);
      else resolve(false);
    });
  });
}

function completeDailyMission(userId, missionId, rewardCents) {
  const today = new Date().toISOString().split('T')[0];
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run('INSERT INTO UserMissions (userId, mission_id, last_completed_at) VALUES (?, ?, ?) ON CONFLICT(userId, mission_id) DO UPDATE SET last_completed_at = ?', 
        [userId, missionId, today, today], (err) => {
        if (err) return db.run('ROLLBACK', () => reject(err));
        
        db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [rewardCents, userId], (err) => {
          if (err) return db.run('ROLLBACK', () => reject(err));
          
          db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', 
            [userId, rewardCents, `Daily Mission: ${missionId}`], (err) => {
            if (err) return db.run('ROLLBACK', () => reject(err));
            
            db.run('COMMIT', (err) => err ? reject(err) : resolve());
          });
        });
      });
    });
  });
}

const getUserUpgrades = (userId) => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT uu.upgrade_id, uu.current_level, config.display_name, config.base_price, config.price_step, config.max_level, config.description
      FROM UserUpgrades uu
      JOIN GameUpgrades_Config config ON uu.upgrade_id = config.upgrade_id
      WHERE uu.userId = ?
    `, [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getUserTotalSpent = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COALESCE(ABS(SUM(amount)), 0) as total FROM KoalaTransactions WHERE user_id = ? AND amount < 0', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.total : 0);
    });
  });
};

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

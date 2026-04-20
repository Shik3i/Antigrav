const db = require('./connection');

/**
 * Core User Management Functions
 */

const addUser = (id, displayName) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO Users (id, displayName) VALUES (?, ?)', [id, displayName], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateUserName = (id, displayName) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Users SET displayName = ? WHERE id = ?', [displayName, id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getUser = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getUserById = getUser;

const registerUser = (id, displayName, username, passwordHash) => {
  return new Promise((resolve, reject) => {
    getKoalaBaseline().then(settings => {
      const startingCoins = settings.koala_start_coins !== undefined ? settings.koala_start_coins : 10000;
      db.run(
        'INSERT INTO Users (id, displayName, username, password_hash, preferences, koala_balance) VALUES (?, ?, ?, ?, ?, ?)',
        [id, displayName, username, passwordHash, '{}', startingCoins],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    }).catch(reject);
  });
};

const getUserByUsername = (username) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Users WHERE username = ? COLLATE NOCASE', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getAllRegisteredUsers = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        u.id, 
        u.displayName, 
        u.username, 
        u.is_superadmin, 
        u.createdAt, 
        u.lastActive,
        CAST(u.koala_balance AS INTEGER) AS koala_balance,
        CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END as is_banned,
        CASE WHEN u.password_hash IS NULL THEN 1 ELSE 0 END as is_guest
      FROM Users u
      LEFT JOIN BannedUsers b ON u.id = b.id
      ORDER BY u.createdAt DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve((rows || []).map(r => ({ ...r, koala_balance: Number(r.koala_balance || 0) })));
    });
  });
};

const updateUserLastActive = (id) => {
  return new Promise((resolve, reject) => {
    db.run("UPDATE Users SET lastActive = CURRENT_TIMESTAMP WHERE id = ?", [id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateUserPreferences = (id, preferences) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Users SET preferences = ? WHERE id = ?', [JSON.stringify(preferences), id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateUserPassword = (id, newPasswordHash) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Users SET password_hash = ? WHERE id = ?', [newPasswordHash, id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateUserRole = (id, isSuperadmin) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Users SET is_superadmin = ? WHERE id = ?', [isSuperadmin ? 1 : 0, id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const deleteUserAdmin = (id) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Manually clean up tables without schema-level ON DELETE CASCADE
      db.run('DELETE FROM Friends WHERE userId = ? OR friendId = ?', [id, id], (err) => {
        if (err) console.error("Error deleting Friends:", err);
      });
      db.run('DELETE FROM TimerEvents WHERE userId = ?', [id], (err) => {
        if (err) console.error("Error deleting TimerEvents:", err);
      });
      db.run('DELETE FROM KoalaTransactions WHERE user_id = ?', [id], (err) => {
        if (err) console.error("Error deleting KoalaTransactions:", err);
      });
      db.run('DELETE FROM BannedUsers WHERE id = ?', [id], (err) => {
        if (err) console.error("Error deleting BannedUsers:", err);
      });
      db.run('DELETE FROM UserAchievements WHERE userId = ?', [id], (err) => {
        if (err) console.error("Error deleting UserAchievements:", err);
      });
      db.run('DELETE FROM Bets WHERE userId = ?', [id], (err) => {
        if (err) console.error("Error deleting Bets:", err);
      });
      db.run('DELETE FROM GameScores WHERE userId = ?', [id], (err) => {
        if (err) console.error("Error deleting GameScores:", err);
      });
      db.run('DELETE FROM UserUpgrades WHERE userId = ?', [id], (err) => {
        if (err) console.error("Error deleting UserUpgrades:", err);
      });
      db.run('DELETE FROM UserMissions WHERE userId = ?', [id], (err) => {
        if (err) console.error("Error deleting UserMissions:", err);
      });
      db.run('DELETE FROM Scratchcards WHERE userId = ?', [id], (err) => {
        if (err) console.error("Error deleting Scratchcards:", err);
      });
      db.run('DELETE FROM Countdowns WHERE userId = ?', [id], (err) => {
        if (err) console.error("Error deleting Countdowns:", err);
      });
      db.run('DELETE FROM FeatureRequests WHERE userId = ?', [id], (err) => {
        if (err) console.error("Error deleting FeatureRequests:", err);
      });
      db.run('DELETE FROM FeatureVotes WHERE userId = ?', [id], (err) => {
        if (err) console.error("Error deleting FeatureVotes:", err);
      });

      // 2. Finally delete the user-record (schema-level CASCADE will handle others)
      db.run('DELETE FROM Users WHERE id = ?', [id], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  });
};

const banUser = (userId, username, reason) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO BannedUsers (id, username, reason) VALUES (?, ?, ?)', [userId, username, reason || null], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const unbanUser = (userId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM BannedUsers WHERE id = ?', [userId], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const checkIsBanned = (username) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM BannedUsers WHERE username = ? COLLATE NOCASE', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getBannedUsersList = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM BannedUsers ORDER BY bannedAt DESC', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

/**
 * Settings related to user initialization (temporary location)
 */
const mergeGuestStats = (newUserId, targetUsername) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Find all guest accounts that have this username (either exactly or as _guest_xyz...)
      // But only if they were actually guests (password_hash is null)
      const guestQuery = `SELECT id FROM Users WHERE (username = ? OR username LIKE ? OR displayName = ?) AND password_hash IS NULL`;

      db.all(guestQuery, [targetUsername, `_guest_%_${targetUsername}`, targetUsername], (err, guestRows) => {
        if (err) return reject(err);
        if (!guestRows || guestRows.length === 0) return resolve(0);

        const guestIds = guestRows.map(r => r.id);
        const placeholders = guestIds.map(() => '?').join(',');

        // 1. Move all timer completions from those guests to the newly registered user
        db.run(`UPDATE TimerEvents SET userId = ? WHERE userId IN (${placeholders})`, [newUserId, ...guestIds], function (updateErr) {
          if (updateErr) return reject(updateErr);

          // 2. Move all private countdowns from those guests to the newly registered user
          db.run(`UPDATE Countdowns SET userId = ? WHERE userId IN (${placeholders})`, [newUserId, ...guestIds], function (countErr) {
            if (countErr) return reject(countErr);

            // 3. Delete the old guest accounts so they don't clutter the highscores
            db.run(`DELETE FROM Users WHERE id IN (${placeholders})`, [...guestIds], function (delErr) {
              if (delErr) return reject(delErr);
              resolve(guestIds.length);
            });
          });
        });
      });
    });
  });
};

const getKoalaBaseline = () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT key, value FROM ServerSettings WHERE key IN ('koala_points_per_hour', 'koala_start_coins', 'koala_coin_conversion_rate', 'koala_daily_mission_multiplier', 'achievement_reward_multiplier')`, (err, rows) => {
      if (err) reject(err);
      else {
        const settings = { koala_points_per_hour: 1000, koala_start_coins: 10000, koala_coin_conversion_rate: 0.01, koala_daily_mission_multiplier: 1.0, achievement_reward_multiplier: 2.5 };
        if (rows) {
          rows.forEach(r => {
            if (r.key === 'koala_coin_conversion_rate' || r.key === 'koala_daily_mission_multiplier' || r.key === 'achievement_reward_multiplier') settings[r.key] = parseFloat(r.value);
            else settings[r.key] = parseInt(r.value, 10);
          });
        }
        resolve(settings);
      }
    });
  });
};

const updateKoalaBaseline = (settings) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (settings.koala_points_per_hour !== undefined) {
        await new Promise((res, rej) => db.run(`UPDATE ServerSettings SET value = ? WHERE key = 'koala_points_per_hour'`, [String(settings.koala_points_per_hour)], err => err ? rej(err) : res()));
      }
      if (settings.koala_start_coins !== undefined) {
        await new Promise((res, rej) => db.run(`INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('koala_start_coins', ?)`, [String(settings.koala_start_coins)], err => err ? rej(err) : res()));
      }
      if (settings.koala_coin_conversion_rate !== undefined) {
        await new Promise((res, rej) => db.run(`INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('koala_coin_conversion_rate', ?)`, [String(settings.koala_coin_conversion_rate)], err => err ? rej(err) : res()));
      }
      if (settings.koala_daily_mission_multiplier !== undefined) {
        await new Promise((res, rej) => db.run(`INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('koala_daily_mission_multiplier', ?)`, [String(settings.koala_daily_mission_multiplier)], err => err ? rej(err) : res()));
      }
      if (settings.achievement_reward_multiplier !== undefined) {
        await new Promise((res, rej) => db.run(`INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('achievement_reward_multiplier', ?)`, [String(settings.achievement_reward_multiplier)], err => err ? rej(err) : res()));
      }
      resolve(true);
    } catch (e) {
      reject(e);
    }
  });
};

module.exports = {
  addUser,
  updateUserName,
  getUser,
  getUserById,
  registerUser,
  getUserByUsername,
  getAllRegisteredUsers,
  updateUserLastActive,
  updateUserPreferences,
  updateUserPassword,
  updateUserRole,
  deleteUserAdmin,
  banUser,
  unbanUser,
  checkIsBanned,
  getBannedUsersList,
  mergeGuestStats,
  getKoalaBaseline,
  updateKoalaBaseline
};

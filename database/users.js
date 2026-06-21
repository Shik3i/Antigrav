const db = require('./connection');

async function addUser(id, displayName) {
  return Number(db.prepare('INSERT OR IGNORE INTO Users (id, displayName) VALUES (?, ?)')
    .run(id, displayName).changes);
}

async function updateUserName(id, displayName) {
  return Number(db.prepare('UPDATE Users SET displayName = ? WHERE id = ?').run(displayName, id).changes);
}

async function getUser(id) {
  return db.prepare('SELECT * FROM Users WHERE id = ?').get(id);
}

const getUserById = getUser;

async function registerUser(id, displayName, username, passwordHash) {
  const settings = await getKoalaBaseline();
  const startingCoins = settings.koala_start_coins !== undefined ? settings.koala_start_coins : 10000;
  const result = db.prepare(`
    INSERT INTO Users (id, displayName, username, password_hash, preferences, koala_balance)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, displayName, username, passwordHash, '{}', startingCoins);
  return Number(result.changes);
}

async function getUserByUsername(username) {
  return db.prepare('SELECT * FROM Users WHERE username = ? COLLATE NOCASE').get(username);
}

async function getAllRegisteredUsers() {
  return db.prepare(`
    SELECT u.id, u.displayName, u.username, u.is_superadmin, u.createdAt, u.lastActive,
      CAST(u.koala_balance AS INTEGER) AS koala_balance,
      CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END AS is_banned,
      CASE WHEN u.password_hash IS NULL THEN 1 ELSE 0 END AS is_guest
    FROM Users u
    LEFT JOIN BannedUsers b ON u.id = b.id
    ORDER BY u.createdAt DESC
  `).all().map((row) => ({ ...row, koala_balance: Number(row.koala_balance || 0) }));
}

async function updateUserLastActive(id) {
  return Number(db.prepare('UPDATE Users SET lastActive = CURRENT_TIMESTAMP WHERE id = ?').run(id).changes);
}

async function updateUserPreferences(id, preferences) {
  return Number(db.prepare('UPDATE Users SET preferences = ? WHERE id = ?')
    .run(JSON.stringify(preferences), id).changes);
}

async function updateUserPassword(id, newPasswordHash) {
  return Number(db.prepare('UPDATE Users SET password_hash = ? WHERE id = ?').run(newPasswordHash, id).changes);
}

async function updateUserRole(id, isSuperadmin) {
  return Number(db.prepare('UPDATE Users SET is_superadmin = ? WHERE id = ?')
    .run(isSuperadmin ? 1 : 0, id).changes);
}

async function deleteUserAdmin(id) {
  const cleanupStatements = [
    ['DELETE FROM Friends WHERE userId = ? OR friendId = ?', [id, id]],
    ['DELETE FROM TimerEvents WHERE userId = ?', [id]],
    ['DELETE FROM KoalaTransactions WHERE user_id = ?', [id]],
    ['DELETE FROM BannedUsers WHERE id = ?', [id]],
    ['DELETE FROM UserAchievements WHERE userId = ?', [id]],
    ['DELETE FROM Bets WHERE userId = ?', [id]],
    ['DELETE FROM GameScores WHERE userId = ?', [id]],
    ['DELETE FROM UserUpgrades WHERE userId = ?', [id]],
    ['DELETE FROM UserMissions WHERE userId = ?', [id]],
    ['DELETE FROM Scratchcards WHERE userId = ?', [id]],
    ['DELETE FROM Countdowns WHERE userId = ?', [id]],
    ['DELETE FROM FeatureVotes WHERE userId = ?', [id]],
    ['DELETE FROM FeatureRequests WHERE userId = ?', [id]]
  ];
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const [sql, params] of cleanupStatements) db.prepare(sql).run(...params);
    const result = db.prepare('DELETE FROM Users WHERE id = ?').run(id);
    db.exec('COMMIT');
    return Number(result.changes);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

async function banUser(userId, username, reason) {
  return Number(db.prepare('INSERT INTO BannedUsers (id, username, reason) VALUES (?, ?, ?)')
    .run(userId, username, reason || null).changes);
}

async function unbanUser(userId) {
  return Number(db.prepare('DELETE FROM BannedUsers WHERE id = ?').run(userId).changes);
}

async function checkIsBanned(username) {
  return db.prepare('SELECT * FROM BannedUsers WHERE username = ? COLLATE NOCASE').get(username);
}

async function getBannedUsersList() {
  return db.prepare('SELECT * FROM BannedUsers ORDER BY bannedAt DESC').all();
}

async function mergeGuestStats(newUserId, targetUsername) {
  const guestRows = db.prepare(`
    SELECT id FROM Users
    WHERE (username = ? OR username LIKE ? OR displayName = ?) AND password_hash IS NULL
  `).all(targetUsername, `_guest_%_${targetUsername}`, targetUsername);
  if (guestRows.length === 0) return 0;

  const guestIds = guestRows.map((row) => row.id);
  const placeholders = guestIds.map(() => '?').join(',');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE TimerEvents SET userId = ? WHERE userId IN (${placeholders})`)
      .run(newUserId, ...guestIds);
    db.prepare(`UPDATE Countdowns SET userId = ? WHERE userId IN (${placeholders})`)
      .run(newUserId, ...guestIds);
    db.prepare(`DELETE FROM Users WHERE id IN (${placeholders})`).run(...guestIds);
    db.exec('COMMIT');
    return guestIds.length;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

async function getKoalaBaseline() {
  const settings = {
    koala_points_per_hour: 1000,
    koala_start_coins: 10000,
    koala_coin_conversion_rate: 0.01,
    koala_daily_mission_multiplier: 1.0,
    achievement_reward_multiplier: 2.5
  };
  const rows = db.prepare(`
    SELECT key, value FROM ServerSettings
    WHERE key IN ('koala_points_per_hour', 'koala_start_coins', 'koala_coin_conversion_rate',
      'koala_daily_mission_multiplier', 'achievement_reward_multiplier')
  `).all();
  for (const row of rows) {
    if (['koala_coin_conversion_rate', 'koala_daily_mission_multiplier', 'achievement_reward_multiplier'].includes(row.key)) {
      settings[row.key] = parseFloat(row.value);
    } else {
      settings[row.key] = parseInt(row.value, 10);
    }
  }
  return settings;
}

async function updateKoalaBaseline(settings) {
  const upsert = db.prepare('INSERT OR REPLACE INTO ServerSettings (key, value) VALUES (?, ?)');
  const keys = [
    'koala_points_per_hour',
    'koala_start_coins',
    'koala_coin_conversion_rate',
    'koala_daily_mission_multiplier',
    'achievement_reward_multiplier'
  ];
  for (const key of keys) {
    if (settings[key] !== undefined) upsert.run(key, String(settings[key]));
  }
  return true;
}

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

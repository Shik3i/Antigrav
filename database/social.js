const db = require('./connection');

async function addFriend(userId, friendId, status = 'pending') {
  // Check if friendship already exists in either direction
  const existing = db.prepare(`
    SELECT 1 FROM Friends
    WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)
  `).get(userId, friendId, friendId, userId);

  if (existing) {
    // Friendship already exists, update the status
    const result = db.prepare(`
      UPDATE Friends
      SET status = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)
    `).run(status, userId, friendId, friendId, userId);
    return Number(result.changes);
  } else {
    // Create new friendship entry
    const result = db.prepare(`
      INSERT INTO Friends (userId, friendId, status) VALUES (?, ?, ?)
    `).run(userId, friendId, status);
    return Number(result.changes);
  }
}

async function removeFriend(userId, friendId) {
  const result = db.prepare(`
    DELETE FROM Friends
    WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)
  `).run(userId, friendId, friendId, userId);
  return Number(result.changes);
}

const friendsQuery = `
  SELECT f.status, f.userId AS requesterId, f.friendId AS targetId,
    u.id, u.displayName, u.username
  FROM Friends f
  JOIN Users u ON u.id = f.friendId
  WHERE f.userId = ? AND (f.status = 'accepted' OR f.status = 'pending')
  UNION
  SELECT f.status, f.userId AS requesterId, f.friendId AS targetId,
    u.id, u.displayName, u.username
  FROM Friends f
  JOIN Users u ON u.id = f.userId
  WHERE f.friendId = ? AND (f.status = 'accepted' OR f.status = 'pending')
`;

function getFriends(userId) {
  return db.prepare(friendsQuery).all(userId, userId);
}

async function getFriendStatus(userId, friendId) {
  return db.prepare(`
    SELECT status, userId AS requesterId FROM Friends
    WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)
  `).get(userId, friendId, friendId, userId);
}

async function getAdminFriends(userId) {
  return db.prepare(friendsQuery).all(userId, userId);
}

async function getUserByUsername(username) {
  return db.prepare('SELECT id, displayName, username, password_hash FROM Users WHERE username = ?').get(username);
}

async function getUserFriendCount(userId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count FROM Friends
    WHERE (userId = ? OR friendId = ?) AND status = 'accepted'
  `).get(userId, userId);
  return row ? row.count : 0;
}

async function getMutualPendingRequest(userId, friendId) {
  // Check if there's a pending request in the opposite direction
  const result = db.prepare(`
    SELECT status, userId AS requesterId FROM Friends
    WHERE userId = ? AND friendId = ? AND status = 'pending'
  `).get(friendId, userId);
  return result;
}

// Blocked Users functions
async function blockUser(blockerId, blockedId) {
  const result = db.prepare(`
    INSERT INTO BlockedUsers (blockerId, blockedId)
    VALUES (?, ?)
  `).run(blockerId, blockedId);
  return Number(result.changes);
}

async function unblockUser(blockerId, blockedId) {
  const result = db.prepare(`
    DELETE FROM BlockedUsers
    WHERE blockerId = ? AND blockedId = ?
  `).run(blockerId, blockedId);
  return Number(result.changes);
}

async function getBlockedUsers(userId) {
  return db.prepare(`
    SELECT u.id, u.displayName, u.username
    FROM BlockedUsers b
    JOIN Users u ON u.id = b.blockedId
    WHERE b.blockerId = ?
  `).all(userId);
}

async function isUserBlocked(blockerId, blockedId) {
  return db.prepare(`
    SELECT 1 FROM BlockedUsers
    WHERE blockerId = ? AND blockedId = ?
  `).get(blockerId, blockedId);
}

module.exports = {
  addFriend,
  removeFriend,
  getFriends,
  getFriendStatus,
  getAdminFriends,
  getUserFriendCount,
  getUserByUsername,
  getMutualPendingRequest,
  blockUser,
  unblockUser,
  getBlockedUsers,
  isUserBlocked,
  friendsQuery
};

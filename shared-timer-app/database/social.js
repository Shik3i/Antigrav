const db = require('./connection');

async function addFriend(userId, friendId, status = 'pending') {
  const result = db.prepare(`
    INSERT INTO Friends (userId, friendId, status) VALUES (?, ?, ?)
    ON CONFLICT(userId, friendId) DO UPDATE SET status = ?, updatedAt = CURRENT_TIMESTAMP
  `).run(userId, friendId, status, status);
  return Number(result.changes);
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
  WHERE f.userId = ?
  UNION ALL
  SELECT f.status, f.userId AS requesterId, f.friendId AS targetId,
    u.id, u.displayName, u.username
  FROM Friends f
  JOIN Users u ON u.id = f.userId
  WHERE f.friendId = ?
`;

async function getFriends(userId) {
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

async function getUserFriendCount(userId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count FROM Friends
    WHERE (userId = ? OR friendId = ?) AND status = 'accepted'
  `).get(userId, userId);
  return row ? row.count : 0;
}

module.exports = {
  addFriend,
  removeFriend,
  getFriends,
  getFriendStatus,
  getAdminFriends,
  getUserFriendCount
};

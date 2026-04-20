const db = require('./connection');

/**
 * Social and Friends Domain
 */

const addFriend = (userId, friendId, status = 'pending') => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO Friends (userId, friendId, status) VALUES (?, ?, ?) ON CONFLICT(userId, friendId) DO UPDATE SET status=?, updatedAt=CURRENT_TIMESTAMP',
      [userId, friendId, status, status],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

const removeFriend = (userId, friendId) => {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM Friends WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)',
      [userId, friendId, friendId, userId],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

const getFriends = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        f.status,
        f.userId as requesterId,
        f.friendId as targetId,
        u.id as id,
        u.displayName,
        u.username
      FROM Friends f
      JOIN Users u ON u.id = f.friendId
      WHERE f.userId = ?
      UNION ALL
      SELECT
        f.status,
        f.userId as requesterId,
        f.friendId as targetId,
        u.id as id,
        u.displayName,
        u.username
      FROM Friends f
      JOIN Users u ON u.id = f.userId
      WHERE f.friendId = ?
    `;
    db.all(query, [userId, userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getFriendStatus = (userId, friendId) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT status, userId as requesterId FROM Friends WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)',
      [userId, friendId, friendId, userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

const getAdminFriends = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        f.status,
        f.userId as requesterId,
        f.friendId as targetId,
        u.id as id,
        u.displayName,
        u.username
      FROM Friends f
      JOIN Users u ON u.id = f.friendId
      WHERE f.userId = ?
      UNION ALL
      SELECT
        f.status,
        f.userId as requesterId,
        f.friendId as targetId,
        u.id as id,
        u.displayName,
        u.username
      FROM Friends f
      JOIN Users u ON u.id = f.userId
      WHERE f.friendId = ?
    `;
    db.all(query, [userId, userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getUserFriendCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM Friends WHERE (userId = ? OR friendId = ?) AND status = 'accepted'", [userId, userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });
};

module.exports = {
  addFriend,
  removeFriend,
  getFriends,
  getFriendStatus,
  getAdminFriends,
  getUserFriendCount
};

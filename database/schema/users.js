const { addColumn } = require('./utils');

function initializeUsersSchema(database) {
    // Users: stores local identity name and optional local account details
    database.exec(`CREATE TABLE IF NOT EXISTS Users (
      id TEXT PRIMARY KEY,
      displayName TEXT NOT NULL,
      username TEXT UNIQUE,
      password_hash TEXT,
      preferences TEXT,
      is_superadmin BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastActive DATETIME
    )`);

    // Migration for existing Users table
    addColumn(database, 'Users', 'username', 'TEXT');
    addColumn(database, 'Users', 'password_hash', 'TEXT');
    addColumn(database, 'Users', 'preferences', 'TEXT');
    addColumn(database, 'Users', 'is_superadmin', 'BOOLEAN DEFAULT 0');
    addColumn(database, 'Users', 'lastActive', 'DATETIME');
    addColumn(database, 'Users', 'koala_balance', 'INTEGER DEFAULT 0');
    addColumn(database, 'Users', 'last_daily_claim', 'DATETIME');
    database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON Users(username)');

    // BannedUsers: stores banned accounts
    database.exec(`CREATE TABLE IF NOT EXISTS BannedUsers (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      reason TEXT,
      bannedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(id) REFERENCES Users(id)
    )`);

    // Friends: stores friendship connections
    database.exec(`CREATE TABLE IF NOT EXISTS Friends (
      userId TEXT,
      friendId TEXT,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (userId, friendId),
      FOREIGN KEY(userId) REFERENCES Users(id),
      FOREIGN KEY(friendId) REFERENCES Users(id)
    )`);
    database.exec('CREATE INDEX IF NOT EXISTS idx_friends_friendId ON Friends(friendId)');

    // BlockedUsers: stores blocked user relationships
    database.exec(`CREATE TABLE IF NOT EXISTS BlockedUsers (
      blockerId TEXT NOT NULL,
      blockedId TEXT NOT NULL,
      blockedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (blockerId, blockedId),
      FOREIGN KEY(blockerId) REFERENCES Users(id),
      FOREIGN KEY(blockedId) REFERENCES Users(id)
    )`);
    database.exec('CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON BlockedUsers(blockerId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON BlockedUsers(blockedId)');
}

module.exports = {
    initializeUsersSchema
};
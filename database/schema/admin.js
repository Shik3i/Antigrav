const { addColumn } = require('./utils');

function initializeAdminSchema(database) {
    // AdminActions: tracks admin actions
    database.exec(`CREATE TABLE IF NOT EXISTS AdminActions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adminId TEXT NOT NULL,
      adminName TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // FeatureRequests: stores user feature requests
    database.exec(`CREATE TABLE IF NOT EXISTS FeatureRequests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'Pending Review',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      adminComment TEXT
    )`);

    // Migration: Add adminComment to FeatureRequests
    addColumn(database, 'FeatureRequests', 'adminComment', 'TEXT');
    addColumn(database, 'FeatureRequests', 'type', "TEXT DEFAULT 'Feature'");

    // FeatureVotes: stores votes on feature requests
    database.exec(`CREATE TABLE IF NOT EXISTS FeatureVotes (
      requestId INTEGER NOT NULL,
      userId TEXT NOT NULL,
      value INTEGER NOT NULL,
      PRIMARY KEY (requestId, userId),
      FOREIGN KEY(requestId) REFERENCES FeatureRequests(id) ON DELETE CASCADE
    )`);

    // ErrorLogs: persistent storage for server-side errors
    database.exec(`CREATE TABLE IF NOT EXISTS ErrorLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      stack TEXT,
      context TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // SystemLogs: dedicated table for info/warn logs with 24h retention
    database.exec(`CREATE TABLE IF NOT EXISTS SystemLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT,
      context TEXT,
      message TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON AdminActions(timestamp)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_features_status ON FeatureRequests(status)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON ErrorLogs(timestamp)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_system_logs_createdAt ON SystemLogs(createdAt)');
}

module.exports = {
    initializeAdminSchema
};

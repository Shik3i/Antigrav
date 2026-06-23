const { addColumn } = require('./utils');

function initializeAchievementsSchema(database) {
    // UserAchievements: stores claimed milestone achievements and daily claims
    database.exec(`CREATE TABLE IF NOT EXISTS UserAchievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      achievementId TEXT NOT NULL,
      claimedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id),
      UNIQUE(userId, achievementId)
    )`);

    // AchievementSettings: stores per-achievement multipliers
    database.exec(`CREATE TABLE IF NOT EXISTS AchievementSettings (
      achievementId TEXT PRIMARY KEY,
      multiplier REAL DEFAULT 1.0
    )`);
}

module.exports = {
    initializeAchievementsSchema
};
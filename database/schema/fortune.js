const { addColumn } = require('./utils');

function initializeFortuneSchema(database) {
    // --- Daily Fortune Cookie ---
    database.exec(`CREATE TABLE IF NOT EXISTS fortunes_dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT UNIQUE NOT NULL
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS user_fortunes_history (
      user_id TEXT NOT NULL,
      fortune_id INTEGER,
      opened_date TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
      UNIQUE(user_id, opened_date)
    )`);
}

module.exports = {
    initializeFortuneSchema
};
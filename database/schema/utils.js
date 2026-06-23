const db = require('../connection');
const path = require('node:path');
const fs = require('node:fs');

function hasColumn(database, table, column) {
  return database.prepare(`PRAGMA table_info(${table})`).all()
    .some((candidate) => candidate.name === column);
}

function addColumn(database, table, column, definition) {
  if (!hasColumn(database, table, column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Wordle 2.0: Seeds the dictionary from JSON if empty and syncs with history
 */
function seedWordleDictionary(database) {
  const row = database.prepare('SELECT COUNT(*) AS count FROM wordle_dictionary').get();
  if (row && row.count > 0) return;

  const listPath = path.join(__dirname, '..', '..', 'WordleWordList.json');
  if (!fs.existsSync(listPath)) {
    console.warn('[Wordle Migration] WordleWordList.json not found. Skipping seed.');
    return;
  }

  const jsonData = JSON.parse(fs.readFileSync(listPath, 'utf8'));
  if (!jsonData || !Array.isArray(jsonData.data)) return;

  const words = [...new Set(jsonData.data.map((word) => word.trim().toUpperCase()).filter((word) => word.length === 5))];
  const insert = database.prepare('INSERT OR IGNORE INTO wordle_dictionary (word) VALUES (?)');

  database.exec('BEGIN IMMEDIATE');
  try {
    for (const word of words) insert.run(word);
    database.exec(`
      UPDATE wordle_dictionary
      SET is_used = 1,
          used_at = (SELECT createdAt FROM Wordle_DailyWords WHERE Wordle_DailyWords.word = wordle_dictionary.word LIMIT 1)
      WHERE word IN (SELECT word FROM Wordle_DailyWords)
    `);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

module.exports = {
  hasColumn,
  addColumn,
  seedWordleDictionary
};
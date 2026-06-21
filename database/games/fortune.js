const db = require('../connection');

const getFortuneStatus = async (userId, date) => db.prepare(`
  SELECT h.*, d.text FROM user_fortunes_history h
  LEFT JOIN fortunes_dictionary d ON h.fortune_id = d.id
  WHERE h.user_id = ? AND h.opened_date = ?
`).get(userId, date);

async function openDailyFortune(userId, date) {
  const fortune = db.prepare(`
    SELECT id, text FROM fortunes_dictionary
    WHERE id NOT IN (SELECT fortune_id FROM user_fortunes_history WHERE user_id = ? AND fortune_id IS NOT NULL)
    ORDER BY RANDOM() LIMIT 1
  `).get(userId);
  try {
    db.prepare('INSERT INTO user_fortunes_history (user_id, fortune_id, opened_date) VALUES (?, ?, ?)')
      .run(userId, fortune ? fortune.id : null, date);
  } catch (error) {
    if (error.message.includes('UNIQUE')) throw new Error('Bereits geöffnet!');
    throw error;
  }
  return { id: fortune ? fortune.id : null, text: fortune ? fortune.text : 'Wow, du hast das Universum durchgespielt!' };
}

async function addFortunesBulk(fortunes) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const statement = db.prepare('INSERT OR IGNORE INTO fortunes_dictionary (text) VALUES (?)');
    for (const text of fortunes) if (text.trim()) statement.run(text.trim());
    db.exec('COMMIT');
    return fortunes.length;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

const getFortunesDictionary = async () => db.prepare(`
  SELECT d.*, COUNT(h.fortune_id) AS usage_count FROM fortunes_dictionary d
  LEFT JOIN user_fortunes_history h ON d.id = h.fortune_id GROUP BY d.id ORDER BY d.id DESC
`).all();

async function deleteFortune(id) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE user_fortunes_history SET fortune_id = NULL WHERE fortune_id = ?').run(id);
    const result = db.prepare('DELETE FROM fortunes_dictionary WHERE id = ?').run(id);
    db.exec('COMMIT');
    return Number(result.changes);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

const getUserFortunesCount = async (userId) => db.prepare(
  'SELECT COUNT(*) AS count FROM user_fortunes_history WHERE user_id = ?'
).get(userId).count;

module.exports = { getFortuneStatus, openDailyFortune, addFortunesBulk, getFortunesDictionary, deleteFortune, getUserFortunesCount };

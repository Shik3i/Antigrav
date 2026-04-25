const db = require('../connection');

const getFortuneStatus = (userId, date) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT h.*, d.text FROM user_fortunes_history h LEFT JOIN fortunes_dictionary d ON h.fortune_id = d.id WHERE h.user_id = ? AND h.opened_date = ?', [userId, date], (err, row) => err ? reject(err) : resolve(row));
  });
};

const openDailyFortune = (userId, date) => {
  return new Promise((resolve, reject) => {
    const fallbackMsg = "Wow, du hast das Universum durchgespielt!";
    db.get('SELECT id, text FROM fortunes_dictionary WHERE id NOT IN (SELECT fortune_id FROM user_fortunes_history WHERE user_id = ? AND fortune_id IS NOT NULL) ORDER BY RANDOM() LIMIT 1', [userId], (err, fortune) => {
      if (err) return reject(err);
      const fortuneId = fortune ? fortune.id : null;
      const fortuneText = fortune ? fortune.text : fallbackMsg;
      db.run('INSERT INTO user_fortunes_history (user_id, fortune_id, opened_date) VALUES (?, ?, ?)', [userId, fortuneId, date], function(err) {
        if (err) reject(err.message.includes('UNIQUE') ? new Error('Bereits geöffnet!') : err);
        else resolve({ id: fortuneId, text: fortuneText });
      });
    });
  });
};

const addFortunesBulk = (fortunes) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare('INSERT OR IGNORE INTO fortunes_dictionary (text) VALUES (?)');
      fortunes.forEach(t => t.trim() && stmt.run(t.trim()));
      stmt.finalize();
      db.run('COMMIT', (err) => err ? reject(err) : resolve(fortunes.length));
    });
  });
};

const getFortunesDictionary = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT d.*, COUNT(h.fortune_id) as usage_count FROM fortunes_dictionary d LEFT JOIN user_fortunes_history h ON d.id = h.fortune_id GROUP BY d.id ORDER BY d.id DESC', [], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const deleteFortune = (id) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run('UPDATE user_fortunes_history SET fortune_id = NULL WHERE fortune_id = ?', [id]);
      db.run('DELETE FROM fortunes_dictionary WHERE id = ?', [id], function(err) { err ? (db.run('ROLLBACK'), reject(err)) : db.run('COMMIT', () => resolve(this.changes)); });
    });
  });
};

const getUserFortunesCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM user_fortunes_history WHERE user_id = ?', [userId], (err, row) => err ? reject(err) : resolve(row ? row.count : 0));
  });
};

module.exports = {
  getFortuneStatus,
  openDailyFortune,
  addFortunesBulk,
  getFortunesDictionary,
  deleteFortune,
  getUserFortunesCount,
};

const db = require('../connection');

const getDailyWord = (date) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT dw.date, dw.word, d.definition, d.funny_quote
      FROM Wordle_DailyWords dw
      LEFT JOIN wordle_dictionary d ON dw.word = d.word
      WHERE dw.date = ?
    `;
    db.get(query, [date], (err, row) => err ? reject(err) : resolve(row));
  });
};

const saveDailyWord = (date, word) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR REPLACE INTO Wordle_DailyWords (date, word) VALUES (?, ?)', [date, word], (err) => err ? reject(err) : resolve());
  });
};

const validateWordleWord = (word) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM wordle_dictionary WHERE word = ?', [word.toUpperCase()], (err, row) => err ? reject(err) : resolve(!!row));
  });
};

const completeWordleGame = (userId, date, guesses, won, earnedCoins) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(
        `INSERT INTO Wordle_DailyResults (userId, date, guesses, won, earnedCoins)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(userId, date) DO UPDATE SET
           guesses = excluded.guesses,
           won = excluded.won,
           earnedCoins = excluded.earnedCoins`,
        [userId, date, JSON.stringify(guesses), won ? 1 : 0, earnedCoins],
        function(err) {
          if (err) return db.run('ROLLBACK', () => reject(err));
          db.get('SELECT * FROM Wordle_UserStats WHERE userId = ?', [userId], (err, stats) => {
            if (err) return db.run('ROLLBACK', () => reject(err));
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            let { totalPlayed=0, totalWins=0, currentStreak=0, maxStreak=0, lastStreakDate } = stats || {};
            totalPlayed++;
            if (won) {
              totalWins++;
              if (lastStreakDate === yesterday) currentStreak++; else if (lastStreakDate !== today) currentStreak = 1;
              lastStreakDate = today;
              if (currentStreak > maxStreak) maxStreak = currentStreak;
            } else if (lastStreakDate !== today) currentStreak = 0;
            const q = stats ? 'UPDATE Wordle_UserStats SET totalPlayed=?, totalWins=?, currentStreak=?, maxStreak=?, lastStreakDate=? WHERE userId=?' : 'INSERT INTO Wordle_UserStats (totalPlayed, totalWins, currentStreak, maxStreak, lastStreakDate, userId) VALUES (?, ?, ?, ?, ?, ?)';
            db.run(q, [totalPlayed, totalWins, currentStreak, maxStreak, lastStreakDate, userId], (err) => {
              if (err) return db.run('ROLLBACK', () => reject(err));
              if (earnedCoins > 0) {
                db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [earnedCoins, userId]);
                db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, earnedCoins, `Wordle Daily Reward (${date})`]);
              }
              db.run('COMMIT', (err) => err ? reject(err) : resolve({ totalPlayed, totalWins, currentStreak, maxStreak }));
            });
          });
        }
      );
    });
  });
};

const saveWordleResult = (userId, date, guesses, won, earnedCoins) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO Wordle_DailyResults (userId, date, guesses, won, earnedCoins)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(userId, date) DO UPDATE SET
         guesses = excluded.guesses,
         won = excluded.won,
         earnedCoins = excluded.earnedCoins`,
      [userId, date, JSON.stringify(guesses), won ? 1 : 0, earnedCoins],
      function(err) { err ? reject(err) : resolve(this.lastID); }
    );
  });
};

const buyWordleHint = (userId, date) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return db.run('ROLLBACK', () => reject(err || new Error('User not found')));
        if (user.koala_balance < 500) return db.run('ROLLBACK', () => reject(new Error('Insufficient balance')));

        const newBalance = user.koala_balance - 500;
        db.run('UPDATE Users SET koala_balance = ? WHERE id = ?', [newBalance, userId]);
        db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, -500, `Wordle Hint (${date})`]);
        db.run('INSERT INTO Wordle_DailyResults (userId, date, hintUsed, guesses, won) VALUES (?, ?, 1, "[]", 0) ON CONFLICT(userId, date) DO UPDATE SET hintUsed = 1', [userId, date]);
        db.run('INSERT INTO Wordle_UserStats (userId, totalHintsBought) VALUES (?, 1) ON CONFLICT(userId) DO UPDATE SET totalHintsBought = totalHintsBought + 1', [userId]);
        db.run('COMMIT', (err) => err ? reject(err) : resolve({ success: true, newBalance }));
      });
    });
  });
};

const getWordleStatus = (userId, date) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Wordle_DailyResults WHERE userId = ? AND date = ?', [userId, date], (err, row) => err ? reject(err) : resolve(row));
  });
};

const getWordleDailyLeaderboard = (date) => {
  return new Promise((resolve, reject) => {
    const q = 'SELECT r.*, u.username, u.displayName, u.preferences, s.totalPlayed, s.totalWins, s.currentStreak, s.maxStreak, s.totalHintsBought FROM Wordle_DailyResults r JOIN Users u ON r.userId = u.id LEFT JOIN Wordle_UserStats s ON r.userId = s.userId WHERE r.date = ? ORDER BY r.won DESC, r.earnedCoins DESC, r.guesses ASC LIMIT 50';
    db.all(q, [date], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const getWordleStats = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Wordle_UserStats WHERE userId = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row || { userId, totalPlayed: 0, totalWins: 0, currentStreak: 0, maxStreak: 0, totalHintsBought: 0 });
    });
  });
};

const addWordleWord = (word) => {
  return new Promise((resolve, reject) => {
    const formatted = word.trim().toUpperCase();
    if (formatted.length !== 5) return reject(new Error("Word must be 5 characters long"));
    db.run("INSERT INTO wordle_dictionary (word) VALUES (?)", [formatted], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

const getWordleWords = () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM wordle_dictionary ORDER BY word ASC", (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const deleteWordleWord = (id) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM wordle_dictionary WHERE id = ? AND is_used = 0", [id], function(err) {
      if (err) reject(err);
      else if (this.changes === 0) reject(new Error("Word cannot be deleted (already used or not found)"));
      else resolve(this.changes);
    });
  });
};

const pickUnusedWordleWord = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM wordle_dictionary WHERE is_used = 0 ORDER BY RANDOM() LIMIT 1", (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const markWordleWordUsed = (id) => {
  return new Promise((resolve, reject) => {
    db.run("UPDATE wordle_dictionary SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?", [id], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateWordleMetadata = (id, definition, funnyQuote) => {
  return new Promise((resolve, reject) => {
    db.run("UPDATE wordle_dictionary SET definition = ?, funny_quote = ? WHERE id = ?", [definition, funnyQuote, id], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const upsertWordleWord = (word, definition, funnyQuote) => {
  return new Promise((resolve, reject) => {
    const q = 'INSERT INTO wordle_dictionary (word, definition, funny_quote) VALUES (?, ?, ?) ON CONFLICT(word) DO UPDATE SET definition = COALESCE(excluded.definition, definition), funny_quote = COALESCE(excluded.funny_quote, funny_quote)';
    db.run(q, [word.toUpperCase(), definition, funnyQuote], function(err) {
      if (err) reject(err);
      else resolve(this.lastID || this.changes);
    });
  });
};

const updateWordleWordMetadataById = (id, definition, funnyQuote) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE wordle_dictionary SET definition = ?, funny_quote = ? WHERE id = ?', [definition, funnyQuote, id], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getUserWordleWins = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COALESCE(totalWins, 0) as totalWins FROM Wordle_UserStats WHERE userId = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.totalWins : 0);
    });
  });
};

module.exports = {
  getDailyWord,
  saveDailyWord,
  validateWordleWord,
  completeWordleGame,
  saveWordleResult,
  buyWordleHint,
  getWordleStatus,
  getWordleDailyLeaderboard,
  getWordleStats,
  addWordleWord,
  getWordleWords,
  deleteWordleWord,
  pickUnusedWordleWord,
  markWordleWordUsed,
  updateWordleMetadata,
  upsertWordleWord,
  updateWordleWordMetadataById,
  getUserWordleWins,
};

const db = require('../connection');

const getDailyWord = async (date) => db.prepare(`
  SELECT dw.date, dw.word, d.definition, d.funny_quote FROM Wordle_DailyWords dw
  LEFT JOIN wordle_dictionary d ON dw.word = d.word WHERE dw.date = ?
`).get(date);
const saveDailyWord = async (date, word) => { db.prepare('INSERT OR REPLACE INTO Wordle_DailyWords (date, word) VALUES (?, ?)').run(date, word); };
const validateWordleWord = async (word) => Boolean(db.prepare('SELECT id FROM wordle_dictionary WHERE word = ?').get(word.toUpperCase()));

async function completeWordleGame(userId, date, guesses, won, earnedCoins) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO Wordle_DailyResults (userId, date, guesses, won, earnedCoins) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(userId, date) DO UPDATE SET guesses=excluded.guesses, won=excluded.won, earnedCoins=excluded.earnedCoins
    `).run(userId, date, JSON.stringify(guesses), won ? 1 : 0, earnedCoins);
    const stats = db.prepare('SELECT * FROM Wordle_UserStats WHERE userId = ?').get(userId);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let { totalPlayed = 0, totalWins = 0, currentStreak = 0, maxStreak = 0, lastStreakDate } = stats || {};
    totalPlayed += 1;
    if (won) {
      totalWins += 1;
      if (lastStreakDate === yesterday) currentStreak += 1;
      else if (lastStreakDate !== today) currentStreak = 1;
      lastStreakDate = today;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else if (lastStreakDate !== today) currentStreak = 0;
    db.prepare(`
      INSERT INTO Wordle_UserStats (userId, totalPlayed, totalWins, currentStreak, maxStreak, lastStreakDate)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET totalPlayed=excluded.totalPlayed, totalWins=excluded.totalWins,
        currentStreak=excluded.currentStreak, maxStreak=excluded.maxStreak, lastStreakDate=excluded.lastStreakDate
    `).run(userId, totalPlayed, totalWins, currentStreak, maxStreak, lastStreakDate);
    if (earnedCoins > 0) {
      db.prepare('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?').run(earnedCoins, userId);
      db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)').run(userId, earnedCoins, `Wordle Daily Reward (${date})`);
    }
    db.exec('COMMIT');
    return { totalPlayed, totalWins, currentStreak, maxStreak };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

async function saveWordleResult(userId, date, guesses, won, earnedCoins) {
  const result = db.prepare(`
    INSERT INTO Wordle_DailyResults (userId, date, guesses, won, earnedCoins) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(userId, date) DO UPDATE SET guesses=excluded.guesses, won=excluded.won, earnedCoins=excluded.earnedCoins
  `).run(userId, date, JSON.stringify(guesses), won ? 1 : 0, earnedCoins);
  return Number(result.lastInsertRowid);
}

async function buyWordleHint(userId, date) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const user = db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found');
    if (user.koala_balance < 500) throw new Error('Insufficient balance');
    const newBalance = user.koala_balance - 500;
    db.prepare('UPDATE Users SET koala_balance = ? WHERE id = ?').run(newBalance, userId);
    db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)').run(userId, -500, `Wordle Hint (${date})`);
    db.prepare(`INSERT INTO Wordle_DailyResults (userId, date, hintUsed, guesses, won) VALUES (?, ?, 1, '[]', 0)
      ON CONFLICT(userId, date) DO UPDATE SET hintUsed = 1`).run(userId, date);
    db.prepare(`INSERT INTO Wordle_UserStats (userId, totalHintsBought) VALUES (?, 1)
      ON CONFLICT(userId) DO UPDATE SET totalHintsBought = totalHintsBought + 1`).run(userId);
    db.exec('COMMIT');
    return { success: true, newBalance };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

const getWordleStatus = async (userId, date) => db.prepare('SELECT * FROM Wordle_DailyResults WHERE userId = ? AND date = ?').get(userId, date);
const getWordleDailyLeaderboard = async (date) => db.prepare(`
  SELECT r.*, u.username, u.displayName, u.preferences, s.totalPlayed, s.totalWins, s.currentStreak, s.maxStreak, s.totalHintsBought
  FROM Wordle_DailyResults r JOIN Users u ON r.userId=u.id LEFT JOIN Wordle_UserStats s ON r.userId=s.userId
  WHERE r.date=? ORDER BY r.won DESC, r.earnedCoins DESC, r.guesses ASC LIMIT 50
`).all(date);
const getWordleStats = async (userId) => db.prepare('SELECT * FROM Wordle_UserStats WHERE userId = ?').get(userId)
  || { userId, totalPlayed: 0, totalWins: 0, currentStreak: 0, maxStreak: 0, totalHintsBought: 0 };
async function addWordleWord(word) {
  const formatted = word.trim().toUpperCase();
  if (formatted.length !== 5) throw new Error('Word must be 5 characters long');
  return Number(db.prepare('INSERT INTO wordle_dictionary (word) VALUES (?)').run(formatted).lastInsertRowid);
}
const getWordleWords = async () => db.prepare('SELECT * FROM wordle_dictionary ORDER BY word ASC').all();
async function deleteWordleWord(id) {
  const changes = Number(db.prepare('DELETE FROM wordle_dictionary WHERE id = ? AND is_used = 0').run(id).changes);
  if (changes === 0) throw new Error('Word cannot be deleted (already used or not found)');
  return changes;
}
const pickUnusedWordleWord = async () => db.prepare('SELECT * FROM wordle_dictionary WHERE is_used = 0 ORDER BY RANDOM() LIMIT 1').get();
const markWordleWordUsed = async (id) => Number(db.prepare('UPDATE wordle_dictionary SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(id).changes);
const updateWordleMetadata = async (id, definition, funnyQuote) => Number(db.prepare('UPDATE wordle_dictionary SET definition = ?, funny_quote = ? WHERE id = ?').run(definition, funnyQuote, id).changes);
async function upsertWordleWord(word, definition, funnyQuote) {
  const result = db.prepare(`INSERT INTO wordle_dictionary (word, definition, funny_quote) VALUES (?, ?, ?)
    ON CONFLICT(word) DO UPDATE SET definition=COALESCE(excluded.definition, definition), funny_quote=COALESCE(excluded.funny_quote, funny_quote)`)
    .run(word.toUpperCase(), definition, funnyQuote);
  return Number(result.lastInsertRowid || result.changes);
}
const updateWordleWordMetadataById = updateWordleMetadata;
const getUserWordleWins = async (userId) => (db.prepare('SELECT COALESCE(totalWins, 0) AS totalWins FROM Wordle_UserStats WHERE userId = ?').get(userId) || {}).totalWins || 0;

module.exports = { getDailyWord, saveDailyWord, validateWordleWord, completeWordleGame, saveWordleResult, buyWordleHint,
  getWordleStatus, getWordleDailyLeaderboard, getWordleStats, addWordleWord, getWordleWords, deleteWordleWord,
  pickUnusedWordleWord, markWordleWordUsed, updateWordleMetadata, upsertWordleWord, updateWordleWordMetadataById, getUserWordleWins };

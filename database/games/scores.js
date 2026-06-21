const db = require('../connection');
const { logError } = require('../logging');

async function getGlobalGameStats(gameId) {
  return db.prepare('SELECT * FROM GlobalGameStats WHERE gameId = ?').get(gameId)
    || { gameId, totalPlayed: 0, totalWins: 0, totalPayout: 0 };
}

async function recordGameScore(userId, gameId, score, coinsEarned) {
  try {
    const result = db.prepare('INSERT INTO GameScores (userId, gameId, score, coinsEarned) VALUES (?, ?, ?, ?)')
      .run(userId, gameId, score, coinsEarned);
    return { id: Number(result.lastInsertRowid) };
  } catch (error) {
    logError(`recordGameScore: Insert failed: ${error.message}`, error.stack, JSON.stringify({ userId, gameId, score, coinsEarned }))
      .catch(() => {});
    throw error;
  }
}

async function getGameLeaderboards(gameId) {
  if (gameId === 'tetris' || gameId === 'tetris_lines') {
    const highscores = db.prepare(`
      SELECT u.displayName, u.username, u.preferences, u.id AS userId,
        gs.highscore, gs.sprintHighscore, gs.maxLevel
      FROM UserGameStats gs JOIN Users u ON gs.userId = u.id
      WHERE gs.gameId = 'tetris' ORDER BY highscore DESC LIMIT 10
    `).all();
    const cumulative = db.prepare(`
      SELECT u.displayName, u.username, u.preferences, u.id AS userId,
        gs.totalLines, gs.totalScore, gs.sprintHighscore, gs.maxLevel
      FROM UserGameStats gs JOIN Users u ON gs.userId = u.id
      WHERE gs.gameId = 'tetris' ORDER BY gs.totalLines DESC, gs.highscore DESC LIMIT 10
    `).all();
    return { highscores, cumulative };
  }
  if (gameId === 'wordle') {
    const rows = db.prepare(`
      SELECT u.displayName, u.username, u.preferences, u.id AS userId,
        ws.totalWins, ws.currentStreak, ws.maxStreak, ws.totalPlayed, ws.totalHintsBought
      FROM Wordle_UserStats ws JOIN Users u ON ws.userId = u.id
      ORDER BY ws.totalWins DESC, ws.maxStreak DESC LIMIT 50
    `).all();
    return { highscores: rows, cumulative: rows };
  }
  const highscores = db.prepare(`
    SELECT u.displayName, u.username, u.preferences, u.id AS userId, MAX(gs.score) AS highscore
    FROM GameScores gs JOIN Users u ON gs.userId = u.id
    WHERE gs.gameId = ? GROUP BY gs.userId ORDER BY highscore DESC LIMIT 10
  `).all(gameId);
  const cumulative = db.prepare(`
    SELECT u.displayName, u.username, u.preferences, u.id AS userId,
      SUM(gs.coinsEarned) AS totalEarned, SUM(gs.score) AS totalScore
    FROM GameScores gs JOIN Users u ON gs.userId = u.id
    WHERE gs.gameId = ? GROUP BY gs.userId ORDER BY totalEarned DESC, totalScore DESC LIMIT 10
  `).all(gameId);
  return { highscores, cumulative };
}

async function updateUserGameStats(userId, gameId, score, lines, level, sprintTime) {
  const result = db.prepare(`
    INSERT INTO UserGameStats (userId, gameId, highscore, sprintHighscore, totalScore, totalLines, maxLevel, playCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(userId, gameId) DO UPDATE SET
      highscore = CASE WHEN excluded.highscore > highscore THEN excluded.highscore ELSE highscore END,
      sprintHighscore = CASE WHEN excluded.sprintHighscore > 0 AND (sprintHighscore = 0 OR excluded.sprintHighscore < sprintHighscore)
        THEN excluded.sprintHighscore ELSE sprintHighscore END,
      totalScore = totalScore + excluded.totalScore,
      totalLines = totalLines + excluded.totalLines,
      maxLevel = CASE WHEN excluded.maxLevel > maxLevel THEN excluded.maxLevel ELSE maxLevel END,
      playCount = playCount + 1,
      updatedAt = CURRENT_TIMESTAMP
  `).run(userId, gameId, score, sprintTime, score, lines, level);
  return Number(result.changes);
}

async function getAdminGameScores(gameId) {
  return db.prepare(`
    SELECT gs.*, u.displayName, u.username FROM GameScores gs
    JOIN Users u ON gs.userId = u.id WHERE gs.gameId = ? ORDER BY gs.createdAt DESC
  `).all(gameId);
}

async function deleteGameScore(scoreId) {
  return Number(db.prepare('DELETE FROM GameScores WHERE id = ?').run(scoreId).changes);
}

async function getUserWonMatchCount(userId) {
  return db.prepare("SELECT COUNT(*) AS count FROM Bets WHERE userId = ? AND status = 'won'").get(userId).count;
}

async function getUserGameRoundCount(userId, gameId = null) {
  const row = gameId
    ? db.prepare('SELECT COUNT(*) AS count FROM GameScores WHERE userId = ? AND gameId = ?').get(userId, gameId)
    : db.prepare('SELECT COUNT(*) AS count FROM GameScores WHERE userId = ?').get(userId);
  return row.count;
}

async function getUserZeroScoreStreak(userId) {
  const rows = db.prepare("SELECT score FROM GameScores WHERE userId = ? AND gameId = 'koala_flap' ORDER BY createdAt DESC")
    .all(userId);
  let streak = 0;
  for (const row of rows) {
    if (row.score !== 0) break;
    streak += 1;
  }
  return streak;
}

const recordZeroScore = async () => 0;

module.exports = {
  getGlobalGameStats,
  recordGameScore,
  getGameLeaderboards,
  updateUserGameStats,
  getAdminGameScores,
  deleteGameScore,
  getUserWonMatchCount,
  getUserGameRoundCount,
  getUserZeroScoreStreak,
  recordZeroScore
};

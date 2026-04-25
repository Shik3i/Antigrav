const db = require('../connection');
const { logError } = require('../logging');

const getGlobalGameStats = (gameId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM GlobalGameStats WHERE gameId = ?', [gameId], (err, row) => {
      if (err) reject(err);
      else resolve(row || { gameId, totalPlayed: 0, totalWins: 0, totalPayout: 0 });
    });
  });
};

const recordGameScore = (userId, gameId, score, coinsEarned) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO GameScores (userId, gameId, score, coinsEarned) VALUES (?, ?, ?, ?)',
      [userId, gameId, score, coinsEarned],
      function (err) {
        if (err) {
          logError(`recordGameScore: Insert failed: ${err.message}`, err.stack, JSON.stringify({ userId, gameId, score, coinsEarned }));
          reject(err);
        } else resolve({ id: this.lastID });
      }
    );
  });
};

const getGameLeaderboards = (gameId) => {
  return new Promise((resolve, reject) => {
    if (gameId === 'tetris' || gameId === 'tetris_lines') {
      const highscoreQuery = `
        SELECT u.displayName, u.username, u.preferences, u.id as userId, gs.highscore, gs.sprintHighscore, gs.maxLevel
        FROM UserGameStats gs
        JOIN Users u ON gs.userId = u.id
        WHERE gs.gameId = 'tetris'
        ORDER BY highscore DESC
        LIMIT 10
      `;
      const cumulativeQuery = `
        SELECT u.displayName, u.username, u.preferences, u.id as userId,
               gs.totalLines as totalLines,
               gs.totalScore as totalScore,
               gs.sprintHighscore as sprintHighscore,
               gs.maxLevel as maxLevel
        FROM UserGameStats gs
        JOIN Users u ON gs.userId = u.id
        WHERE gs.gameId = 'tetris'
        ORDER BY gs.totalLines DESC, gs.highscore DESC
        LIMIT 10
      `;
      Promise.all([
        new Promise((res, rej) => db.all(highscoreQuery, [], (err, rows) => err ? rej(err) : res(rows))),
        new Promise((res, rej) => db.all(cumulativeQuery, [], (err, rows) => err ? rej(err) : res(rows)))
      ])
        .then(([highscores, cumulative]) => resolve({ highscores, cumulative }))
        .catch(reject);
      return;
    }

    if (gameId === 'wordle') {
      const statsQuery = `
        SELECT u.displayName, u.username, u.preferences, u.id as userId,
               ws.totalWins, ws.currentStreak, ws.maxStreak, ws.totalPlayed, ws.totalHintsBought
        FROM Wordle_UserStats ws
        JOIN Users u ON ws.userId = u.id
        ORDER BY ws.totalWins DESC, ws.maxStreak DESC
        LIMIT 50
      `;
      db.all(statsQuery, [], (err, rows) => {
        if (err) return reject(err);
        resolve({ highscores: rows, cumulative: rows });
      });
      return;
    }

    const highscoreQuery = `
      SELECT u.displayName, u.username, u.preferences, u.id as userId, MAX(gs.score) as highscore
      FROM GameScores gs
      JOIN Users u ON gs.userId = u.id
      WHERE gs.gameId = ?
      GROUP BY gs.userId
      ORDER BY highscore DESC
      LIMIT 10
    `;
    const cumulativeQuery = `
      SELECT u.displayName, u.username, u.preferences, u.id as userId, SUM(gs.coinsEarned) as totalEarned, SUM(gs.score) as totalScore
      FROM GameScores gs
      JOIN Users u ON gs.userId = u.id
      WHERE gs.gameId = ?
      GROUP BY gs.userId
      ORDER BY totalEarned DESC, totalScore DESC
      LIMIT 10
    `;
    Promise.all([
      new Promise((res, rej) => db.all(highscoreQuery, [gameId], (err, rows) => err ? rej(err) : res(rows))),
      new Promise((res, rej) => db.all(cumulativeQuery, [gameId], (err, rows) => err ? rej(err) : res(rows)))
    ])
      .then(([highscores, cumulative]) => resolve({ highscores, cumulative }))
      .catch(reject);
  });
};

const updateUserGameStats = (userId, gameId, score, lines, level, sprintTime) => {
  return new Promise((resolve, reject) => {
    const q = `
      INSERT INTO UserGameStats (userId, gameId, highscore, sprintHighscore, totalScore, totalLines, maxLevel, playCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(userId, gameId) DO UPDATE SET
        highscore = CASE WHEN excluded.highscore > highscore THEN excluded.highscore ELSE highscore END,
        sprintHighscore = CASE
            WHEN excluded.sprintHighscore > 0 AND (sprintHighscore = 0 OR excluded.sprintHighscore < sprintHighscore)
            THEN excluded.sprintHighscore
            ELSE sprintHighscore
        END,
        totalScore = totalScore + excluded.totalScore,
        totalLines = totalLines + excluded.totalLines,
        maxLevel = CASE WHEN excluded.maxLevel > maxLevel THEN excluded.maxLevel ELSE maxLevel END,
        playCount = playCount + 1,
        updatedAt = CURRENT_TIMESTAMP
    `;
    db.run(q, [userId, gameId, score, sprintTime, score, lines, level], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getAdminGameScores = (gameId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT gs.*, u.displayName, u.username
      FROM GameScores gs
      JOIN Users u ON gs.userId = u.id
      WHERE gs.gameId = ?
      ORDER BY gs.createdAt DESC
    `;
    db.all(query, [gameId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const deleteGameScore = (scoreId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM GameScores WHERE id = ?', [scoreId], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getUserWonMatchCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM Bets WHERE userId = ? AND status = 'won'", [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });
};

const getUserGameRoundCount = (userId, gameId = null) => {
  return new Promise((resolve, reject) => {
    const query = gameId ? 'SELECT COUNT(*) as count FROM GameScores WHERE userId = ? AND gameId = ?' : 'SELECT COUNT(*) as count FROM GameScores WHERE userId = ?';
    const params = gameId ? [userId, gameId] : [userId];
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });
};

const getUserZeroScoreStreak = (userId) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT score FROM GameScores WHERE userId = ? AND gameId = 'koala_flap' ORDER BY createdAt DESC`, [userId], (err, rows) => {
      if (err) return reject(err);
      if (!rows || rows.length === 0) return resolve(0);
      // Count the current consecutive streak of score=0 from most recent
      let streak = 0;
      for (const row of rows) {
        if (row.score === 0) streak++;
        else break;
      }
      resolve(streak);
    });
  });
};

const recordZeroScore = (userId) => {
  // This function is currently a placeholder as the streak is computed dynamically from GameScores
  return Promise.resolve(0);
};

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
  recordZeroScore,
};

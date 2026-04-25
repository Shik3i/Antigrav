const db = require('./connection');
const { logError } = require('./logging');

/**
 * Games Domain (Wordle, Blackjack, Lotto, Scratchcards, Tower Climb, Speedcube, Idle Game, Rift Defense)
 */

// --- Game Stats & Settings ---
const getGlobalGameStats = (gameId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM GlobalGameStats WHERE gameId = ?', [gameId], (err, row) => {
      if (err) reject(err);
      else resolve(row || { gameId, totalPlayed: 0, totalWins: 0, totalPayout: 0 });
    });
  });
};

const getGameUpgradesConfig = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM GameUpgrades_Config ORDER BY category ASC', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const purchaseUpgrade = (userId, upgradeId, price) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (err, user) => {
        if (err || !user || user.koala_balance < price) {
          db.run('ROLLBACK');
          return reject(err || new Error('Insufficient balance'));
        }
        db.run('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?', [price, userId]);
        db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, -price, `Purchase Upgrade: ${upgradeId}`]);
        db.run(
          'INSERT INTO UserUpgrades (userId, upgrade_id, current_level) VALUES (?, ?, 1) ON CONFLICT(userId, upgrade_id) DO UPDATE SET current_level = current_level + 1',
          [userId, upgradeId],
          function (err) {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
            db.run('COMMIT', (err) => err ? reject(err) : resolve({ success: true }));
          }
        );
      });
    });
  });
};

const getLeaderboardSettings = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM LeaderboardSettings', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const updateLeaderboardSetting = (gameId, isHidden) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO LeaderboardSettings (game_id, is_hidden)
      VALUES (?, ?)
      ON CONFLICT(game_id) DO UPDATE SET is_hidden = excluded.is_hidden
    `;
    db.run(query, [gameId, isHidden ? 1 : 0], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

// --- Speedcube ---
const addSpeedcubeTime = (userId, time_ms, note = '', scramble = '') => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO SpeedcubeTimes (userId, time_ms, note, scramble) VALUES (?, ?, ?, ?)', [userId, time_ms, note, scramble], function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, userId, time_ms, note, scramble, createdAt: new Date().toISOString() });
    });
  });
};

const getSpeedcubeTimes = (userId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM SpeedcubeTimes WHERE userId = ? ORDER BY createdAt DESC', [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const updateSpeedcubeNote = (id, userId, note) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE SpeedcubeTimes SET note = ? WHERE id = ? AND userId = ?', [note, id, userId], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const deleteSpeedcubeTime = (id, userId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM SpeedcubeTimes WHERE id = ? AND userId = ?', [id, userId], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

// --- Scratchcards ---
const getGlobalScratchcardStats = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM GlobalGameStats WHERE gameId = 'scratchcards'", (err, row) => {
      if (err) reject(err);
      else resolve(row || { gameId: 'scratchcards', totalPlayed: 0, totalWins: 0, totalPayout: 0 });
    });
  });
};

const createScratchcard = (userId, packId, grid, winAmount) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO Scratchcards (userId, type, grid, winAmount) VALUES (?, ?, ?, ?)',
      [userId, String(packId), JSON.stringify(grid), winAmount],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, userId, packId, grid, winAmount, status: 'purchased' });
      }
    );
  });
};

const purchaseScratchcardTransaction = (userId, packId, packName, price, grid, winAmount) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (err, user) => {
        if (err || !user || user.koala_balance < price) {
          db.run('ROLLBACK');
          return reject(err || new Error('Insufficient balance or user not found'));
        }
        db.run('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?', [price, userId], (updErr) => {
          if (updErr) {
            db.run('ROLLBACK');
            return reject(updErr);
          }
          db.run('UPDATE GlobalGameStats SET totalPlayed = totalPlayed + 1 WHERE gameId = ?', ['scratchcards']);
          db.run(
            'INSERT INTO Scratchcards (userId, type, grid, winAmount, status, price) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, String(packId), JSON.stringify(grid), winAmount, 'purchased', price],
            function (insErr) {
              if (insErr) {
                db.run('ROLLBACK');
                return reject(insErr);
              }
              const cardId = this.lastID;
              db.run(
                'INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)',
                [userId, -price, `Purchased Scratchcard: ${packName} (ID: ${cardId})`],
                (txErr) => {
                  if (txErr) {
                    db.run('ROLLBACK');
                    return reject(txErr);
                  }
                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) reject(commitErr);
                    else resolve({ id: cardId, grid, winAmount });
                  });
                }
              );
            }
          );
        });
      });
    });
  });
};

const getScratchcard = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Scratchcards WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getUserPurchasedScratchcard = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Scratchcards WHERE userId = ? AND status = "purchased" ORDER BY createdAt DESC LIMIT 1', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const claimScratchcard = (id, userId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get('SELECT winAmount, status, price FROM Scratchcards WHERE id = ? AND userId = ?', [id, userId], (err, card) => {
        if (err) return reject(err);
        if (!card) return reject(new Error('Scratchcard not found'));
        if (card.status !== 'purchased') return reject(new Error('Scratchcard already claimed or invalid'));

        db.run('UPDATE Scratchcards SET status = "claimed" WHERE id = ?', [id], function (updateErr) {
          if (updateErr) return reject(updateErr);
          if (card.winAmount > 0) {
            db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [card.winAmount, userId], (coinErr) => {
              if (coinErr) return reject(coinErr);
              db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, card.winAmount, `Scratchcard Win (ID: ${id})`], (txErr) => {
                if (txErr) return reject(txErr);
                db.run('UPDATE GlobalGameStats SET totalPayout = totalPayout + ?, totalWins = totalWins + 1 WHERE gameId = ?', [card.winAmount, 'scratchcards']);
                resolve({ success: true, winAmount: card.winAmount, price: card.price });
              });
            });
          } else {
            resolve({ success: true, winAmount: 0, price: card.price });
          }
        });
      });
    });
  });
};

const getScratchcardPools = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ScratchcardPools', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const addScratchcardPoolTeam = (cardType, teamCode) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO ScratchcardPools (card_type, team_code) VALUES (?, ?)', [cardType, teamCode], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const removeScratchcardPoolTeam = (cardType, teamCode) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM ScratchcardPools WHERE card_type = ? AND team_code = ?', [cardType, teamCode], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getScratchcardConfigs = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ScratchcardConfigs', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const updateScratchcardConfig = (cardType, price, winChance, rewardAmount) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO ScratchcardConfigs (card_type, price, win_chance, reward_amount) 
       VALUES (?, ?, ?, ?) 
       ON CONFLICT(card_type) DO UPDATE SET 
       price = excluded.price, 
       win_chance = excluded.win_chance, 
       reward_amount = excluded.reward_amount`,
      [cardType, price, winChance, rewardAmount],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

const getLatestScratchcardWinners = (limit = 10) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT s.id, s.winAmount, s.createdAt, u.displayName, u.username, u.preferences, s.type as packId
      FROM Scratchcards s
      JOIN Users u ON s.userId = u.id
      WHERE s.status = 'claimed' AND s.winAmount > 0
      ORDER BY s.createdAt DESC
      LIMIT ?
    `;
    db.all(query, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getTopScratchcardWinners = (limit = 10) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT SUM(s.winAmount) as totalWon, COUNT(s.id) as winCount, u.displayName, u.username, u.preferences
      FROM Scratchcards s
      JOIN Users u ON s.userId = u.id
      WHERE s.status = 'claimed' AND s.winAmount > 0
      GROUP BY u.id
      ORDER BY totalWon DESC
      LIMIT ?
    `;
    db.all(query, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getScratchcardLeaderboard = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT u.displayName, u.username, u.preferences, 
             SUM(s.winAmount) as totalWon,
             COUNT(s.id) as totalBought,
             SUM(CASE WHEN s.winAmount > 0 THEN 1 ELSE 0 END) as ticketsWon
      FROM Scratchcards s
      JOIN Users u ON s.userId = u.id
      WHERE s.status = 'claimed'
      GROUP BY u.id
      ORDER BY totalWon DESC
      LIMIT 10
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getScratchcardLeaderboardData = (limit = 10) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT u.id as userId, u.displayName, u.username, u.preferences,
             SUM(s.winAmount) as totalWon,
             COUNT(s.id) as ticketsClaimed,
             SUM(CASE WHEN s.winAmount > 0 THEN 1 ELSE 0 END) as wins
      FROM Scratchcards s
      JOIN Users u ON s.userId = u.id
      WHERE s.status = 'claimed'
      GROUP BY u.id
      ORDER BY totalWon DESC
      LIMIT ?
    `;
    db.all(query, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getScratchcardChartData = (limit = 14) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT date(createdAt) as day, SUM(winAmount) as dailyWin
      FROM Scratchcards
      WHERE status = 'claimed'
      GROUP BY day
      ORDER BY day DESC
      LIMIT ?
    `;
    db.all(query, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows ? rows.reverse() : []);
    });
  });
};

const getScratchcardPacks = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM scratchcard_packs ORDER BY created_at DESC', (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const getScratchcardPack = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM scratchcard_packs WHERE id = ?', [id], (err, row) => err ? reject(err) : resolve(row));
  });
};

const createScratchcardPack = (pack) => {
  const { name, region_label, scope, price, win_chance, reward_amount, is_weighted, max_daily_limit, is_active, is_special } = pack;
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO scratchcard_packs (name, region_label, scope, price, win_chance, reward_amount, is_weighted, max_daily_limit, is_active, is_special) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, region_label, scope, price, win_chance || 0.3, reward_amount || 0, is_weighted ? 1 : 0, max_daily_limit || 0, is_active ? 1 : 0, is_special ? 1 : 0],
      function (err) { err ? reject(err) : resolve({ id: this.lastID, ...pack }); }
    );
  });
};

const updateScratchcardPack = (id, pack) => {
  const { name, region_label, scope, price, win_chance, reward_amount, is_weighted, max_daily_limit, is_active, is_special } = pack;
  return new Promise((resolve, reject) => {
    db.run(`UPDATE scratchcard_packs SET name=?, region_label=?, scope=?, price=?, win_chance=?, reward_amount=?, is_weighted=?, max_daily_limit=?, is_active=?, is_special=? WHERE id=?`,
      [name, region_label, scope, price, win_chance, reward_amount, is_weighted ? 1 : 0, max_daily_limit || 0, is_active ? 1 : 0, is_special ? 1 : 0, id],
      function (err) { err ? reject(err) : resolve(this.changes); }
    );
  });
};

const deleteScratchcardPack = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM scratchcard_packs WHERE id = ?', [id], function (err) { err ? reject(err) : resolve(this.changes); });
  });
};

const getScratchcardPackTeams = (packId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM scratchcard_pack_teams WHERE pack_id = ? ORDER BY position ASC', [packId], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const setScratchcardPackTeams = (packId, teamCodes) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run('DELETE FROM scratchcard_pack_teams WHERE pack_id = ?', [packId], (err) => {
        if (err) return db.run('ROLLBACK', () => reject(err));
        const stmt = db.prepare('INSERT INTO scratchcard_pack_teams (pack_id, team_code, position) VALUES (?, ?, ?)');
        teamCodes.forEach((code, idx) => stmt.run(packId, code, idx));
        stmt.finalize((err) => {
          if (err) return db.run('ROLLBACK', () => reject(err));
          db.run('COMMIT', (err) => err ? reject(err) : resolve());
        });
      });
    });
  });
};

// --- Game Scores & Leaderboards ---
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

// --- Tower Climb ---
const mapTowerRoundRow = (row) => {
  if (!row) return null;
  const config = require('../config/towerClimb');
  const multipliers = config.getTowerMultiplierTable(row.tilesPerLevel);
  return {
    ...row,
    selectedTiles: JSON.parse(row.selectedTiles || '[]'),
    trapPattern: JSON.parse(row.trapPattern || '[]'),
    currentPayout: Math.floor(row.bet * row.currentMultiplier),
    multiplierTable: multipliers,
    canCashout: row.status === 'running' && row.currentLevel > 0
  };
};

const getActiveTowerRound = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM TowerClimbRounds WHERE userId = ? AND status = "running"', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(mapTowerRoundRow(row));
    });
  });
};

const getLatestTowerRound = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM TowerClimbRounds WHERE userId = ? ORDER BY createdAt DESC LIMIT 1', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(mapTowerRoundRow(row));
    });
  });
};

const getTowerHistory = (userId, limit = 10) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM TowerClimbRounds WHERE userId = ? ORDER BY createdAt DESC LIMIT ?', [userId, limit], (err, rows) => {
      if (err) reject(err);
      else resolve((rows || []).map(mapTowerRoundRow));
    });
  });
};

const startTowerRound = (userId, bet, tilesPerLevel) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (err, user) => {
        if (err || !user || user.koala_balance < bet) {
          db.run('ROLLBACK');
          return reject(err || new Error('Insufficient balance'));
        }
        
        // Check for active round
        db.get('SELECT id FROM TowerClimbRounds WHERE userId = ? AND status = "running"', [userId], (actErr, active) => {
          if (actErr || active) {
            db.run('ROLLBACK');
            const error = new Error('Already have an active round');
            error.status = 400;
            return reject(error);
          }

          db.run('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?', [bet, userId], (updErr) => {
            if (updErr) {
              db.run('ROLLBACK');
              return reject(updErr);
            }
            db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, -bet, 'Tower Climb Bet'], (txErr) => {
              if (txErr) {
                db.run('ROLLBACK');
                return reject(txErr);
              }
              const trapPattern = [];
              for (let i = 0; i < 8; i++) {
                trapPattern.push(Math.floor(Math.random() * tilesPerLevel));
              }
              db.run(
                'INSERT INTO TowerClimbRounds (userId, bet, tilesPerLevel, trapPattern) VALUES (?, ?, ?, ?)',
                [userId, bet, tilesPerLevel, JSON.stringify(trapPattern)],
                function (insErr) {
                  if (insErr) {
                    db.run('ROLLBACK');
                    return reject(insErr);
                  }
                  const roundId = this.lastID;
                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) reject(commitErr);
                    else {
                      const newBalance = user.koala_balance - bet;
                      // Return the freshly created round object
                      db.get('SELECT * FROM TowerClimbRounds WHERE id = ?', [roundId], (fetchErr, row) => {
                        resolve({ 
                          round: mapTowerRoundRow(row), 
                          newBalance 
                        });
                      });
                    }
                  });
                }
              );
            });
          });
        });
      });
    });
  });
};

const resolveTowerPick = (userId, tileIndex, expectedLevel) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get('SELECT * FROM TowerClimbRounds WHERE userId = ? AND status = "running"', [userId], (err, row) => {
        if (err || !row) return reject(err || new Error('No active round'));
        if (row.currentLevel !== expectedLevel) return reject(new Error('Level mismatch'));
        const trapPattern = JSON.parse(row.trapPattern);
        const selectedTiles = JSON.parse(row.selectedTiles);
        const isTrap = trapPattern[row.currentLevel] === tileIndex;
        selectedTiles.push({ level: row.currentLevel, tileIndex, trapIndex: trapPattern[row.currentLevel], result: isTrap ? 'trap' : 'safe' });
        
        if (isTrap) {
          db.run('UPDATE TowerClimbRounds SET status = "lost", selectedTiles = ?, resolvedAt = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(selectedTiles), row.id], (updErr) => {
            if (updErr) reject(updErr);
            else {
              db.get('SELECT * FROM TowerClimbRounds WHERE id = ?', [row.id], (fErr, updatedRow) => {
                db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (bErr, user) => {
                  resolve({ round: mapTowerRoundRow(updatedRow), newBalance: user?.koala_balance });
                });
              });
            }
          });
        } else {
          const nextLevel = row.currentLevel + 1;
          const nextMultiplier = require('../config/towerClimb').getTowerMultiplierTable(row.tilesPerLevel)[nextLevel];
          if (nextLevel >= 8) {
            const payout = Math.floor(row.bet * nextMultiplier);
            db.run('UPDATE TowerClimbRounds SET status = "won", currentLevel = ?, currentMultiplier = ?, selectedTiles = ?, payout = ?, resolvedAt = CURRENT_TIMESTAMP WHERE id = ?', [nextLevel, nextMultiplier, JSON.stringify(selectedTiles), payout, row.id], (updErr) => {
              if (updErr) reject(updErr);
              else {
                db.serialize(() => {
                  db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [payout, userId]);
                  db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, payout, 'Tower Climb Win (Max Level)'], () => {
                    db.get('SELECT * FROM TowerClimbRounds WHERE id = ?', [row.id], (fErr, updatedRow) => {
                      db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (bErr, user) => {
                        resolve({ round: mapTowerRoundRow(updatedRow), newBalance: user?.koala_balance });
                      });
                    });
                  });
                });
              }
            });
          } else {
            db.run('UPDATE TowerClimbRounds SET currentLevel = ?, currentMultiplier = ?, selectedTiles = ? WHERE id = ?', [nextLevel, nextMultiplier, JSON.stringify(selectedTiles), row.id], (updErr) => {
              if (updErr) reject(updErr);
              else {
                db.get('SELECT * FROM TowerClimbRounds WHERE id = ?', [row.id], (fErr, updatedRow) => {
                  db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (bErr, user) => {
                    resolve({ round: mapTowerRoundRow(updatedRow), newBalance: user?.koala_balance });
                  });
                });
              }
            });
          }
        }
      });
    });
  });
};

const cashoutTowerRound = (userId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get('SELECT * FROM TowerClimbRounds WHERE userId = ? AND status = "running"', [userId], (err, row) => {
        if (err || !row) return reject(err || new Error('No active round'));
        if (row.currentLevel === 0) return reject(new Error('Cannot cashout at level 0'));
        const payout = Math.floor(row.bet * row.currentMultiplier);
        db.run('UPDATE TowerClimbRounds SET status = "cashed_out", payout = ?, resolvedAt = CURRENT_TIMESTAMP WHERE id = ?', [payout, row.id], (updErr) => {
          if (updErr) reject(updErr);
          else {
            db.serialize(() => {
              db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [payout, userId]);
              db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, payout, 'Tower Climb Cashout'], () => {
                db.get('SELECT * FROM TowerClimbRounds WHERE id = ?', [row.id], (fErr, updatedRow) => {
                  db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (bErr, user) => {
                    resolve({ round: mapTowerRoundRow(updatedRow), newBalance: user?.koala_balance, payout });
                  });
                });
              });
            });
          }
        });
      });
    });
  });
};

const getUserTowerClimbCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM TowerClimbRounds WHERE userId = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });
};

// --- Wordle ---
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

// --- Blackjack ---
const getBlackjackStats = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM BlackjackStats WHERE userId = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row || { userId, gamesPlayed: 0, blackjacksHit: 0, totalWagered: 0, totalWon: 0 });
    });
  });
};

const upsertBlackjackStats = (userId, username, statDelta = {}) => {
  return new Promise((resolve, reject) => {
    const { gamesPlayed = 0, blackjacksHit = 0, totalWagered = 0, totalWon = 0 } = statDelta;
    const query = `
      INSERT INTO BlackjackStats (userId, username, gamesPlayed, blackjacksHit, totalWagered, totalWon, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(userId) DO UPDATE SET
        username = excluded.username,
        gamesPlayed = gamesPlayed + excluded.gamesPlayed,
        blackjacksHit = blackjacksHit + excluded.blackjacksHit,
        totalWagered = totalWagered + excluded.totalWagered,
        totalWon = totalWon + excluded.totalWon,
        updatedAt = CURRENT_TIMESTAMP
    `;
    db.run(query, [userId, username, gamesPlayed, blackjacksHit, totalWagered, totalWon], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const applyBlackjackSettlement = (results = []) => {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(results) || results.length === 0) {
      resolve([]);
      return;
    }

    const statsQuery = `
      INSERT INTO BlackjackStats (userId, username, gamesPlayed, blackjacksHit, totalWagered, totalWon, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(userId) DO UPDATE SET
        username = excluded.username,
        gamesPlayed = gamesPlayed + excluded.gamesPlayed,
        blackjacksHit = blackjacksHit + excluded.blackjacksHit,
        totalWagered = totalWagered + excluded.totalWagered,
        totalWon = totalWon + excluded.totalWon,
        updatedAt = CURRENT_TIMESTAMP
    `;

    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
          reject(beginErr);
        }
      });

      for (const res of results) {
        if (res.payout > 0) {
          db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [res.payout, res.userId]);
          db.run(
            'INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)',
            [res.userId, res.payout, res.settlementType === 'sideBet' ? `Blackjack Side Bet Win (${res.sideBetKey || 'sideBet'}: ${res.bet})` : `Blackjack Win (Bet: ${res.bet})`]
          );
        }

        if (res.settlementType !== 'sideBet') {
          db.run(statsQuery, [
            res.userId,
            res.username,
            1,
            res.blackjack ? 1 : 0,
            res.bet || 0,
            res.payout || 0
          ]);
        }
      }

      db.run('COMMIT', (commitErr) => {
        if (commitErr) {
          reject(commitErr);
          return;
        }

        const affectedUserIds = [...new Set(results.map((entry) => entry?.userId).filter(Boolean))];
        if (affectedUserIds.length === 0) {
          resolve([]);
          return;
        }

        const placeholders = affectedUserIds.map(() => '?').join(', ');
        db.all(
          `SELECT id AS userId, koala_balance AS balance FROM Users WHERE id IN (${placeholders})`,
          affectedUserIds,
          (selectErr, rows) => {
            if (selectErr) {
              reject(selectErr);
              return;
            }
            resolve(rows || []);
          }
        );
      });
    });
  });
};

const applyBlackjackRoundBuyIn = (entries = []) => {
  return new Promise((resolve, reject) => {
    const normalizedEntries = Array.isArray(entries)
      ? entries
          .filter((entry) => entry?.userId && Number(entry?.amount) > 0)
          .map((entry) => ({
            userId: String(entry.userId),
            amount: Number(entry.amount) + Math.max(0, Number(entry.sideBetAmount || 0))
          }))
      : [];

    if (normalizedEntries.length === 0) {
      resolve([]);
      return;
    }

    const userIds = [...new Set(normalizedEntries.map((entry) => entry.userId))];
    const amountByUserId = new Map();
    normalizedEntries.forEach((entry) => {
      amountByUserId.set(entry.userId, (amountByUserId.get(entry.userId) || 0) + entry.amount);
    });

    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
          reject(beginErr);
        }
      });

      const placeholders = userIds.map(() => '?').join(', ');
      db.all(
        `SELECT id, CAST(koala_balance AS INTEGER) AS koala_balance FROM Users WHERE id IN (${placeholders})`,
        userIds,
        (userErr, rows) => {
          if (userErr) {
            db.run('ROLLBACK', () => reject(userErr));
            return;
          }

          const balances = new Map((rows || []).map((row) => [String(row.id), Number(row.koala_balance || 0)]));
          for (const userId of userIds) {
            if (!balances.has(userId)) {
              db.run('ROLLBACK', () => reject(new Error('User not found.')));
              return;
            }
            if (balances.get(userId) < (amountByUserId.get(userId) || 0)) {
              db.run('ROLLBACK', () => reject(new Error('Not enough KoalaCoins.')));
              return;
            }
          }

          let pendingStatements = userIds.length * 2;
          const onStatementDone = (statementErr) => {
            if (statementErr) {
              db.run('ROLLBACK', () => reject(statementErr));
              return;
            }

            pendingStatements -= 1;
            if (pendingStatements > 0) return;

            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                reject(commitErr);
                return;
              }

              db.all(
                `SELECT id AS userId, koala_balance AS balance FROM Users WHERE id IN (${placeholders})`,
                userIds,
                (selectErr, updatedRows) => {
                  if (selectErr) reject(selectErr);
                  else resolve(updatedRows || []);
                }
              );
            });
          };

          userIds.forEach((userId) => {
            const amount = amountByUserId.get(userId) || 0;
            db.run(
              'UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?',
              [amount, userId],
              onStatementDone
            );
            db.run(
              'INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)',
              [userId, -amount, `Blackjack Round Buy-In (${amount})`],
              onStatementDone
            );
          });
        }
      );
    });
  });
};

const applyBlackjackBetDelta = (userId, deltaCents = 0, reason = 'Blackjack Bet') => {
  return new Promise((resolve, reject) => {
    const normalizedDelta = Number(deltaCents || 0);
    if (!userId) {
      reject(new Error('userId is required'));
      return;
    }

    if (!Number.isFinite(normalizedDelta)) {
      reject(new Error('deltaCents must be a finite number'));
      return;
    }

    if (normalizedDelta === 0) {
      db.get('SELECT CAST(koala_balance AS INTEGER) AS koala_balance FROM Users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row ? Number(row.koala_balance) : 0);
      });
      return;
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
          reject(beginErr);
        }
      });

      db.get('SELECT CAST(koala_balance AS INTEGER) AS koala_balance FROM Users WHERE id = ?', [userId], (userErr, user) => {
        if (userErr || !user) {
          db.run('ROLLBACK', () => reject(userErr || new Error('User not found')));
          return;
        }

        if (normalizedDelta > 0 && Number(user.koala_balance || 0) < normalizedDelta) {
          db.run('ROLLBACK', () => reject(new Error('Not enough KoalaCoins.')));
          return;
        }

        const balanceChange = -normalizedDelta;
        db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [balanceChange, userId], (updateErr) => {
          if (updateErr) {
            db.run('ROLLBACK', () => reject(updateErr));
            return;
          }

          db.run(
            'INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)',
            [userId, balanceChange, reason],
            (txErr) => {
              if (txErr) {
                db.run('ROLLBACK', () => reject(txErr));
                return;
              }

              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  reject(commitErr);
                  return;
                }

                db.get('SELECT CAST(koala_balance AS INTEGER) AS koala_balance FROM Users WHERE id = ?', [userId], (balanceErr, row) => {
                  if (balanceErr) reject(balanceErr);
                  else resolve(row ? Number(row.koala_balance) : 0);
                });
              });
            }
          );
        });
      });
    });
  });
};

const getBlackjackLeaderboard = (sortBy = 'totalWon', limit = 50) => {
  return new Promise((resolve, reject) => {
    const validSorts = ['totalWon', 'gamesPlayed', 'blackjacksHit', 'totalWagered'];
    const sortColumn = validSorts.includes(sortBy) ? sortBy : 'totalWon';
    const query = `
      SELECT bs.*, u.displayName, u.preferences
      FROM BlackjackStats bs
      JOIN Users u ON bs.userId = u.id
      ORDER BY bs.${sortColumn} DESC
      LIMIT ?
    `;
    db.all(query, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getUserBlackjackGames = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COALESCE(gamesPlayed, 0) as gamesPlayed FROM BlackjackStats WHERE userId = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.gamesPlayed : 0);
    });
  });
};

// --- Lotto ---
const getLottoConfig = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM GlobalGameStats WHERE gameId = 'lotto'", (err, stats) => {
      if (err) return reject(err);
      const finalStats = stats || { totalPayout: 0, totalWins: 0, totalPlayed: 0 };
      db.get("SELECT COUNT(*) as totalPending FROM LottoTickets WHERE status = 'pending'", (err, pendRow) => {
        if (err) return reject(err);
        finalStats.totalPending = pendRow ? pendRow.totalPending : 0;
        db.get("SELECT * FROM LottoDrawings ORDER BY drawDate DESC LIMIT 1", (err, lastDraw) => {
          if (err) return reject(err);
          if (!lastDraw) return resolve({ stats: finalStats, lastDraw: null });
          db.all("SELECT winClass, COUNT(*) as winnerCount FROM LottoTickets WHERE drawDate = ? AND winClass > 0 GROUP BY winClass", [lastDraw.drawDate], (err, winnerRows) => {
            if (err) return reject(err);
            const winnersByClass = {};
            winnerRows.forEach(row => winnersByClass[row.winClass] = row.winnerCount);
            lastDraw.winnersByClass = winnersByClass;
            resolve({ stats: finalStats, lastDraw });
          });
        });
      });
    });
  });
};

const purchaseLottoTickets = (userId, tickets, drawDate) => {
  return new Promise((resolve, reject) => {
    const totalCost = tickets.length * 100;
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (err, user) => {
        if (err || !user || user.koala_balance < totalCost) return db.run('ROLLBACK', () => reject(new Error(user ? 'Not enough KoalaCoins.' : 'User not found.')));
        db.all("SELECT numbers, superzahl FROM LottoTickets WHERE userId = ? AND drawDate = ?", [userId, drawDate], (err, existingRows) => {
          if (err) return db.run('ROLLBACK', () => reject(err));
          if ((existingRows ? existingRows.length : 0) + tickets.length > 100) return db.run('ROLLBACK', () => reject(new Error('Tägliches Limit erreicht. (Max 100)')));
          db.run('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?', [totalCost, userId]);
          db.run('UPDATE GlobalGameStats SET totalPlayed = totalPlayed + ? WHERE gameId = ?', [tickets.length, 'lotto']);
          db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, -totalCost, `Lotto Kauf (${tickets.length}x)`]);
          const stmt = db.prepare('INSERT INTO LottoTickets (userId, drawDate, numbers, superzahl) VALUES (?, ?, ?, ?)');
          tickets.forEach(t => stmt.run([userId, drawDate, JSON.stringify(t.numbers.sort((a,b) => a-b)), t.superzahl]));
          stmt.finalize();
          db.run('COMMIT', (err) => err ? reject(err) : resolve({ newBalance: user.koala_balance - totalCost }));
        });
      });
    });
  });
};

const getUserLottoTicketCountForDraw = (userId, drawDate) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM LottoTickets WHERE userId = ? AND drawDate = ?", [userId, drawDate], (err, row) => err ? reject(err) : resolve(row ? row.count : 0));
  });
};

const executeLottoDraw = (drawDate, drawnNumbers, drawnSuperzahl) => {
  const { determineWinClass, getPayoutForClass } = require('../config/lotto.js');
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.all("SELECT * FROM LottoTickets WHERE drawDate = ? AND status = 'pending'", [drawDate], (err, tickets) => {
        if (err) return db.run('ROLLBACK', () => reject(err));
        let totalPayout = 0; let totalWinners = 0; const userPayouts = {};
        for (const ticket of tickets) {
          const ticketNumbers = JSON.parse(ticket.numbers);
          const winClass = determineWinClass(ticketNumbers, ticket.superzahl, drawnNumbers, drawnSuperzahl);
          const payout = getPayoutForClass(winClass);
          db.run("UPDATE LottoTickets SET matchCount = ?, superzahlMatch = ?, winClass = ?, winAmount = ?, status = 'drawn' WHERE id = ?", [ticketNumbers.filter(n => drawnNumbers.includes(n)).length, ticket.superzahl === drawnSuperzahl ? 1 : 0, winClass, payout, ticket.id]);
          if (payout > 0) { totalPayout += payout; totalWinners++; userPayouts[ticket.userId] = (userPayouts[ticket.userId] || 0) + payout; }
        }
        for (const [userId, amount] of Object.entries(userPayouts)) {
          db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [amount, userId]);
          db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, amount, `Lotto Gewinn (${drawDate})`]);
        }
        db.run('UPDATE GlobalGameStats SET totalPayout = totalPayout + ?, totalWins = totalWins + ? WHERE gameId = ?', [totalPayout, totalWinners, 'lotto']);
        db.run('INSERT INTO LottoDrawings (drawDate, numbers, superzahl, totalTickets, totalWinners, totalPayout) VALUES (?, ?, ?, ?, ?, ?)', [drawDate, JSON.stringify(drawnNumbers), drawnSuperzahl, tickets.length, totalWinners, totalPayout]);
        db.run('COMMIT', (err) => err ? reject(err) : resolve({ drawDate, numbers: drawnNumbers, superzahl: drawnSuperzahl, totalTickets: tickets.length, totalWinners, totalPayout }));
      });
    });
  });
};

const getUserLottoHistory = (userId, limit = 999) => {
  return new Promise((resolve, reject) => {
    const q = 'SELECT t.*, d.numbers as drawNumbers, d.superzahl as drawSuperzahl, d.totalPayout as drawTotalPayout FROM LottoTickets t LEFT JOIN LottoDrawings d ON t.drawDate = d.drawDate WHERE t.userId = ? ORDER BY t.drawDate DESC, t.winAmount DESC LIMIT ?';
    db.all(q, [userId, limit], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const getLottoDrawHistory = (limit = 30) => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM LottoDrawings ORDER BY drawDate DESC LIMIT ?", [limit], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const getUserLifetimeLottoTicketCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM LottoTickets WHERE userId = ?', [userId], (err, row) => err ? reject(err) : resolve(row ? row.count : 0));
  });
};

// --- Fortune Cookies ---
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

// --- LoL Idle Game ---
const getIdleProfile = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Idle_Profiles WHERE userId = ?', [userId], (err, row) => {
      if (err) reject(err);
      else { if (row && (row.dollars === null || row.dollars < 1000000)) row.dollars = 1000000; resolve(row); }
    });
  });
};

const createIdleProfile = (userId) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO Idle_Profiles (userId) VALUES (?)', [userId], function (err) { err ? reject(err) : resolve(this.changes); });
  });
};

const updateIdleProfile = (userId, data) => {
  return new Promise((resolve, reject) => {
    const keys = Object.keys(data); if (keys.length === 0) return resolve(0);
    const fields = keys.map(k => `${k} = ?`).join(', ');
    db.run(`UPDATE Idle_Profiles SET ${fields} WHERE userId = ?`, [...Object.values(data), userId], function (err) { err ? reject(err) : resolve(this.changes); });
  });
};

const updateInventoryUnit = (id, data) => {
  return new Promise((resolve, reject) => {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    db.run(`UPDATE Idle_Inventory SET ${fields} WHERE id = ?`, [...Object.values(data), id], (err) => err ? reject(err) : resolve());
  });
};

const getIdleInventory = (userId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Idle_Inventory WHERE userId = ?', [userId], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const addInventoryUnit = (userId, teamCode, rarity = 'Common', baseStats = 10, role = 'Top') => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO Idle_Inventory (userId, team_code, rarity, base_stats, role, level) VALUES (?, ?, ?, ?, ?, ?)', [userId, teamCode, rarity, baseStats, role, 1], function (err) { err ? reject(err) : resolve({ id: this.lastID, userId, team_code: teamCode, tier: 1, rarity, base_stats: baseStats, role, level: 1 }); });
  });
};

const deleteInventoryUnit = (unitId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM Idle_Inventory WHERE id = ?', [unitId], (err) => err ? reject(err) : resolve());
  });
};

const mergeInventoryUnits = (userId, teamCode, tier, role) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.all('SELECT id FROM Idle_Inventory WHERE userId = ? AND team_code = ? AND tier = ? AND role = ? AND is_equipped = 0 LIMIT 3', [userId, teamCode, tier, role], (err, rows) => {
        if (err || rows.length < 3) return db.run('ROLLBACK', () => reject(err || new Error('Not enough units')));
        const ids = rows.map(r => r.id);
        db.run(`DELETE FROM Idle_Inventory WHERE id IN (${ids.join(',')})`, (err) => {
          if (err) return db.run('ROLLBACK', () => reject(err));
          db.run('INSERT INTO Idle_Inventory (userId, team_code, tier, role) VALUES (?, ?, ?, ?)', [userId, teamCode, tier + 1, role], function (err) { if (err) return db.run('ROLLBACK', () => reject(err)); db.run('COMMIT'); resolve({ id: this.lastID, tier: tier + 1, role }); });
        });
      });
    });
  });
};

const mergeAllInventoryUnits = (userId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.all('SELECT id, team_code, tier, role FROM Idle_Inventory WHERE userId = ? AND is_equipped = 0', [userId], async (err, rows) => {
        if (err) return reject(err);
        const groups = {}; rows.forEach(r => { const key = `${r.team_code}-${r.tier}-${r.role}`; if (!groups[key]) groups[key] = []; groups[key].push(r.id); });
        const toDelete = []; const toInsert = [];
        Object.keys(groups).forEach(key => { const ids = groups[key]; const [team_code, tierStr, role] = key.split('-'); const tier = parseInt(tierStr); const sets = Math.floor(ids.length / 3); if (sets > 0) { for (let i = 0; i < sets; i++) { toDelete.push(...ids.slice(i * 3, (i + 1) * 3)); toInsert.push({ team_code, tier: tier + 1, role }); } } });
        if (toDelete.length === 0) return resolve({ changes: 0 });
        db.run('BEGIN TRANSACTION');
        try {
          db.run(`DELETE FROM Idle_Inventory WHERE id IN (${toDelete.join(',')})`);
          const stmt = db.prepare('INSERT INTO Idle_Inventory (userId, team_code, tier, role) VALUES (?, ?, ?, ?)');
          toInsert.forEach(item => stmt.run(userId, item.team_code, item.tier, item.role)); stmt.finalize();
          db.run('COMMIT', (err) => err ? reject(err) : resolve({ changes: toInsert.length }));
        } catch (e) { db.run('ROLLBACK'); reject(e); }
      });
    });
  });
};

const getIdleRoster = (userId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT r.slot_id, i.* FROM Idle_Roster r LEFT JOIN Idle_Inventory i ON r.inventory_id = i.id WHERE r.userId = ? ORDER BY r.slot_id ASC', [userId], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const assignInventoryToRoster = (userId, slotId, inventoryId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      if (inventoryId === null) {
        db.get('SELECT inventory_id FROM Idle_Roster WHERE userId = ? AND slot_id = ?', [userId, slotId], (err, row) => {
          if (row && row.inventory_id) db.run('UPDATE Idle_Inventory SET is_equipped = 0 WHERE id = ?', [row.inventory_id]);
          db.run('UPDATE Idle_Roster SET inventory_id = NULL WHERE userId = ? AND slot_id = ?', [userId, slotId], (err) => err ? (db.run('ROLLBACK'), reject(err)) : (db.run('COMMIT'), resolve()));
        });
      } else {
        db.run('UPDATE Idle_Inventory SET is_equipped = 1 WHERE id = ?', [inventoryId]);
        db.get('SELECT inventory_id FROM Idle_Roster WHERE userId = ? AND slot_id = ?', [userId, slotId], (err, row) => {
          if (row && row.inventory_id) db.run('UPDATE Idle_Inventory SET is_equipped = 0 WHERE id = ?', [row.inventory_id]);
          db.run('INSERT INTO Idle_Roster (userId, slot_id, inventory_id) VALUES (?, ?, ?) ON CONFLICT(userId, slot_id) DO UPDATE SET inventory_id = excluded.inventory_id', [userId, slotId, inventoryId], (err) => err ? (db.run('ROLLBACK'), reject(err)) : (db.run('COMMIT'), resolve()));
        });
      }
    });
  });
};

const updateInventoryXP = (id, amount) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Idle_Inventory SET experience = experience + ? WHERE id = ?', [amount, id], function (err) { err ? reject(err) : resolve(this.changes); });
  });
};

const updateRosterMode = (userId, slotId, mode) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Idle_Roster SET current_mode = ? WHERE userId = ? AND slot_id = ?', [mode, userId, slotId], function (err) { err ? reject(err) : resolve(this.changes); });
  });
};

// --- LEC Rift Defense ---
const addRiftDefenseTower = (userId, teamCode, starLevel = 1, rarityTier = 0) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO RiftDefense_Towers (userId, teamCode, starLevel, rarityTier) VALUES (?, ?, ?, ?)', [userId, teamCode, starLevel, rarityTier], function (err) { err ? reject(err) : resolve({ id: this.lastID, userId, teamCode, starLevel, rarityTier }); });
  });
};

const getUserRiftDefenseTowers = (userId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM RiftDefense_Towers WHERE userId = ? ORDER BY starLevel DESC, teamCode ASC', [userId], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const deleteRiftDefenseTowers = (userId, teamCode, starLevel, limit) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM RiftDefense_Towers WHERE id IN (SELECT id FROM RiftDefense_Towers WHERE userId = ? AND teamCode = ? AND starLevel = ? LIMIT ?)', [userId, teamCode, starLevel, limit], function(err) { err ? reject(err) : resolve(this.changes); });
  });
};

const scrapRiftDefenseTower = (id, userId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM RiftDefense_Towers WHERE id = ? AND userId = ?', [id, userId], function(err) { err ? reject(err) : resolve(this.changes); });
  });
};

const updateRiftDefenseStats = (userId, highestWave, minionsKilled, bossesKilled) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO RiftDefense_Stats (userId, highestWave, totalMinionsKilled, totalBossesKilled) VALUES (?, ?, ?, ?) ON CONFLICT(userId) DO UPDATE SET highestWave = MAX(highestWave, excluded.highestWave), totalMinionsKilled = totalMinionsKilled + excluded.totalMinionsKilled, totalBossesKilled = totalBossesKilled + excluded.totalBossesKilled, updatedAt = CURRENT_TIMESTAMP', [userId, highestWave, minionsKilled, bossesKilled], function(err) { err ? reject(err) : resolve(this.changes); });
  });
};

const getRiftDefenseLeaderboards = () => {
  return new Promise((resolve, reject) => {
    const q = (f) => `SELECT r.userId, u.username, u.displayName, u.preferences, r.${f} as value FROM RiftDefense_Stats r JOIN Users u ON r.userId = u.id ORDER BY r.${f} DESC LIMIT 50`;
    Promise.all([new Promise(res => db.all(q('highestWave'), [], (e, r) => res(r))), new Promise(res => db.all(q('totalMinionsKilled'), [], (e, r) => res(r))), new Promise(res => db.all(q('totalBossesKilled'), [], (e, r) => res(r)))])
      .then(([highestWave, totalMinions, totalBosses]) => resolve({ highestWave, totalMinions, totalBosses })).catch(reject);
  });
};

// --- Other Stats ---
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

const getUserDailyPackCount = (userId, packId) => {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    db.get(
      'SELECT COUNT(*) as count FROM Scratchcards WHERE userId = ? AND type = ? AND date(createdAt) = date(?)',
      [userId, String(packId), today],
      (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      }
    );
  });
};

module.exports = {
  getGlobalGameStats,
  getGameUpgradesConfig,
  purchaseUpgrade,
  getLeaderboardSettings,
  updateLeaderboardSetting,
  addSpeedcubeTime,
  getSpeedcubeTimes,
  updateSpeedcubeNote,
  deleteSpeedcubeTime,
  getGlobalScratchcardStats,
  createScratchcard,
  purchaseScratchcardTransaction,
  getScratchcard,
  getUserPurchasedScratchcard,
  claimScratchcard,
  getScratchcardPools,
  addScratchcardPoolTeam,
  removeScratchcardPoolTeam,
  getScratchcardConfigs,
  updateScratchcardConfig,
  getLatestScratchcardWinners,
  getTopScratchcardWinners,
  getScratchcardLeaderboard,
  getScratchcardLeaderboardData,
  getScratchcardPacks,
  getScratchcardPack,
  createScratchcardPack,
  updateScratchcardPack,
  deleteScratchcardPack,
  getScratchcardPackTeams,
  setScratchcardPackTeams,
  recordGameScore,
  getGameLeaderboards,
  updateUserGameStats,
  getAdminGameScores,
  deleteGameScore,
  getUserWonMatchCount,
  getUserGameRoundCount,
  getActiveTowerRound,
  getLatestTowerRound,
  getTowerHistory,
  startTowerRound,
  resolveTowerPick,
  cashoutTowerRound,
  getUserTowerClimbCount,
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
  getBlackjackStats,
  applyBlackjackBetDelta,
  applyBlackjackRoundBuyIn,
  upsertBlackjackStats,
  applyBlackjackSettlement,
  getBlackjackLeaderboard,
  getUserBlackjackGames,
  getLottoConfig,
  purchaseLottoTickets,
  getUserLottoTicketCountForDraw,
  executeLottoDraw,
  getUserLottoHistory,
  getLottoDrawHistory,
  getUserLifetimeLottoTicketCount,
  getFortuneStatus,
  openDailyFortune,
  addFortunesBulk,
  getFortunesDictionary,
  deleteFortune,
  getUserFortunesCount,
  getIdleProfile,
  createIdleProfile,
  updateIdleProfile,
  updateInventoryUnit,
  getIdleInventory,
  addInventoryUnit,
  deleteInventoryUnit,
  mergeInventoryUnits,
  mergeAllInventoryUnits,
  getIdleRoster,
  assignInventoryToRoster,
  updateInventoryXP,
  updateRosterMode,
  addRiftDefenseTower,
  getUserRiftDefenseTowers,
  deleteRiftDefenseTowers,
  scrapRiftDefenseTower,
  updateRiftDefenseStats,
  getRiftDefenseLeaderboards,
  getUserZeroScoreStreak,
  recordZeroScore,
  getUserTowerClimbCount,
  getUserDailyPackCount,
  getScratchcardChartData
};

const db = require('../connection');

const mapTowerRoundRow = (row) => {
  if (!row) return null;
  const config = require('../../config/towerClimb');
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
          const nextMultiplier = require('../../config/towerClimb').getTowerMultiplierTable(row.tilesPerLevel)[nextLevel];
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

module.exports = {
  getActiveTowerRound,
  getLatestTowerRound,
  getTowerHistory,
  startTowerRound,
  resolveTowerPick,
  cashoutTowerRound,
  getUserTowerClimbCount,
};

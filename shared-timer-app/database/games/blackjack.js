const db = require('../connection');

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

module.exports = {
  getBlackjackStats,
  upsertBlackjackStats,
  applyBlackjackSettlement,
  applyBlackjackRoundBuyIn,
  applyBlackjackBetDelta,
  getBlackjackLeaderboard,
  getUserBlackjackGames,
};

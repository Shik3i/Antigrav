const db = require('../connection');

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
  getScratchcardChartData,
  getScratchcardPacks,
  getScratchcardPack,
  createScratchcardPack,
  updateScratchcardPack,
  deleteScratchcardPack,
  getScratchcardPackTeams,
  setScratchcardPackTeams,
  getUserDailyPackCount,
};

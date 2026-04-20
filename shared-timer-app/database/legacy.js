const path = require('path');
const fs = require('fs');
const { TOWER_CLIMB_CONFIG, getTowerMultiplierTable, getTowerPayout } = require('../config/towerClimb');

// Singleton Connection: Use the shared database instance
const db = require('./connection');
const { logError, logSystemEvent } = require('./logging');




// Speedcube Helpers
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

// Helper functions for stats








// ─── Friends Helpers ───────────────────────────────────────────
const addFriend = (userId, friendId, status = 'pending') => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO Friends (userId, friendId, status) VALUES (?, ?, ?) ON CONFLICT(userId, friendId) DO UPDATE SET status=?, updatedAt=CURRENT_TIMESTAMP',
      [userId, friendId, status, status],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

const removeFriend = (userId, friendId) => {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM Friends WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)',
      [userId, friendId, friendId, userId],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

const getFriends = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        f.status,
        f.userId as requesterId,
        f.friendId as targetId,
        u.id as id,
        u.displayName,
        u.username
      FROM Friends f
      JOIN Users u ON u.id = f.friendId
      WHERE f.userId = ?
      UNION ALL
      SELECT
        f.status,
        f.userId as requesterId,
        f.friendId as targetId,
        u.id as id,
        u.displayName,
        u.username
      FROM Friends f
      JOIN Users u ON u.id = f.userId
      WHERE f.friendId = ?
    `;
    db.all(query, [userId, userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getFriendStatus = (userId, friendId) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT status, userId as requesterId FROM Friends WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)',
      [userId, friendId, friendId, userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

const getAdminFriends = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        f.status,
        f.userId as requesterId,
        f.friendId as targetId,
        u.id as id,
        u.displayName,
        u.username
      FROM Friends f
      JOIN Users u ON u.id = f.friendId
      WHERE f.userId = ?
      UNION ALL
      SELECT
        f.status,
        f.userId as requesterId,
        f.friendId as targetId,
        u.id as id,
        u.displayName,
        u.username
      FROM Friends f
      JOIN Users u ON u.id = f.userId
      WHERE f.friendId = ?
    `;
    db.all(query, [userId, userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// ─── Guest Account Merge ─────────────────────────────────────────


// ─── Leagues & Mappings ─────────────────────────────────────────────
const getTeamMappings = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM TeamMappings', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getTeamMapping = (originalCode) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT polymarketCode FROM TeamMappings WHERE originalCode = ?', [originalCode.toUpperCase()], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.polymarketCode : null);
    });
  });
};

const addTeamMapping = (originalCode, polymarketCode) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO TeamMappings (originalCode, polymarketCode) VALUES (?, ?) ON CONFLICT(originalCode) DO UPDATE SET polymarketCode=excluded.polymarketCode',
      [originalCode.toUpperCase(), polymarketCode.toUpperCase()],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

const deleteTeamMapping = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM TeamMappings WHERE id = ?', [id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

// ─── Scratchcards Helpers ─────────────────────────────────────
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

      // 1. Check & Deduct Balance
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

          // [Global Stats] Increment total sold tickets
          db.run('UPDATE GlobalGameStats SET totalPlayed = totalPlayed + 1 WHERE gameId = ?', ['scratchcards']);

          // 2. Create Scratchcard (This atomic insert effectively records the "buy" for the daily limit count)
          db.run(
            'INSERT INTO Scratchcards (userId, type, grid, winAmount, status, price) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, String(packId), JSON.stringify(grid), winAmount, 'purchased', price],
            function (insErr) {
              if (insErr) {
                db.run('ROLLBACK');
                return reject(insErr);
              }
              const cardId = this.lastID;

              // 3. Log Transaction
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
              // Log transaction
              db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, card.winAmount, `Scratchcard Win (ID: ${id})`], (txErr) => {
                if (txErr) return reject(txErr);

                // [Global Stats] Increment total winnings and success count
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

// ─── Admin Dashboard Helpers ─────────────────────────────────────





// ─── Banning System ────────────────────────────────────────────────

const upsertEsportsTeams = (teams) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(`
        INSERT INTO EsportsTeams (code, name, league, image, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(code) DO UPDATE SET
          name = excluded.name,
          league = excluded.league,
          image = excluded.image,
          updated_at = CURRENT_TIMESTAMP
      `);

      let hasError = false;
      teams.forEach(t => {
        stmt.run([t.code, t.name, t.league || null, t.image || null], (err) => {
          if (err) {
            console.error('Error upserting team:', t.code, err);
            hasError = true;
          }
        });
      });

      stmt.finalize();

      if (hasError) {
        db.run('ROLLBACK', () => reject(new Error('Failed to upsert all teams')));
      } else {
        db.run('COMMIT', () => resolve(true));
      }
    });
  });
};

const getAllEsportsTeams = () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT code, name, league, image FROM EsportsTeams ORDER BY name ASC`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getEsportsTeamsLastUpdated = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT MAX(updated_at) as last_updated FROM EsportsTeams`, (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.last_updated : null);
    });
  });
};

// --- KOALA COINS ---

// --- POLYMARKET SETTINGS ---
const getPolymarketSettings = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT value FROM ServerSettings WHERE key = 'polymarket_allow_users_add'`, (err, row) => {
      if (err) reject(err);
      else {
        // Default to false (0) if not set
        resolve({ allowUsersToAdd: row ? row.value === '1' : false });
      }
    });
  });
};

const updatePolymarketSettings = (allowUsersAdd) => {
  return new Promise((resolve, reject) => {
    const value = allowUsersAdd ? '1' : '0';
    db.run(`INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('polymarket_allow_users_add', ?)`, [value], function(err) {
      if (err) reject(err);
      else resolve(true);
    });
  });
};



// ─── Countdowns ─────────────────────────────────────────────
const getCountdowns = (userId = null) => {
  return new Promise((resolve, reject) => {
    // Return global + public countdowns for everyone, plus private ones for the logged-in user
    let query, params;
    if (userId) {
      query = `SELECT * FROM Countdowns WHERE isGlobal = 1 OR isPublic = 1 OR userId = ? ORDER BY targetDate ASC`;
      params = [userId];
    } else {
      query = `SELECT * FROM Countdowns WHERE isGlobal = 1 OR isPublic = 1 ORDER BY targetDate ASC`;
      params = [];
    }
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const createCountdown = (eventName, targetDate, userId, creatorName, isPublic, isGlobal) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO Countdowns (eventName, targetDate, userId, creatorName, isPublic, isGlobal) VALUES (?, ?, ?, ?, ?, ?)`,
      [eventName, targetDate, userId, creatorName, isPublic ? 1 : 0, isGlobal ? 1 : 0],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
};

const deleteCountdown = (id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM Countdowns WHERE id = ?`, [id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getCountdownById = (id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM Countdowns WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};


// ─── Bets ──────────────────────────────────────────────
const createBet = (userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate, league, team1Logo, team2Logo) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO Bets (userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate, league, team1Logo, team2Logo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate, league, team1Logo, team2Logo],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
};

const getUserBets = (userId, limit = 50) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Bets WHERE userId = ? ORDER BY createdAt DESC LIMIT ?', [userId, limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getUnresolvedPastBets = () => {
  return new Promise((resolve, reject) => {
    // Bets that are open and eventDate is older than 3 hours ago
    const query = `
      SELECT * FROM Bets 
      WHERE status = 'open' 
      AND datetime(eventDate) <= datetime('now', '-1 hours')
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const hasUnresolvedBetsForMatch = (nameOrUrl) => {
  console.log('[DEBUG-TEST] DB Query sucht nach nameOrUrl:', nameOrUrl);
  
  // Peeking at a sample from the DB (temporary debug helper)
  db.get('SELECT matchName FROM Bets LIMIT 1', (err, row) => {
    if (row) console.log('[DEBUG-TEST] Beispiel-Eintrag aus der Spalte matchName:', row.matchName);
  });

  return new Promise((resolve, reject) => {
    // Check both matchName and polymarketUrl as fallback
    db.get('SELECT COUNT(*) as count FROM Bets WHERE (matchName = ? OR polymarketUrl = ?) AND status = ?', [nameOrUrl, nameOrUrl, 'open'], (err, row) => {
      if (err) reject(err);
      else resolve(row?.count > 0);
    });
  });
};

const resolveBetAtomic = (betId, newStatus, payoutAmount, reason) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.get('SELECT status, userId FROM Bets WHERE id = ?', [betId], (err, row) => {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }
        if (!row) {
          db.run('ROLLBACK');
          return reject(new Error('Bet not found'));
        }
        if (row.status !== 'open') {
          // Already resolved by another process!
          db.run('COMMIT');
          return resolve({ success: false, reason: 'Already resolved' });
        }

        db.run('UPDATE Bets SET status = ? WHERE id = ?', [newStatus, betId], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }

          if (payoutAmount > 0) {
            db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)',
              [row.userId, payoutAmount, reason], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }
                db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [payoutAmount, row.userId], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                  }
                  db.run('COMMIT');
                  resolve({ success: true });
                });
              });
          } else {
            db.run('COMMIT');
            resolve({ success: true });
          }
        });
      });
    });
  });
};

const updateBetStatus = (betId, newStatus) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Bets SET status = ? WHERE id = ?', [newStatus, betId], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getAllBetsAdmin = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT b.*, u.displayName as userName
      FROM Bets b
      LEFT JOIN Users u ON b.userId = u.id
      ORDER BY b.createdAt DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getRecentBets = (days = 7) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT b.*, u.displayName as userName, u.preferences as userPreferences
      FROM Bets b
      LEFT JOIN Users u ON b.userId = u.id
      WHERE b.createdAt >= datetime('now', '-' || ? || ' days')
      ORDER BY 
        CASE WHEN b.status = 'open' THEN 0 ELSE 1 END ASC,
        CASE WHEN b.status = 'open' THEN b.eventDate END ASC,
        b.eventDate DESC
    `;
    db.all(query, [days], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const updateBetStatusAdmin = (betId, newStatus) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.get('SELECT * FROM Bets WHERE id = ?', [betId], (err, bet) => {
        if (err || !bet) {
          db.run('ROLLBACK');
          return reject(err || new Error('Bet not found'));
        }

        const oldStatus = bet.status;
        if (oldStatus === newStatus) {
            db.run('COMMIT');
            return resolve(0);
        }

        const payout = Math.floor(bet.stake * bet.odds);
        let coinAdjustment = 0;
        let logReason = '';

        if (oldStatus === 'won' && newStatus !== 'won') {
            // Revert won payout
            coinAdjustment -= payout;
            logReason = `Admin Revert: Bet ${newStatus} from Won on ${bet.chosenTeam}`;
        } else if (oldStatus === 'canceled' && newStatus !== 'canceled') {
            // Revert canceled refund
            coinAdjustment -= bet.stake;
            logReason = `Admin Revert: Bet ${newStatus} from Canceled on ${bet.chosenTeam}`;
        }

        if (newStatus === 'won' && oldStatus !== 'won') {
            // Award won payout
            coinAdjustment += payout;
            logReason = `Admin Resolve: Bet Won on ${bet.chosenTeam}`;
        } else if (newStatus === 'canceled' && oldStatus !== 'canceled') {
            // Award canceled refund
            coinAdjustment += bet.stake;
            logReason = `Admin Resolve: Bet Canceled (Refund) on ${bet.chosenTeam}`;
        }

        db.run('UPDATE Bets SET status = ? WHERE id = ?', [newStatus, betId], function(err) {
            if (err) {
                db.run('ROLLBACK');
                return reject(err);
            }

            if (coinAdjustment !== 0) {
               db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)',
                    [bet.userId, coinAdjustment, logReason], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }
                    db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [coinAdjustment, bet.userId], function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        db.run('COMMIT');
                        resolve(1);
                    });
               });
            } else {
                db.run('COMMIT');
                resolve(1);
            }
        });
      });
    });
  });
};

// ─── Admin Action Logging ────────────────────────────────────────
const logAdminAction = (adminId, adminName, action, details) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO AdminActions (adminId, adminName, action, details) VALUES (?, ?, ?, ?)',
      [adminId, adminName, action, typeof details === 'object' ? JSON.stringify(details) : details],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

const getAdminActions = (limit = 100) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM AdminActions ORDER BY timestamp DESC LIMIT ?', [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// ─── Feature Request Roadmap ─────────────────────────────────────
const createFeatureRequest = (userId, userName, title, description, type = 'Feature') => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO FeatureRequests (userId, userName, title, description, type) VALUES (?, ?, ?, ?, ?)',
      [userId, userName, title, description, type],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

const getUserFeatureRequestCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM FeatureRequests WHERE userId = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
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

const getFeatureRequests = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT fr.*, 
             (SELECT SUM(value) FROM FeatureVotes WHERE requestId = fr.id) as score,
             (SELECT COUNT(*) FROM FeatureVotes WHERE requestId = fr.id AND value = 1) as upvotes,
             (SELECT COUNT(*) FROM FeatureVotes WHERE requestId = fr.id AND value = -1) as downvotes
      FROM FeatureRequests fr
      ORDER BY score DESC, fr.createdAt DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const voteFeatureRequest = (requestId, userId, value) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO FeatureVotes (requestId, userId, value) VALUES (?, ?, ?) ON CONFLICT(requestId, userId) DO UPDATE SET value = excluded.value',
      [requestId, userId, value],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

const updateFeatureStatus = (requestId, status) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE FeatureRequests SET status = ? WHERE id = ?', [status, requestId], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateFeatureAdminComment = (requestId, comment) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE FeatureRequests SET adminComment = ? WHERE id = ?', [comment, requestId], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const deleteFeatureRequest = (requestId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM FeatureRequests WHERE id = ?', [requestId], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};


const getBettingAccuracyLeaderboard = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
          u.id as userId, 
          u.displayName,
          u.username,
          u.preferences,
          COUNT(*) as totalPredictions,
          SUM(CASE WHEN t.status = 'won' THEN 1 ELSE 0 END) as correctPredictions,
          (CAST(SUM(CASE WHEN t.status = 'won' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*)) * 100 as winRate
      FROM (
          SELECT DISTINCT userId, matchName, chosenTeam, status 
          FROM Bets 
          WHERE status IN ('won', 'lost')
      ) as t
      JOIN Users u ON t.userId = u.id
      GROUP BY u.id
      HAVING totalPredictions >= 1
      ORDER BY winRate DESC, correctPredictions DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
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

const safeJsonParse = (value, fallback) => {
  try {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const mapTowerRoundRow = (row) => {
  if (!row) return null;

  const selectedTiles = safeJsonParse(row.selectedTiles, []);
  const multiplierTable = getTowerMultiplierTable(row.tilesPerLevel);
  const safeCurrentLevel = Math.max(0, Math.min(row.currentLevel || 0, row.levelCount || TOWER_CLIMB_CONFIG.levelCount));
  const currentPayout = row.status === 'cashed_out'
    ? row.payout || 0
    : (row.status === 'running' && safeCurrentLevel > 0
        ? getTowerPayout(row.bet, row.tilesPerLevel, safeCurrentLevel)
        : 0);

  return {
    id: row.id,
    userId: row.userId,
    bet: row.bet,
    tilesPerLevel: row.tilesPerLevel,
    levelCount: row.levelCount,
    currentLevel: safeCurrentLevel,
    currentMultiplier: Number(row.currentMultiplier || multiplierTable[safeCurrentLevel] || 1),
    selectedTiles,
    status: row.status,
    payout: row.payout || 0,
    currentPayout,
    canCashout: row.status === 'running' && safeCurrentLevel > 0,
    multiplierTable,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt
  };
};

const getTowerRoundById = (roundId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM TowerClimbRounds WHERE id = ?', [roundId], (err, row) => {
      if (err) reject(err);
      else resolve(mapTowerRoundRow(row));
    });
  });
};

const getActiveTowerRound = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM TowerClimbRounds WHERE userId = ? AND status = 'running' ORDER BY createdAt DESC LIMIT 1",
      [userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(mapTowerRoundRow(row));
      }
    );
  });
};

const getLatestTowerRound = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM TowerClimbRounds WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      [userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(mapTowerRoundRow(row));
      }
    );
  });
};

const getTowerHistory = (userId, limit = 10) => {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM TowerClimbRounds WHERE userId = ? AND status != 'running' ORDER BY createdAt DESC LIMIT ?",
      [userId, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []).map(mapTowerRoundRow));
      }
    );
  });
};

const startTowerRound = (userId, bet, tilesPerLevel) => {
  return new Promise((resolve, reject) => {
    const trapPattern = Array.from(
      { length: TOWER_CLIMB_CONFIG.levelCount },
      () => Math.floor(Math.random() * tilesPerLevel)
    );

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');

      db.get(
        "SELECT * FROM TowerClimbRounds WHERE userId = ? AND status = 'running' ORDER BY createdAt DESC LIMIT 1",
        [userId],
        (activeErr, activeRow) => {
          if (activeErr) {
            db.run('ROLLBACK');
            return reject(activeErr);
          }

          if (activeRow) {
            db.run('ROLLBACK');
            const error = new Error('A tower round is already running.');
            error.status = 409;
            error.activeRound = mapTowerRoundRow(activeRow);
            return reject(error);
          }

          db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (userErr, user) => {
            if (userErr) {
              db.run('ROLLBACK');
              return reject(userErr);
            }
            if (!user) {
              db.run('ROLLBACK');
              const error = new Error('User not found.');
              error.status = 404;
              return reject(error);
            }
            if ((user.koala_balance || 0) < bet) {
              db.run('ROLLBACK');
              const error = new Error('Not enough KoalaCoins.');
              error.status = 400;
              return reject(error);
            }

            db.run(
              `INSERT INTO TowerClimbRounds (
                userId, bet, tilesPerLevel, levelCount, currentLevel, currentMultiplier,
                selectedTiles, trapPattern, status, payout, updatedAt
              ) VALUES (?, ?, ?, ?, 0, 1, '[]', ?, 'running', 0, CURRENT_TIMESTAMP)`,
              [userId, bet, tilesPerLevel, TOWER_CLIMB_CONFIG.levelCount, JSON.stringify(trapPattern)],
              function (insertErr) {
                if (insertErr) {
                  db.run('ROLLBACK');
                  return reject(insertErr);
                }

                const roundId = this.lastID;

                // [Global Stats] Increment total played runs
                db.run('UPDATE GlobalGameStats SET totalPlayed = totalPlayed + 1 WHERE gameId = ?', ['tower-climb']);
                db.run('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?', [bet, userId], (balanceErr) => {
                  if (balanceErr) {
                    db.run('ROLLBACK');
                    return reject(balanceErr);
                  }

                  db.run(
                    'INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)',
                    [userId, -bet, `Tower Climb Start (Bet: ${(bet / 100).toFixed(2)} KC)`],
                    (txErr) => {
                      if (txErr) {
                        db.run('ROLLBACK');
                        return reject(txErr);
                      }

                      db.run('COMMIT', async (commitErr) => {
                        if (commitErr) return reject(commitErr);

                        try {
                          const round = await getTowerRoundById(roundId);
                          resolve({
                            round,
                            newBalance: (user.koala_balance || 0) - bet
                          });
                        } catch (fetchErr) {
                          reject(fetchErr);
                        }
                      });
                    }
                  );
                });
              }
            );
          });
        }
      );
    });
  });
};

const resolveTowerPick = (userId, tileIndex, expectedLevel) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');

      db.get(
        "SELECT * FROM TowerClimbRounds WHERE userId = ? AND status = 'running' ORDER BY createdAt DESC LIMIT 1",
        [userId],
        (roundErr, row) => {
          if (roundErr) {
            db.run('ROLLBACK');
            return reject(roundErr);
          }

          if (!row) {
            db.run('ROLLBACK');
            const error = new Error('No active tower round found.');
            error.status = 404;
            return reject(error);
          }

          if (tileIndex >= row.tilesPerLevel) {
            db.run('ROLLBACK');
            const error = new Error('Selected tile is out of range.');
            error.status = 400;
            return reject(error);
          }

          const trapPattern = safeJsonParse(row.trapPattern, []);
          const selectedTiles = safeJsonParse(row.selectedTiles, []);

          if (row.currentLevel >= row.levelCount) {
            db.run('ROLLBACK');
            const error = new Error('The tower is complete. Cash out to finish the round.');
            error.status = 400;
            return reject(error);
          }

          if (expectedLevel !== row.currentLevel) {
            db.run('ROLLBACK');
            const error = new Error('The round state has already moved. Please refresh the board.');
            error.status = 409;
            return reject(error);
          }

          if (selectedTiles.some((selection) => selection.level === row.currentLevel)) {
            db.run('ROLLBACK');
            const error = new Error('This level has already been resolved.');
            error.status = 409;
            return reject(error);
          }

          const trapIndex = trapPattern[row.currentLevel];
          const hitTrap = tileIndex === trapIndex;
          const multipliers = getTowerMultiplierTable(row.tilesPerLevel);
          const nextLevel = hitTrap ? row.currentLevel : row.currentLevel + 1;
          const nextMultiplier = multipliers[nextLevel] || row.currentMultiplier || 1;
          const selection = {
            level: row.currentLevel,
            tileIndex,
            trapIndex,
            result: hitTrap ? 'trap' : 'safe'
          };
          const nextSelections = [...selectedTiles, selection];

          const finishRound = hitTrap;
          const nextStatus = finishRound ? 'lost' : 'running';
          const resolvedAt = finishRound ? ', resolvedAt = CURRENT_TIMESTAMP' : '';
          const score = finishRound ? row.currentLevel : null;

          db.run(
            `UPDATE TowerClimbRounds
             SET currentLevel = ?, currentMultiplier = ?, selectedTiles = ?, status = ?, updatedAt = CURRENT_TIMESTAMP${resolvedAt}
             WHERE id = ?`,
            [nextLevel, nextMultiplier, JSON.stringify(nextSelections), nextStatus, row.id],
            (updateErr) => {
              if (updateErr) {
                db.run('ROLLBACK');
                return reject(updateErr);
              }

              const finalizeCommit = async () => {
                db.run('COMMIT', async (commitErr) => {
                  if (commitErr) return reject(commitErr);

                  try {
                    const [round, user] = await Promise.all([
                      getTowerRoundById(row.id),
                      getUser(userId)
                    ]);
                    resolve({
                      round,
                      outcome: hitTrap ? 'trap' : 'safe',
                      newBalance: user?.koala_balance || 0
                    });
                  } catch (fetchErr) {
                    reject(fetchErr);
                  }
                });
              };

              if (!finishRound) {
                return finalizeCommit();
              }

              db.run(
                'INSERT INTO GameScores (userId, gameId, score, coinsEarned) VALUES (?, ?, ?, ?)',
                [userId, TOWER_CLIMB_CONFIG.gameId, score, 0],
                (scoreErr) => {
                  if (scoreErr) {
                    db.run('ROLLBACK');
                    return reject(scoreErr);
                  }
                  finalizeCommit();
                }
              );
            }
          );
        }
      );
    });
  });
};

const cashoutTowerRound = (userId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');

      db.get(
        "SELECT * FROM TowerClimbRounds WHERE userId = ? AND status = 'running' ORDER BY createdAt DESC LIMIT 1",
        [userId],
        (roundErr, row) => {
          if (roundErr) {
            db.run('ROLLBACK');
            return reject(roundErr);
          }

          if (!row) {
            db.run('ROLLBACK');
            const error = new Error('No active tower round found.');
            error.status = 404;
            return reject(error);
          }

          if (row.currentLevel <= 0) {
            db.run('ROLLBACK');
            const error = new Error('You must clear at least one level before cashing out.');
            error.status = 400;
            return reject(error);
          }

          const payout = getTowerPayout(row.bet, row.tilesPerLevel, row.currentLevel);

          db.run(
            `UPDATE TowerClimbRounds
             SET status = 'cashed_out', payout = ?, updatedAt = CURRENT_TIMESTAMP, resolvedAt = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [payout, row.id],
            (updateErr) => {
              if (updateErr) {
                db.run('ROLLBACK');
                return reject(updateErr);
              }

              db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [payout, userId], (balanceErr) => {
                if (balanceErr) {
                  db.run('ROLLBACK');
                  return reject(balanceErr);
                }

                db.run(
                  'INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)',
                  [userId, payout, `Tower Climb Cashout (Level ${row.currentLevel}, x${Number(row.currentMultiplier || 1).toFixed(2)})`],
                  (txErr) => {
                    if (txErr) {
                      db.run('ROLLBACK');
                      return reject(txErr);
                    }

                    // Increment Global Game Stats
                    db.run('UPDATE GlobalGameStats SET totalPayout = totalPayout + ?, totalWins = totalWins + 1 WHERE gameId = ?', [payout, 'tower-climb']);

                    db.run(
                      'INSERT INTO GameScores (userId, gameId, score, coinsEarned) VALUES (?, ?, ?, ?)',
                      [userId, TOWER_CLIMB_CONFIG.gameId, row.currentLevel, payout],
                      (scoreErr) => {
                        if (scoreErr) {
                          db.run('ROLLBACK');
                          return reject(scoreErr);
                        }

                        db.run('COMMIT', async (commitErr) => {
                          if (commitErr) return reject(commitErr);

                          try {
                            const [round, user] = await Promise.all([
                              getTowerRoundById(row.id),
                              getUser(userId)
                            ]);
                            resolve({
                              round,
                              payout,
                              newBalance: user?.koala_balance || 0
                            });
                          } catch (fetchErr) {
                            reject(fetchErr);
                          }
                        });
                      }
                    );
                  }
                );
              });
            }
          );
        }
      );
    });
  });
};

const getGlobalGameStats = (gameId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT totalPayout as total_won, totalWins as total_count, totalPlayed as total_played FROM GlobalGameStats WHERE gameId = ?', [gameId], (err, row) => {
      if (err) reject(err);
      else resolve({
        total_won: row?.total_won || 0,
        total_count: row?.total_count || 0,
        total_played: row?.total_played || 0
      });
    });
  });
};

const getBlackjackLeaderboard = (sortBy = 'totalWon', limit = 50) => {
  return new Promise((resolve, reject) => {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const allowedSorts = {
      totalWon: 'bs.totalWon DESC, bs.gamesPlayed DESC',
      gamesPlayed: 'bs.gamesPlayed DESC, bs.totalWon DESC',
      blackjacksHit: 'bs.blackjacksHit DESC, bs.totalWon DESC',
      totalWagered: 'bs.totalWagered DESC, bs.totalWon DESC'
    };
    const orderBy = allowedSorts[sortBy] || allowedSorts.totalWon;

    db.all(
      `SELECT
         bs.userId,
         bs.username,
         COALESCE(u.displayName, bs.username) AS displayName,
         u.preferences,
         bs.gamesPlayed,
         bs.blackjacksHit,
         bs.totalWagered,
         bs.totalWon,
         bs.updatedAt
       FROM BlackjackStats bs
       LEFT JOIN Users u ON u.id = bs.userId
       ORDER BY ${orderBy}
       LIMIT ?`,
      [safeLimit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
};

const upsertBlackjackStats = (userId, username, statDelta = {}) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO BlackjackStats (
         userId, username, gamesPlayed, blackjacksHit, totalWagered, totalWon, updatedAt
       ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(userId) DO UPDATE SET
         username = excluded.username,
         gamesPlayed = gamesPlayed + excluded.gamesPlayed,
         blackjacksHit = blackjacksHit + excluded.blackjacksHit,
         totalWagered = totalWagered + excluded.totalWagered,
         totalWon = totalWon + excluded.totalWon,
         updatedAt = CURRENT_TIMESTAMP`,
      [
        userId,
        username,
        Number(statDelta.gamesPlayed || 0),
        Number(statDelta.blackjacksHit || 0),
        Number(statDelta.totalWagered || 0),
        Number(statDelta.totalWon || 0)
      ],
      function upsertBlackjackStatsCallback(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

const applyBlackjackSettlement = (results = []) => {
  return new Promise((resolve, reject) => {
    const participants = (results || []).filter((entry) => entry?.userId);
    if (participants.length === 0) {
      resolve([]);
      return;
    }

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');

      let index = 0;
      const updatedBalances = [];

      const rollback = (err) => {
        db.run('ROLLBACK', () => reject(err));
      };

      const commit = () => {
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            reject(commitErr);
            return;
          }
          resolve(updatedBalances);
        });
      };

      const processNext = () => {
        if (index >= participants.length) {
          commit();
          return;
        }

        const entry = participants[index];
        index += 1;

        db.get(
          'SELECT CAST(koala_balance AS INTEGER) AS koala_balance FROM Users WHERE id = ?',
          [entry.userId],
          (userErr, userRow) => {
            if (userErr) {
              rollback(userErr);
              return;
            }

            if (!userRow) {
              rollback(new Error(`Blackjack settlement user not found: ${entry.userId}`));
              return;
            }

            const netProfit = Number(entry.netProfit || 0);
            const currentBalance = Number(userRow.koala_balance || 0);
            const nextBalance = currentBalance + netProfit;
            const txReason = `Blackjack ${entry.result} (${(Number(entry.bet || 0) / 100).toFixed(2)} KC bet)`;

            db.run(
              'UPDATE Users SET koala_balance = ? WHERE id = ?',
              [nextBalance, entry.userId],
              (updateErr) => {
                if (updateErr) {
                  rollback(updateErr);
                  return;
                }

                const writeTransaction = () => {
                  if (netProfit === 0) {
                    return writeStats();
                  }

                  db.run(
                    'INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)',
                    [entry.userId, netProfit, txReason],
                    (txErr) => {
                      if (txErr) {
                        rollback(txErr);
                        return;
                      }
                      writeStats();
                    }
                  );
                };

                const writeStats = () => {
                  db.run(
                    `INSERT INTO BlackjackStats (
                       userId, username, gamesPlayed, blackjacksHit, totalWagered, totalWon, updatedAt
                     ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(userId) DO UPDATE SET
                       username = excluded.username,
                       gamesPlayed = gamesPlayed + excluded.gamesPlayed,
                       blackjacksHit = blackjacksHit + excluded.blackjacksHit,
                       totalWagered = totalWagered + excluded.totalWagered,
                       totalWon = totalWon + excluded.totalWon,
                       updatedAt = CURRENT_TIMESTAMP`,
                    [
                      entry.userId,
                      entry.displayName || entry.username || 'Unknown',
                      1,
                      entry.blackjack ? 1 : 0,
                      Number(entry.bet || 0),
                      netProfit
                    ],
                    (statsErr) => {
                      if (statsErr) {
                        rollback(statsErr);
                        return;
                      }

                      updatedBalances.push({
                        userId: entry.userId,
                        balance: nextBalance
                      });
                      processNext();
                    }
                  );
                };

                writeTransaction();
              }
            );
          }
        );
      };

      processNext();
    });
  });
};

const addPolymarketGeneralBet = (userId, title, slug, url, outcomes) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO PolymarketGeneralBets (userId, title, slug, url, outcomes) VALUES (?, ?, ?, ?, ?)',
      [userId, title, slug, url, JSON.stringify(outcomes)],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
};

const placePolymarketUserBet = (userId, polymarketBetId, outcomeIndex, amount, shares = 0, priceAtBet = 0) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO PolymarketUserBets (userId, polymarketBetId, outcomeIndex, amount, shares, priceAtBet) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, polymarketBetId, outcomeIndex, amount, shares, priceAtBet],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
};

const deletePolymarketGeneralBet = (betId) => {
  return new Promise((resolve, reject) => {
    // 1. Fetch info for refunds BEFORE starting transaction
    db.get('SELECT title FROM PolymarketGeneralBets WHERE id = ?', [betId], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(0); // Already gone
      const title = row.title;

      db.all('SELECT userId, amount, shares FROM PolymarketUserBets WHERE polymarketBetId = ?', [betId], (err, userBets) => {
        if (err) return reject(err);

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          let errorOccurred = false;

          // Refund each user
          userBets.forEach(ub => {
            const refundCents = (ub.amount || 0) * 100;
            const logReason = `Refund: ${title} (Wette gelöscht) - ${ub.amount} KC (${ub.shares} Shares)`;
            
            db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [refundCents, ub.userId], (err) => {
              if (err) errorOccurred = true;
            });
            db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [ub.userId, refundCents, logReason], (err) => {
              if (err) errorOccurred = true;
            });
          });

          // Delete all records
          db.run('DELETE FROM PolymarketUserBets WHERE polymarketBetId = ?', [betId], (err) => {
            if (err) errorOccurred = true;
          });
          db.run('DELETE FROM PolymarketGeneralBets WHERE id = ?', [betId], (err) => {
            if (err) errorOccurred = true;
          });

          db.run('COMMIT', function(err) {
            if (err || errorOccurred) {
              db.run('ROLLBACK');
              reject(err || new Error('Transaction failed during refund'));
            } else {
              resolve(userBets.length);
            }
          });
        });
      });
    });
  });
};

const updatePolymarketGeneralBetStatus = (betId, status, winnerIndex) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE PolymarketGeneralBets SET status = ?, winnerIndex = ? WHERE id = ?',
      [status, winnerIndex, betId],
      function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
};

const getPolymarketGeneralBetById = (betId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM PolymarketGeneralBets WHERE id = ?', [betId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getPolymarketUserBets = (polymarketBetId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT b.*, u.username, u.displayName, u.preferences
      FROM PolymarketUserBets b
      JOIN Users u ON b.userId = u.id
      WHERE b.polymarketBetId = ?
      ORDER BY b.createdAt DESC
    `;
    db.all(query, [polymarketBetId], (err, rows) => {
      if (err) reject(err);
      else {
        const enriched = (rows || []).map(r => ({
          ...r,
          preferences: r.preferences ? JSON.parse(r.preferences) : {}
        }));
        resolve(enriched);
      }
    });
  });
};

const getAllPolymarketGeneralBets = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT p.*, u.username, u.displayName, u.preferences
      FROM PolymarketGeneralBets p 
      JOIN Users u ON p.userId = u.id 
      ORDER BY createdAt DESC
    `;
    db.all(query, [], async (err, rows) => {
      if (err) return reject(err);
      
      try {
        const enrichedRows = await Promise.all(rows.map(async (r) => {
          const placedBets = await getPolymarketUserBets(r.id);
          return { 
            ...r, 
            outcomes: JSON.parse(r.outcomes),
            preferences: r.preferences ? JSON.parse(r.preferences) : {},
            placedBets 
          };
        }));
        resolve(enrichedRows);
      } catch (e) {
        reject(e);
      }
    });
  });
};

const getDailyWord = (date) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT wdw.word, d.definition, d.funny_quote 
      FROM Wordle_DailyWords wdw
      LEFT JOIN wordle_dictionary d ON wdw.word = d.word
      WHERE wdw.date = ?
    `;
    db.get(query, [date], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

const saveDailyWord = (date, word) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR REPLACE INTO Wordle_DailyWords (date, word) VALUES (?, ?)', [date, word], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const validateWordleWord = (word) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT word FROM wordle_dictionary WHERE word = ?", [word.toUpperCase()], (err, row) => {
      if (err) reject(err);
      else resolve(!!row);
    });
  });
};

const completeWordleGame = (userId, date, guesses, won, earnedCoins) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const today = new Date().toISOString().split('T')[0];
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().split('T')[0];

      // 1. Save Result
      const saveResult = `
        INSERT INTO Wordle_DailyResults (userId, date, guesses, won, earnedCoins) 
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(userId, date) DO UPDATE SET
          guesses = excluded.guesses,
          won = excluded.won,
          earnedCoins = excluded.earnedCoins
      `;
      
      db.run(saveResult, [userId, date, JSON.stringify(guesses), won ? 1 : 0, earnedCoins], function(err) {
        if (err) return db.run('ROLLBACK', () => reject(err));

        const proceedToStats = () => {
          // 3. Update Stats
          db.get('SELECT * FROM Wordle_UserStats WHERE userId = ?', [userId], (err, stats) => {
            if (err) return db.run('ROLLBACK', () => reject(err));

            const isDaily = (date === today);
            let currentStreak = stats ? stats.currentStreak : 0;
            let maxStreak = stats ? stats.maxStreak : 0;
            let lastStreakDate = stats ? stats.lastStreakDate : null;

            if (isDaily) {
              if (won) {
                if (lastStreakDate === yesterday) {
                  currentStreak += 1;
                } else {
                  currentStreak = 1;
                }
              } else {
                currentStreak = 0;
              }
              lastStreakDate = today;
              maxStreak = Math.max(maxStreak, currentStreak);
            }

            const upsertStats = `
              INSERT INTO Wordle_UserStats (userId, totalPlayed, totalWins, currentStreak, maxStreak, lastStreakDate)
              VALUES (?, 1, ?, ?, ?, ?)
              ON CONFLICT(userId) DO UPDATE SET
                totalPlayed = totalPlayed + 1,
                totalWins = totalWins + ?,
                currentStreak = ?,
                maxStreak = ?,
                lastStreakDate = ?
            `;

            db.run(upsertStats, [
              userId, won ? 1 : 0, currentStreak, maxStreak, lastStreakDate,
              won ? 1 : 0, currentStreak, maxStreak, lastStreakDate
            ], (err) => {
              if (err) return db.run('ROLLBACK', () => reject(err));

              db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve({ success: true });
              });
            });
          });
        };

        // 2. Award Coins
        if (earnedCoins > 0) {
          db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [earnedCoins, userId], (err) => {
            if (err) return db.run('ROLLBACK', () => reject(err));
            
            db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, earnedCoins, `Wordle Daily Reward (${date})`], (err) => {
               if (err) return db.run('ROLLBACK', () => reject(err));
               proceedToStats();
            });
          });
        } else {
          proceedToStats();
        }
      });
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
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
};

const buyWordleHint = (userId, date) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // 1. Check balance and existing hint status
      const checkQuery = `
        SELECT u.koala_balance, r.hintUsed 
        FROM Users u
        LEFT JOIN Wordle_DailyResults r ON u.id = r.userId AND r.date = ?
        WHERE u.id = ?
      `;

      db.get(checkQuery, [date, userId], (err, row) => {
        if (err || !row) {
          return db.run('ROLLBACK', () => reject(err || new Error('Benutzer nicht gefunden')));
        }

        if (row.hintUsed) {
          return db.run('ROLLBACK', () => reject(new Error('Tipp wurde bereits gekauft.')));
        }

        if (row.koala_balance < 500) {
          return db.run('ROLLBACK', () => reject(new Error('Nicht genügend Koala Coins (5 KC benötigt).')));
        }

        // 2. Deduct coins
        db.run('UPDATE Users SET koala_balance = koala_balance - 500 WHERE id = ?', [userId], (err) => {
          if (err) return db.run('ROLLBACK', () => reject(err));

          // 3. Log transaction
          db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, -500, `Wordle Hint (${date})`], (err) => {
            if (err) return db.run('ROLLBACK', () => reject(err));

            // 4. Mark hintUsed (Upsert because result might not exist yet)
            const upsertHint = `
              INSERT INTO Wordle_DailyResults (userId, date, guesses, won, earnedCoins, hintUsed)
              VALUES (?, ?, '[]', 0, 0, 1)
              ON CONFLICT(userId, date) DO UPDATE SET hintUsed = 1
            `;
            db.run(upsertHint, [userId, date], (err) => {
              if (err) return db.run('ROLLBACK', () => reject(err));

              // 5. Update Stats Table (Total Hints)
              const updateHintStats = `
                INSERT INTO Wordle_UserStats (userId, totalHintsBought) VALUES (?, 1)
                ON CONFLICT(userId) DO UPDATE SET totalHintsBought = totalHintsBought + 1
              `;
              db.run(updateHintStats, [userId], (err) => {
                if (err) return db.run('ROLLBACK', () => reject(err));

                db.run('COMMIT', (err) => {
                  if (err) reject(err);
                  else resolve({ success: true, newBalance: row.koala_balance - 500 });
                });
              });
            });
          });
        });
      });
    });
  });
};

const getWordleStatus = (userId, date) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Wordle_DailyResults WHERE userId = ? AND date = ?', [userId, date], (err, row) => {
      if (err) reject(err);
      else resolve(row ? { ...row, guesses: JSON.parse(row.guesses), won: !!row.won, hintUsed: !!row.hintUsed } : null);
    });
  });
};

const getWordleDailyLeaderboard = (date) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        r.*, 
        u.username, u.displayName, u.preferences,
        s.totalPlayed, s.totalWins, s.currentStreak, s.maxStreak, s.totalHintsBought
      FROM Wordle_DailyResults r
      JOIN Users u ON r.userId = u.id
      LEFT JOIN Wordle_UserStats s ON r.userId = s.userId
      WHERE r.date = ?
      ORDER BY r.won DESC, r.earnedCoins DESC, r.id ASC
    `;
    db.all(query, [date], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => ({ 
        ...r, 
        guesses: JSON.parse(r.guesses), 
        won: !!r.won, 
        hintUsed: !!r.hintUsed,
        stats: {
           totalPlayed: r.totalPlayed || 0,
           totalWins: r.totalWins || 0,
           currentStreak: r.currentStreak || 0,
           maxStreak: r.maxStreak || 0,
           totalHintsBought: r.totalHintsBought || 0
        }
      })));
    });
  });
};

const updateUserGameStats = (userId, gameId, newScore, newLines = 0, newLevel = 1, sprintTime = 0) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO UserGameStats (userId, gameId, highscore, sprintHighscore, totalScore, totalLines, maxLevel, playCount, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(userId, gameId) DO UPDATE SET
        highscore = MAX(highscore, excluded.highscore),
        sprintHighscore = CASE 
          WHEN excluded.sprintHighscore > 0 AND (sprintHighscore = 0 OR excluded.sprintHighscore < sprintHighscore) 
          THEN excluded.sprintHighscore 
          ELSE sprintHighscore 
        END,
        totalScore = totalScore + excluded.totalScore,
        totalLines = totalLines + excluded.totalLines,
        maxLevel = MAX(maxLevel, excluded.maxLevel),
        playCount = playCount + 1,
        updatedAt = CURRENT_TIMESTAMP
    `;
    db.run(query, [userId, gameId, newScore, sprintTime, newScore, newLines, newLevel], function (err) {
      if (err) {
        logError(`updateUserGameStats failed: ${err.message}`, err.stack, JSON.stringify({ userId, gameId, newScore, newLines, newLevel, sprintTime }));
        reject(err);
      } else resolve({ success: true });
    });
  });
};

// (No migrations or restores - only core table initialization)


// --- NEW: Game Upgrades Helpers ---
const getGameUpgradesConfig = (category = 'koala_flap') => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM GameUpgrades_Config WHERE category = ?', [category], (err, rows) => {
      if (err) {
        logError(`getGameUpgradesConfig failed: ${err.message}`, err.stack, category);
        reject(err);
      } else resolve(rows || []);
    });
  });
};

const purchaseUpgrade = (userId, upgradeId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Start transaction early to lock for read-consistency
      db.run('BEGIN TRANSACTION');

      // 1. Get upgrade config
      db.get('SELECT * FROM GameUpgrades_Config WHERE upgrade_id = ?', [upgradeId], (err, config) => {
        if (err || !config) {
          const msg = err ? err.message : 'Upgrade config not found';
          logError(`purchaseUpgrade: Config fetch failed for ${upgradeId}: ${msg}`, err?.stack);
          return db.run('ROLLBACK', () => reject(new Error(msg)));
        }

        // 2. Get user's current level & balance in one go if possible, but separate is fine for clarity
        db.get('SELECT current_level FROM UserUpgrades WHERE userId = ? AND upgrade_id = ?', [userId, upgradeId], (err, row) => {
          if (err) {
            logError(`purchaseUpgrade: Level fetch failed: ${err.message}`, err.stack);
            return db.run('ROLLBACK', () => reject(err));
          }

          const currentLevel = row ? row.current_level : 0;
          if (currentLevel >= config.max_level) {
            return db.run('ROLLBACK', () => reject(new Error('Das maximale Level für dieses Upgrade ist bereits erreicht.')));
          }

          const cost = config.base_price + (currentLevel * config.price_step);

          db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (err, user) => {
            if (err || !user) {
              const msg = err ? err.message : 'User not found';
              logError(`purchaseUpgrade: User fetch failed: ${msg}`, err?.stack);
              return db.run('ROLLBACK', () => reject(new Error(msg)));
            }

            if (user.koala_balance < cost) {
              return db.run('ROLLBACK', () => reject(new Error(`Nicht genügend KoalaCoins. Benötigt: ${cost}, Aktuell: ${user.koala_balance}`)));
            }

            // Perform updates
            db.run('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?', [cost, userId], (err) => {
              if (err) {
                logError(`purchaseUpgrade: Balance update failed: ${err.message}`, err.stack);
                return db.run('ROLLBACK', () => reject(err));
              }

              db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', 
                [userId, -cost, `Upgrade gekauft: ${config.display_name} (Level ${currentLevel + 1})`], (err) => {
                if (err) {
                  logError(`purchaseUpgrade: Transaction log failed: ${err.message}`, err.stack);
                  return db.run('ROLLBACK', () => reject(err));
                }

                db.run('INSERT INTO UserUpgrades (userId, upgrade_id, current_level) VALUES (?, ?, 1) ON CONFLICT(userId, upgrade_id) DO UPDATE SET current_level = current_level + 1', 
                  [userId, upgradeId], (err) => {
                  if (err) {
                    logError(`purchaseUpgrade: Level increment failed: ${err.message}`, err.stack);
                    return db.run('ROLLBACK', () => reject(err));
                  }

                  db.run('COMMIT', (err) => {
                    if (err) {
                      logError(`purchaseUpgrade: Commit failed: ${err.message}`, err.stack);
                      return reject(err);
                    }
                    resolve({ newLevel: currentLevel + 1, cost, newBalance: user.koala_balance - cost });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

const getGameLeaderboards = (gameId) => {
  return new Promise((resolve, reject) => {
    // For Tetris, use the new optimized UserGameStats table
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
        .then(([highscores, cumulative]) => {
          resolve({ highscores, cumulative });
        })
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
        // Map to return as cumulative/highscore structure to keep frontend simple
        resolve({ highscores: rows, cumulative: rows });
      });
      return;
    }

    // Default legacy logic for other games (aggregated SUM)
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
      .then(([highscores, cumulative]) => {
        resolve({ highscores, cumulative });
      })
      .catch(reject);
  });
};


function getAdminGameScores(gameId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT gs.*, u.displayName, u.username
      FROM GameScores gs
      JOIN Users u ON gs.userId = u.id
      WHERE gs.gameId = ?
      ORDER BY gs.createdAt DESC
    `;
    db.all(query, [gameId], (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function deleteGameScore(scoreId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM GameScores WHERE id = ?', [scoreId], (err) => err ? reject(err) : resolve());
  });
}



// ─── Achievements & Daily Bonus ────────────────────────────────

const getUserWonMatchCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(DISTINCT matchName) as count FROM Bets WHERE userId = ? AND status = 'won'`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });
};

const getUserGameRoundCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM GameScores WHERE userId = ? AND gameId = 'koala_flap'`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });
};

const hasUnderdogWin = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as c FROM Bets WHERE userId = ? AND status = 'won' AND odds > 3.0`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row && row.c > 0 ? 1 : 0);
    });
  });
};

const hasLoyalFanWin = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT COUNT(*) as c FROM Bets b
      JOIN Users u ON b.userId = u.id
      WHERE b.userId = ? AND b.status = 'won'
        AND u.preferences IS NOT NULL
        AND b.chosenTeam = JSON_EXTRACT(u.preferences, '$.fanTeam')
    `, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row && row.c > 0 ? 1 : 0);
    });
  });
};

const getUserVoteCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(DISTINCT requestId) as count FROM FeatureVotes WHERE userId = ?`, [userId], (err, row) => {
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


const getGlobalScratchcardStats = async () => {
  try {
    const stats = await getGlobalGameStats('scratchcards');
    return {
      total_sold: stats.total_played,
      total_won: stats.total_won,
      total_wins: stats.total_count
    };
  } catch (err) {
    console.error('[Database] Error fetching global scratchcard stats:', err);
    return { total_sold: 0, total_won: 0, total_wins: 0 };
  }
};

const getLatestScratchcardWinners = (limit = 10) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT s.id, s.userId, u.username, u.preferences, s.winAmount, s.createdAt, s.grid, COALESCE(p.name, s.type) as packName 
      FROM Scratchcards s 
      JOIN Users u ON s.userId = u.id 
      LEFT JOIN scratchcard_packs p ON s.type = CAST(p.id AS TEXT) OR s.type = p.name
      WHERE s.winAmount > 0 AND s.status = 'claimed' 
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
      SELECT s.id, s.userId, u.username, u.preferences, s.winAmount, s.createdAt, s.grid, COALESCE(p.name, s.type) as packName 
      FROM Scratchcards s 
      JOIN Users u ON s.userId = u.id 
      LEFT JOIN scratchcard_packs p ON s.type = CAST(p.id AS TEXT) OR s.type = p.name
      WHERE s.winAmount > 0 AND s.status = 'claimed' 
      ORDER BY s.winAmount DESC 
      LIMIT ?
    `;
    db.all(query, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getScratchcardLeaderboard = (limit = 10) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT s.userId, u.username, u.preferences,
        SUM(s.winAmount) as totalWin,
        COUNT(s.id) as ticketsWon,
        (SELECT COUNT(*) FROM Scratchcards s2 WHERE s2.userId = s.userId) as totalBought
      FROM Scratchcards s
      JOIN Users u ON s.userId = u.id
      WHERE s.winAmount > 0 AND s.status = 'claimed'
      GROUP BY s.userId
      ORDER BY totalWin DESC
      LIMIT ?
    `;
    db.all(query, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getScratchcardLeaderboardData = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT date(createdAt) as day, SUM(winAmount) as dailyWin
      FROM Scratchcards
      WHERE status = 'claimed' AND winAmount > 0
      GROUP BY day
      ORDER BY day ASC
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getUserDailyPackCount = (userId, packId) => {
  return new Promise((resolve, reject) => {
    // Check count for today (UTC)
    const today = new Date().toISOString().split('T')[0];
    db.get(
      'SELECT COUNT(*) as count FROM Scratchcards WHERE userId = ? AND type = ? AND date(createdAt) = date(?)',
      [userId, String(packId), today],
      (err, row) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      }
    );
  });
};

/**
 * Log a system event (Info, Warn) to the SystemLogs table.
 * Includes a 24h retention policy (self-cleans on every new log).
 */

/**
 * Flush all system logs from the database.
 */

module.exports = {
  // --- LoL Idle Game (Road to Worlds) Helpers ---
  getIdleProfile: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM Idle_Profiles WHERE userId = ?', [userId], (err, row) => {
        if (err) reject(err);
        else {
          // TEST BUDGET: Always ensure at least 1,000,000 for testing (hardcoded as requested)
          if (row && (row.dollars === null || row.dollars < 1000000)) {
            row.dollars = 1000000;
          }
          resolve(row);
        }
      });
    });
  },

  createIdleProfile: (userId) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT OR IGNORE INTO Idle_Profiles (userId) VALUES (?)', [userId], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  updateIdleProfile: (userId, data) => {
    return new Promise((resolve, reject) => {
      // Dynamic SET query based on provided object fields
      const keys = Object.keys(data);
      if (keys.length === 0) return resolve(0);
      const fields = keys.map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(data), userId];
      
      db.run(
        `UPDATE Idle_Profiles SET ${fields} WHERE userId = ?`,
        values,
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  },

  updateInventoryUnit: (id, data) => {
    return new Promise((resolve, reject) => {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      db.run(`UPDATE Idle_Inventory SET ${setClause} WHERE id = ?`, [...values, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  getIdleInventory: (userId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM Idle_Inventory WHERE userId = ?', [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  addInventoryUnit: (userId, teamCode, rarity = 'Common', baseStats = 10, role = 'Top') => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO Idle_Inventory (userId, team_code, rarity, base_stats, role, level) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, teamCode, rarity, baseStats, role, 1],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, userId, team_code: teamCode, tier: 1, rarity, base_stats: baseStats, role, level: 1 });
        }
      );
    });
  },

  deleteInventoryUnit: (unitId) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM Idle_Inventory WHERE id = ?', [unitId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  mergeInventoryUnits: (userId, teamCode, tier, role) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        // Find 3 units to delete of SAME team, tier AND role
        db.all(
          'SELECT id FROM Idle_Inventory WHERE userId = ? AND team_code = ? AND tier = ? AND role = ? AND is_equipped = 0 LIMIT 3',
          [userId, teamCode, tier, role],
          (err, rows) => {
            if (err || rows.length < 3) {
              db.run('ROLLBACK');
              return reject(err || new Error('Not enough units of this role to merge'));
            }
            const ids = rows.map(r => r.id);
            db.run(`DELETE FROM Idle_Inventory WHERE id IN (${ids.join(',')})`, (err) => {
              if (err) {
                db.run('ROLLBACK');
                return reject(err);
              }
              // Insert the upgraded unit with the SAME role
              db.run(
                'INSERT INTO Idle_Inventory (userId, team_code, tier, role) VALUES (?, ?, ?, ?)',
                [userId, teamCode, tier + 1, role],
                function (err) {
                  if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                  }
                  db.run('COMMIT');
                  resolve({ id: this.lastID, tier: tier + 1, role });
                }
              );
            });
          }
        );
      });
    });
  },

  mergeAllInventoryUnits: (userId) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.all(
          'SELECT id, team_code, tier, role FROM Idle_Inventory WHERE userId = ? AND is_equipped = 0',
          [userId],
          async (err, rows) => {
            if (err) return reject(err);
            
            // Group candidates by teamCode-tier-role
            const groups = {};
            rows.forEach(r => {
              const key = `${r.team_code}-${r.tier}-${r.role}`;
              if (!groups[key]) groups[key] = [];
              groups[key].push(r.id);
            });

            const toDelete = [];
            const toInsert = [];

            // Simple iterative pass (can be repeated if user clicks again, 
            // but we can do one full pass of all possible set-of-3 merges)
            Object.keys(groups).forEach(key => {
              const ids = groups[key];
              const [team_code, tierStr, role] = key.split('-');
              const tier = parseInt(tierStr);
              
              const setsOfThree = Math.floor(ids.length / 3);
              if (setsOfThree > 0) {
                for (let i = 0; i < setsOfThree; i++) {
                  toDelete.push(...ids.slice(i * 3, (i + 3) * 3));
                  toInsert.push({ team_code, tier: tier + 1, role });
                }
              }
            });

            if (toDelete.length === 0) return resolve({ changes: 0 });

            db.run('BEGIN TRANSACTION');
            try {
              // Delete in chunks if too many, but usually it's fine
              db.run(`DELETE FROM Idle_Inventory WHERE id IN (${toDelete.join(',')})`);
              
              const insertStmt = db.prepare('INSERT INTO Idle_Inventory (userId, team_code, tier, role) VALUES (?, ?, ?, ?)');
              toInsert.forEach(item => insertStmt.run(userId, item.team_code, item.tier, item.role));
              insertStmt.finalize();
              
              db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve({ changes: toInsert.length });
              });
            } catch (e) {
              db.run('ROLLBACK');
              reject(e);
            }
          }
        );
      });
    });
  },

  getIdleRoster: (userId) => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT r.slot_id, i.id as inventory_id, i.team_code, i.tier, i.experience, i.rarity, i.base_stats, i.role, i.level
        FROM Idle_Roster r
        LEFT JOIN Idle_Inventory i ON r.inventory_id = i.id
        WHERE r.userId = ?
        ORDER BY r.slot_id ASC
      `;
      db.all(query, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  assignInventoryToRoster: (userId, slotId, inventoryId) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        // If inventoryId is null, we are unequipping
        if (inventoryId === null) {
          db.get('SELECT inventory_id FROM Idle_Roster WHERE userId = ? AND slot_id = ?', [userId, slotId], (err, row) => {
            if (row && row.inventory_id) {
              db.run('UPDATE Idle_Inventory SET is_equipped = 0 WHERE id = ?', [row.inventory_id]);
            }
            db.run('UPDATE Idle_Roster SET inventory_id = NULL WHERE userId = ? AND slot_id = ?', [userId, slotId], (err) => {
              if (err) db.run('ROLLBACK'), reject(err);
              else db.run('COMMIT'), resolve();
            });
          });
        } else {
          // Equipping
          // 1. Mark unit as equipped
          db.run('UPDATE Idle_Inventory SET is_equipped = 1 WHERE id = ?', [inventoryId]);
          // 2. Clear old unit in this slot if exists
          db.get('SELECT inventory_id FROM Idle_Roster WHERE userId = ? AND slot_id = ?', [userId, slotId], (err, row) => {
            if (row && row.inventory_id) {
              db.run('UPDATE Idle_Inventory SET is_equipped = 0 WHERE id = ?', [row.inventory_id]);
            }
            // 3. Update Roster
            db.run(
              'INSERT INTO Idle_Roster (userId, slot_id, inventory_id) VALUES (?, ?, ?) ON CONFLICT(userId, slot_id) DO UPDATE SET inventory_id = excluded.inventory_id',
              [userId, slotId, inventoryId],
              (err) => {
                if (err) db.run('ROLLBACK'), reject(err);
                else db.run('COMMIT'), resolve();
              }
            );
          });
        }
      });
    });
  },

  updateInventoryXP: (id, amount) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE Idle_Inventory SET experience = experience + ? WHERE id = ?', [amount, id], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  updateRosterMode: (userId, slotId, mode) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE Idle_Roster SET current_mode = ? WHERE userId = ? AND slot_id = ?',
        [mode, userId, slotId],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  },
  db,
  getGlobalScratchcardStats,
  getLatestScratchcardWinners,
  getUserDailyPackCount,
  purchaseScratchcardTransaction,
  getTeamMappings,
  getTeamMapping,
  addTeamMapping,
  deleteTeamMapping,
  addFriend,
  removeFriend,
  getFriends,
  getFriendStatus,
  getAdminFriends,
  upsertEsportsTeams,
  getAllEsportsTeams,
  getEsportsTeamsLastUpdated,
  getCountdowns,
  createCountdown,
  deleteCountdown,
  getCountdownById,
  createBet,
  getUserBets,
  getUnresolvedPastBets,
  hasUnresolvedBetsForMatch,
  resolveBetAtomic,
  updateBetStatus,
  getAllBetsAdmin,
  getRecentBets,
  updateBetStatusAdmin,
  logAdminAction,
  getAdminActions,
  createFeatureRequest,
  getUserFeatureRequestCount,
  getFeatureRequests,
  voteFeatureRequest,
  updateFeatureStatus,
  updateFeatureAdminComment,
  deleteFeatureRequest,
  getBettingAccuracyLeaderboard,
  recordGameScore,
  getGameLeaderboards,
  getBlackjackLeaderboard,
  upsertBlackjackStats,
  applyBlackjackSettlement,
  getActiveTowerRound,
  getLatestTowerRound,
  getTowerHistory,
  startTowerRound,
  resolveTowerPick,
  cashoutTowerRound,
  getGameUpgradesConfig,
  purchaseUpgrade,
  getUserWonMatchCount,
  getUserGameRoundCount,
  getAdminGameScores,
  deleteGameScore,
  addSpeedcubeTime,
  getSpeedcubeTimes,
  updateSpeedcubeNote,
  deleteSpeedcubeTime,
  hasUnderdogWin,
  hasLoyalFanWin,
  getUserVoteCount,
  getUserZeroScoreStreak,
  createScratchcard,
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
  // Dynamic Scratchcard Packs
  getScratchcardPacks: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM scratchcard_packs ORDER BY created_at DESC', (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  },
  getScratchcardPack: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM scratchcard_packs WHERE id = ?', [id], (err, row) => err ? reject(err) : resolve(row));
    });
  },
  createScratchcardPack: (pack) => {
    const { name, region_label, scope, price, win_chance, reward_amount, is_weighted, max_daily_limit, is_active, is_special } = pack;
    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO scratchcard_packs (name, region_label, scope, price, win_chance, reward_amount, is_weighted, max_daily_limit, is_active, is_special) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, region_label, scope, price, win_chance || 0.3, reward_amount || 0, is_weighted ? 1 : 0, max_daily_limit || 0, is_active ? 1 : 0, is_special ? 1 : 0],
        function (err) { err ? reject(err) : resolve({ id: this.lastID, ...pack }); }
      );
    });
  },
  updateScratchcardPack: (id, pack) => {
    const { name, region_label, scope, price, win_chance, reward_amount, is_weighted, max_daily_limit, is_active, is_special } = pack;
    return new Promise((resolve, reject) => {
      db.run(`UPDATE scratchcard_packs SET name=?, region_label=?, scope=?, price=?, win_chance=?, reward_amount=?, is_weighted=?, max_daily_limit=?, is_active=?, is_special=? WHERE id=?`,
        [name, region_label, scope, price, win_chance, reward_amount, is_weighted ? 1 : 0, max_daily_limit || 0, is_active ? 1 : 0, is_special ? 1 : 0, id],
        function (err) { err ? reject(err) : resolve(this.changes); }
      );
    });
  },
  deleteScratchcardPack: (id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM scratchcard_packs WHERE id = ?', [id], function (err) { err ? reject(err) : resolve(this.changes); });
    });
  },
  // Scratchcard Pack Teams
  getScratchcardPackTeams: (packId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM scratchcard_pack_teams WHERE pack_id = ? ORDER BY position ASC', [packId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  },
  setScratchcardPackTeams: (packId, teamCodes) => {
    // teamCodes is an array of strings in order
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
  },

  // --- LEC Rift Defense Helpers ---
  addRiftDefenseTower: (userId, teamCode, starLevel = 1, rarityTier = 0) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO RiftDefense_Towers (userId, teamCode, starLevel, rarityTier) VALUES (?, ?, ?, ?)', [userId, teamCode, starLevel, rarityTier], function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, userId, teamCode, starLevel, rarityTier });
      });
    });
  },

  getUserRiftDefenseTowers: (userId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM RiftDefense_Towers WHERE userId = ? ORDER BY starLevel DESC, teamCode ASC', [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  deleteRiftDefenseTowers: (userId, teamCode, starLevel, limit) => {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM RiftDefense_Towers WHERE id IN (SELECT id FROM RiftDefense_Towers WHERE userId = ? AND teamCode = ? AND starLevel = ? LIMIT ?)`, 
      [userId, teamCode, starLevel, limit], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  scrapRiftDefenseTower: (id, userId) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM RiftDefense_Towers WHERE id = ? AND userId = ?', [id, userId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  updateRiftDefenseStats: (userId, highestWave, minionsKilled, bossesKilled) => {
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO RiftDefense_Stats (userId, highestWave, totalMinionsKilled, totalBossesKilled, updatedAt)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(userId) DO UPDATE SET
          highestWave = MAX(highestWave, excluded.highestWave),
          totalMinionsKilled = totalMinionsKilled + excluded.totalMinionsKilled,
          totalBossesKilled = totalBossesKilled + excluded.totalBossesKilled,
          updatedAt = CURRENT_TIMESTAMP
      `, [userId, highestWave, minionsKilled, bossesKilled], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  getRiftDefenseLeaderboards: () => {
    return new Promise((resolve, reject) => {
      const qWave = `SELECT r.userId, u.username, u.displayName, u.preferences, r.highestWave as value FROM RiftDefense_Stats r JOIN Users u ON r.userId = u.id ORDER BY r.highestWave DESC LIMIT 50`;
      const qMinions = `SELECT r.userId, u.username, u.displayName, u.preferences, r.totalMinionsKilled as value FROM RiftDefense_Stats r JOIN Users u ON r.userId = u.id ORDER BY r.totalMinionsKilled DESC LIMIT 50`;
      const qBosses = `SELECT r.userId, u.username, u.displayName, u.preferences, r.totalBossesKilled as value FROM RiftDefense_Stats r JOIN Users u ON r.userId = u.id ORDER BY r.totalBossesKilled DESC LIMIT 50`;
      
      Promise.all([
        new Promise((res, rej) => db.all(qWave, [], (err, rows) => err ? rej(err) : res(rows))),
        new Promise((res, rej) => db.all(qMinions, [], (err, rows) => err ? rej(err) : res(rows))),
        new Promise((res, rej) => db.all(qBosses, [], (err, rows) => err ? rej(err) : res(rows)))
      ]).then(([highestWave, totalMinions, totalBosses]) => {
        resolve({ highestWave, totalMinions, totalBosses });
      }).catch(reject);
    });
  },

  getNavbarSettings: (adminOnly = false) => {
    return new Promise((resolve, reject) => {
      const query = adminOnly 
        ? 'SELECT * FROM NavbarSettings ORDER BY sortOrder ASC'
        : 'SELECT * FROM NavbarSettings WHERE isVisible = 1 ORDER BY sortOrder ASC';
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  updateNavbarSettings: (settings) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        try {
          // 1. Get current keys to identify what to delete
          const newKeys = settings.map(s => s.key);
          const placeholders = newKeys.map(() => '?').join(',');

          // 2. Delete items not in the new set (orphaned items)
          db.run(`DELETE FROM NavbarSettings WHERE key NOT IN (${placeholders})`, newKeys);

          // 3. Upsert all provided settings
          const stmt = db.prepare(`
           INSERT INTO NavbarSettings (key, label, path, category, isVisible, isLocked, sortOrder, has_daily_badge, icon) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET 
              label = excluded.label,
              path = excluded.path,
              category = excluded.category,
              isVisible = excluded.isVisible,
              isLocked = excluded.isLocked,
              sortOrder = excluded.sortOrder,
              has_daily_badge = excluded.has_daily_badge,
              icon = excluded.icon
          `);

          settings.forEach(item => {
            stmt.run([
              item.key, 
              item.label, 
              item.path, 
              item.category, 
              item.isVisible ? 1 : 0, 
              item.isLocked ? 1 : 0,
              item.sortOrder || 0, 
              item.has_daily_badge ? 1 : 0,
              item.icon || null
            ]);
          });
          stmt.finalize();

          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        } catch (err) {
          db.run('ROLLBACK');
          reject(err);
        }
      });
    });
  },

  getPokemonConfigs: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM PokemonSettings', [], (err, settingsRows) => {
        if (err) return reject(err);
        db.all('SELECT * FROM PokemonTypeColors', [], (err, colorRows) => {
          if (err) return reject(err);
          
          const settings = {};
          settingsRows.forEach(r => settings[r.key] = r.value);
          
          const colors = {};
          colorRows.forEach(r => colors[r.type_name] = r.hex_color);
          
          resolve({ settings, colors });
        });
      });
    });
  },

  updatePokemonConfigs: (settings, colors) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        if (settings) {
          Object.entries(settings).forEach(([key, value]) => {
            db.run('INSERT OR REPLACE INTO PokemonSettings (key, value) VALUES (?, ?)', [key, String(value)]);
          });
        }
        
        if (colors) {
          Object.entries(colors).forEach(([type, hex]) => {
            db.run('INSERT OR REPLACE INTO PokemonTypeColors (type_name, hex_color) VALUES (?, ?)', [type, hex]);
          });
        }
        
        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  },

  addPolymarketGeneralBet,
  placePolymarketUserBet,
  getAllPolymarketGeneralBets,
  getPolymarketGeneralBetById,
  getPolymarketUserBets,
  updatePolymarketGeneralBetStatus,
  deletePolymarketGeneralBet,
  getPolymarketSettings,
  updatePolymarketSettings,
  getDailyWord,
  saveDailyWord,
  saveWordleResult,
  completeWordleGame,
  validateWordleWord,
  getWordleStatus,
  getWordleDailyLeaderboard,
  buyWordleHint,
  updateUserGameStats,
  getGlobalGameStats,
  // --- Lotto Helpers ---
  getLottoConfig: () => {
    return new Promise((resolve, reject) => {
      // 1. Get Global Stats
      db.get("SELECT * FROM GlobalGameStats WHERE gameId = 'lotto'", (err, stats) => {
        if (err) return reject(err);
        const finalStats = stats || { totalPayout: 0, totalWins: 0, totalPlayed: 0 };

        // 2. Get Pending Tickets Count
        db.get("SELECT COUNT(*) as totalPending FROM LottoTickets WHERE status = 'pending'", (err, pendRow) => {
          if (err) return reject(err);
          finalStats.totalPending = pendRow ? pendRow.totalPending : 0;

          // 3. Get Last Draw
          db.get("SELECT * FROM LottoDrawings ORDER BY drawDate DESC LIMIT 1", (err, lastDraw) => {
            if (err) return reject(err);
            if (!lastDraw) {
              return resolve({ stats: finalStats, lastDraw: null });
            }

            // 4. Get Winners per Class for this last draw
            db.all(
              "SELECT winClass, COUNT(*) as winnerCount FROM LottoTickets WHERE drawDate = ? AND winClass > 0 GROUP BY winClass",
              [lastDraw.drawDate],
              (err, winnerRows) => {
                if (err) return reject(err);
                
                const winnersByClass = {};
                winnerRows.forEach(row => {
                  winnersByClass[row.winClass] = row.winnerCount;
                });
                lastDraw.winnersByClass = winnersByClass;

                resolve({ stats: finalStats, lastDraw });
              }
            );
          });
        });
      });
    });
  },

  getUserLottoTicketCountForDraw: (userId, drawDate) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM LottoTickets WHERE userId = ? AND drawDate = ?", [userId, drawDate], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    });
  },

  purchaseLottoTickets: (userId, tickets, drawDate) => {
    return new Promise((resolve, reject) => {
      const totalCost = tickets.length * 100; // 100 cents = 1 KC
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (err, user) => {
          if (err || !user || user.koala_balance < totalCost) {
            db.run('ROLLBACK');
            return reject(new Error(user ? 'Not enough KoalaCoins.' : 'User not found.'));
          }

          // Check daily limit and duplicate tickets
          db.all("SELECT numbers, superzahl FROM LottoTickets WHERE userId = ? AND drawDate = ?", [userId, drawDate], (err, existingRows) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            const currentCount = existingRows ? existingRows.length : 0;
            if (currentCount + tickets.length > 100) {
              db.run('ROLLBACK');
              return reject(new Error(`Tägliches Limit erreicht. Du hast bereits ${currentCount} Tickets für diese Ziehung. (Max 100)`));
            }

            // Create a set of existing "Numbers_SZ" strings for quick comparison
            const existingSet = new Set(existingRows.map(r => {
                const nums = JSON.parse(r.numbers).sort((a,b) => a-b);
                return `${JSON.stringify(nums)}_${r.superzahl}`;
            }));
            
            // Check incoming batch for internal duplicates and against existing
            const batchDuplicates = [];
            const processedInBatch = new Set();

            for (const t of tickets) {
              const sortedNums = [...t.numbers].sort((a,b) => a-b);
              const key = `${JSON.stringify(sortedNums)}_${t.superzahl}`;
              
              if (existingSet.has(key) || processedInBatch.has(key)) {
                batchDuplicates.push(`${sortedNums.join(',')} SZ:${t.superzahl}`);
              } else {
                processedInBatch.add(key);
              }
            }

            if (batchDuplicates.length > 0) {
              db.run('ROLLBACK');
              return reject(new Error(`Duplikat-Fehler: Du besitzt bereits Tickets mit diesen Zahlen oder hast sie mehrfach im Warenkorb: ${batchDuplicates.slice(0, 3).join(' | ')}${batchDuplicates.length > 3 ? '...' : ''}`));
            }

            db.run('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?', [totalCost, userId]);
            db.run('UPDATE GlobalGameStats SET totalPlayed = totalPlayed + ? WHERE gameId = ?', [tickets.length, 'lotto']);
            db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', 
                   [userId, -totalCost, `Lotto Kauf (${tickets.length}x)`]);

            const stmt = db.prepare('INSERT INTO LottoTickets (userId, drawDate, numbers, superzahl) VALUES (?, ?, ?, ?)');
            tickets.forEach(t => {
              stmt.run([userId, drawDate, JSON.stringify(t.numbers.sort((a,b) => a-b)), t.superzahl]);
            });
            stmt.finalize();

            db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve({ newBalance: user.koala_balance - totalCost });
            });
          });
        });
      });
    });
  },

  executeLottoDraw: (drawDate, drawnNumbers, drawnSuperzahl) => {
    const { determineWinClass, getPayoutForClass } = require('../config/lotto.js');
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Get all pending tickets for this draw
        db.all("SELECT * FROM LottoTickets WHERE drawDate = ? AND status = 'pending'", [drawDate], async (err, tickets) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }

          let totalPayout = 0;
          let totalWinners = 0;
          const userPayouts = {}; // userId -> amount

          for (const ticket of tickets) {
            const ticketNumbers = JSON.parse(ticket.numbers);
            const winClass = determineWinClass(ticketNumbers, ticket.superzahl, drawnNumbers, drawnSuperzahl);
            const payout = getPayoutForClass(winClass);
            
            const matchCount = ticketNumbers.filter(n => drawnNumbers.includes(n)).length;
            const superzahlMatch = ticket.superzahl === drawnSuperzahl;

            db.run(`UPDATE LottoTickets SET matchCount = ?, superzahlMatch = ?, winClass = ?, winAmount = ?, status = 'drawn' WHERE id = ?`,
                   [matchCount, superzahlMatch ? 1 : 0, winClass, payout, ticket.id]);

            if (payout > 0) {
              totalPayout += payout;
              totalWinners++;
              userPayouts[ticket.userId] = (userPayouts[ticket.userId] || 0) + payout;
            }
          }

          // Apply payouts to users
          for (const [userId, amount] of Object.entries(userPayouts)) {
            db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [amount, userId]);
            db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', 
                   [userId, amount, `Lotto Gewinn (${drawDate})`]);
          }

          db.run('UPDATE GlobalGameStats SET totalPayout = totalPayout + ?, totalWins = totalWins + ? WHERE gameId = ?', 
                 [totalPayout, totalWinners, 'lotto']);

          db.run('INSERT INTO LottoDrawings (drawDate, numbers, superzahl, totalTickets, totalWinners, totalPayout) VALUES (?, ?, ?, ?, ?, ?)',
                 [drawDate, JSON.stringify(drawnNumbers), drawnSuperzahl, tickets.length, totalWinners, totalPayout]);

          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve({ drawDate, numbers: drawnNumbers, superzahl: drawnSuperzahl, totalTickets: tickets.length, totalWinners, totalPayout });
          });
        });
      });
    });
  },

  getUserLottoHistory: (userId, limit = 999) => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT t.*, d.numbers as drawNumbers, d.superzahl as drawSuperzahl, d.totalPayout as drawTotalPayout
        FROM LottoTickets t
        LEFT JOIN LottoDrawings d ON t.drawDate = d.drawDate
        WHERE t.userId = ?
        ORDER BY t.drawDate DESC, t.winAmount DESC, t.matchCount DESC
        LIMIT ?
      `;
      db.all(query, [userId, limit], (err, rows) => { 
        if (err) reject(err);
        else {
          // Flatten grouping if needed on frontend, but keep it roughly sorted
          resolve(rows || []);
        }
      });
    });
  },

  getLottoDrawHistory: (limit = 30) => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM LottoDrawings ORDER BY drawDate DESC LIMIT ?", [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  // --- RSS News Functions ---
  getRssFeeds: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM RssFeeds ORDER BY is_default DESC, name ASC', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  getRssFeedById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM RssFeeds WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  addRssFeed: (name, url, icon = null) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO RssFeeds (name, url, icon) VALUES (?, ?, ?)', [name, url, icon], function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, name, url, icon });
      });
    });
  },

  updateRssFeed: (id, name, url, icon) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE RssFeeds SET name = ?, url = ?, icon = ? WHERE id = ?', [name, url, icon, id], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  deleteRssFeed: (id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM RssFeeds WHERE id = ?', [id], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  /**
   * Updates cached articles for a feed.
   * Logic: Deletes old articles for this feed and inserts new ones.
   */
  updateRssArticlesCache: (feedId, articles) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        // Clear old cache for this feed
        db.run('DELETE FROM RssArticles_Cache WHERE feedId = ?', [feedId]);
        
        const stmt = db.prepare('INSERT INTO RssArticles_Cache (feedId, title, imageUrl, snippet, link, pubDate) VALUES (?, ?, ?, ?, ?, ?)');
        articles.forEach(art => {
          stmt.run([feedId, art.title, art.imageUrl || null, art.snippet || null, art.link, art.pubDate]);
        });
        stmt.finalize();
        
        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });
    });
  },

  getCachedArticles: (feedIds = null, limit = 100) => {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT a.*, f.name as feedName, f.icon as feedIcon
        FROM RssArticles_Cache a
        JOIN RssFeeds f ON a.feedId = f.id
      `;
      const params = [];

      if (feedIds && feedIds.length > 0) {
        const placeholders = feedIds.map(() => '?').join(',');
        query += ` WHERE a.feedId IN (${placeholders})`;
        params.push(...feedIds);
      }

      query += ` ORDER BY a.pubDate DESC LIMIT ?`;
      params.push(limit);

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Optimized fetch for the News Ticker.
   * Joins Artikel with Preferences to filter by showInTicker in a single query.
   */
  getTickerNews: (userId = null, limit = 50) => {
      return new Promise((resolve, reject) => {
          let query = `
              SELECT a.*, f.name as feedName, f.icon as feedIcon
              FROM RssArticles_Cache a
              JOIN RssFeeds f ON a.feedId = f.id
          `;
          const params = [];

          if (userId) {
              // Get articles from feeds where user opted-in for Ticker
              // OR default feeds if no specific preference entry exists for that feed yet
              query += `
                  LEFT JOIN UserRssPreferences p ON a.feedId = p.feedId AND p.userId = ?
                  WHERE (p.showInTicker = 1) 
                     OR (p.feedId IS NULL AND f.is_default = 1)
              `;
              params.push(userId);
          } else {
              // Guest: Just default feeds
              query += ` WHERE f.is_default = 1 `;
          }

          query += ` ORDER BY a.pubDate DESC LIMIT ? `;
          params.push(limit);

          db.all(query, params, (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
          });
      });
  },

  updateUserRssPreference: (userId, feedId, showOnSite, showInTicker) => {
    return new Promise((resolve, reject) => {
      // Use COALESCE in the UPDATE part to preserve existing values if NULL is passed
      const query = `
        INSERT INTO UserRssPreferences (userId, feedId, showOnSite, showInTicker)
        VALUES (?, ?, COALESCE(?, 1), COALESCE(?, 0))
        ON CONFLICT(userId, feedId) DO UPDATE SET 
          showOnSite = CASE WHEN excluded.showOnSite IS NOT NULL THEN excluded.showOnSite ELSE UserRssPreferences.showOnSite END,
          showInTicker = CASE WHEN excluded.showInTicker IS NOT NULL THEN excluded.showInTicker ELSE UserRssPreferences.showInTicker END
      `;
      
      const params = [
          userId, 
          feedId, 
          showOnSite === undefined ? null : (showOnSite ? 1 : 0), 
          showInTicker === undefined ? null : (showInTicker ? 1 : 0)
      ];

      db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  getUserRssPreferences: (userId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT feedId, showOnSite, showInTicker FROM UserRssPreferences WHERE userId = ?', [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Admin: Get statistics about the RSS cache
   */
  getRssCacheStats: () => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          f.id, f.name, 
          COUNT(a.id) as articleCount,
          MAX(a.cachedAt) as lastCachedAt
        FROM RssFeeds f
        LEFT JOIN RssArticles_Cache a ON f.id = a.feedId
        GROUP BY f.id
      `;
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Admin: Get a list of all cached articles with metadata
   */
  getAdminRssArticles: (limit = 100, offset = 0) => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT a.id, a.title, a.pubDate, a.cachedAt, a.link, f.name as feedName
        FROM RssArticles_Cache a
        JOIN RssFeeds f ON a.feedId = f.id
        ORDER BY a.cachedAt DESC
        LIMIT ? OFFSET ?
      `;
      db.all(query, [limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  /**
   * Admin: Delete a single article from cache
   */
  deleteRssArticle: (id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM RssArticles_Cache WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  /**
   * Admin/System: Purge articles older than X hours
   */
  purgeRssArticles: (hoursThreshold) => {
    return new Promise((resolve, reject) => {
      const query = `DELETE FROM RssArticles_Cache WHERE cachedAt < datetime('now', '-' || ? || ' hours')`;
      db.run(query, [hoursThreshold], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  getLeaderboardSettings: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM LeaderboardSettings', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  updateLeaderboardSetting: (gameId, isHidden) => {
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
  },

  // ─── Wordle 2.0 CRUD ────────────────────────────────────────

  addWordleWord: (word) => {
    return new Promise((resolve, reject) => {
      const formatted = word.trim().toUpperCase();
      if (formatted.length !== 5) return reject(new Error("Word must be 5 characters long"));
      db.run("INSERT INTO wordle_dictionary (word) VALUES (?)", [formatted], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  },

  getWordleWords: () => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM wordle_dictionary ORDER BY word ASC", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  deleteWordleWord: (id) => {
    return new Promise((resolve, reject) => {
      // Constraint: Never delete if used
      db.run("DELETE FROM wordle_dictionary WHERE id = ? AND is_used = 0", [id], function(err) {
        if (err) reject(err);
        else if (this.changes === 0) reject(new Error("Word cannot be deleted (already used or not found)"));
        else resolve(this.changes);
      });
    });
  },

  pickUnusedWordleWord: () => {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM wordle_dictionary WHERE is_used = 0 ORDER BY RANDOM() LIMIT 1", (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  markWordleWordUsed: (id) => {
    return new Promise((resolve, reject) => {
      db.run("UPDATE wordle_dictionary SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?", [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  updateWordleMetadata: (id, definition, funnyQuote) => {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE wordle_dictionary SET definition = ?, funny_quote = ? WHERE id = ?",
        [definition, funnyQuote, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  },
  upsertWordleWord: (word, definition, funnyQuote) => {
    return new Promise((resolve, reject) => {
      const q = `
        INSERT INTO wordle_dictionary (word, definition, funny_quote) 
        VALUES (?, ?, ?) 
        ON CONFLICT(word) DO UPDATE SET 
          definition = COALESCE(excluded.definition, definition),
          funny_quote = COALESCE(excluded.funny_quote, funny_quote)
      `;
      db.run(q, [word.toUpperCase(), definition, funnyQuote], function(err) {
        if (err) reject(err);
        else resolve(this.lastID || this.changes);
      });
    });
  },

  updateWordleWordMetadataById: (id, definition, funnyQuote) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE wordle_dictionary SET definition = ?, funny_quote = ? WHERE id = ?',
        [definition, funnyQuote, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  },

  // --- Daily Fortune Cookie Methods ---
  getFortuneStatus: (userId, date) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT h.*, d.text 
         FROM user_fortunes_history h 
         LEFT JOIN fortunes_dictionary d ON h.fortune_id = d.id 
         WHERE h.user_id = ? AND h.opened_date = ?`,
        [userId, date],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  openDailyFortune: (userId, date) => {
    return new Promise((resolve, reject) => {
      const fallbackMsg = "Wow, du hast das Universum durchgespielt! Wir haben aktuell keine neuen Kekse mehr für dich. Sag dem Admin Bescheid!";
      
      // Step 1: Find a random unused fortune
      db.get(
        `SELECT id, text FROM fortunes_dictionary 
         WHERE id NOT IN (SELECT fortune_id FROM user_fortunes_history WHERE user_id = ? AND fortune_id IS NOT NULL) 
         ORDER BY RANDOM() LIMIT 1`,
        [userId],
        (err, fortune) => {
          if (err) return reject(err);

          const fortuneId = fortune ? fortune.id : null;
          const fortuneText = fortune ? fortune.text : fallbackMsg;

          // Step 2: Record opening
          db.run(
            `INSERT INTO user_fortunes_history (user_id, fortune_id, opened_date) VALUES (?, ?, ?)`,
            [userId, fortuneId, date],
            function(err) {
              if (err) {
                if (err.message.includes('UNIQUE')) {
                  reject(new Error('Du hast heute bereits einen Glückskeks geöffnet!'));
                } else {
                  reject(err);
                }
              } else {
                resolve({ id: fortuneId, text: fortuneText });
              }
            }
          );
        }
      );
    });
  },

  addFortunesBulk: (fortunes) => {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(fortunes)) return reject(new Error('Input must be an array of strings'));
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare('INSERT OR IGNORE INTO fortunes_dictionary (text) VALUES (?)');
        let count = 0;
        
        fortunes.forEach((text) => {
          if (typeof text === 'string' && text.trim().length > 0) {
            stmt.run(text.trim());
            count++;
          }
        });
        
        stmt.finalize();
        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve(count);
        });
      });
    });
  },

  getFortunesDictionary: () => {
    return new Promise((resolve, reject) => {
      // Returns all fortunes with a count of how many times they've been opened
      db.all(
        `SELECT d.*, COUNT(h.fortune_id) as usage_count 
         FROM fortunes_dictionary d 
         LEFT JOIN user_fortunes_history h ON d.id = h.fortune_id 
         GROUP BY d.id 
         ORDER BY d.id DESC`, 
        [], 
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  deleteFortune: (id) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Step 1: Set fortune_id to NULL in history to preserve user records
        db.run('UPDATE user_fortunes_history SET fortune_id = NULL WHERE fortune_id = ?', [id]);
        
        // Step 2: Delete from dictionary
        db.run('DELETE FROM fortunes_dictionary WHERE id = ?', [id], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve(this.changes);
          });
        });
      });
    });
  },

  getUserWordleWins: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT COALESCE(totalWins, 0) as totalWins FROM Wordle_UserStats WHERE userId = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.totalWins : 0);
      });
    });
  },

  getUserFortunesCount: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM user_fortunes_history WHERE user_id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    });
  },

  getUserBlackjackGames: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT COALESCE(gamesPlayed, 0) as gamesPlayed FROM BlackjackStats WHERE userId = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.gamesPlayed : 0);
      });
    });
  },

  getUserTotalSpent: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT COALESCE(ABS(SUM(amount)), 0) as total FROM KoalaTransactions WHERE user_id = ? AND amount < 0', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.total : 0);
      });
    });
  },

  getUserFriendCount: (userId) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM Friends WHERE (userId = ? OR friendId = ?) AND status = 'accepted'", [userId, userId], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    });
  },

  getUserTowerClimbCount: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM TowerClimbRounds WHERE userId = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    });
  },

  getUserLifetimeLottoTicketCount: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM LottoTickets WHERE userId = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    });
  },

  dbLayer: { db } // For direct access if needed
};

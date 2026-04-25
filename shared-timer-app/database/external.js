const db = require('./connection');

/**
 * External Integrations Domain (Esports, Bets, RSS, Countdowns, Feature Requests, Navbar, Pokemon)
 */

// --- Team Mappings ---
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

// --- Esports Teams ---
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

// --- Polymarket Settings ---
const getPolymarketSettings = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT value FROM ServerSettings WHERE key = 'polymarket_allow_users_add'`, (err, row) => {
      if (err) reject(err);
      else {
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

// --- Countdowns ---
const getCountdowns = (userId = null) => {
  return new Promise((resolve, reject) => {
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

// --- Bets ---
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
  return new Promise((resolve, reject) => {
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
            coinAdjustment -= payout;
            logReason = `Admin Revert: Bet ${newStatus} from Won on ${bet.chosenTeam}`;
        } else if (oldStatus === 'canceled' && newStatus !== 'canceled') {
            coinAdjustment -= bet.stake;
            logReason = `Admin Revert: Bet ${newStatus} from Canceled on ${bet.chosenTeam}`;
        }

        if (newStatus === 'won' && oldStatus !== 'won') {
            coinAdjustment += payout;
            logReason = `Admin Resolve: Bet Won on ${bet.chosenTeam}`;
        } else if (newStatus === 'canceled' && oldStatus !== 'canceled') {
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

// --- Custom Polymarket Bets ---
const addPolymarketGeneralBet = (userId, title, slug, url, outcomes) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO PolymarketGeneralBets (userId, title, slug, url, outcomes) VALUES (?, ?, ?, ?, ?)',
      [userId, title, slug, url, JSON.stringify(outcomes)],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
};

const getAllPolymarketGeneralBets = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT b.*, u.displayName
      FROM PolymarketGeneralBets b
      LEFT JOIN Users u ON b.userId = u.id
      ORDER BY b.createdAt DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getPolymarketGeneralBetById = (id) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT b.*, u.displayName
      FROM PolymarketGeneralBets b
      LEFT JOIN Users u ON b.userId = u.id
      WHERE b.id = ?
    `;
    db.get(query, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const updatePolymarketGeneralBetStatus = (id, status, winnerIndex = null) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE PolymarketGeneralBets SET status = ?, winnerIndex = ? WHERE id = ?',
      [status, winnerIndex, id],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

const deletePolymarketGeneralBet = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM PolymarketGeneralBets WHERE id = ?', [id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const placePolymarketUserBet = (userId, polymarketBetId, outcomeIndex, amount, shares, priceAtBet) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.get('SELECT koala_balance FROM Users WHERE id = ?', [userId], (err, user) => {
        if (err || !user || user.koala_balance < amount) {
          db.run('ROLLBACK');
          return reject(err || new Error('Insufficient balance'));
        }
        db.run('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?', [amount, userId]);
        db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, -amount, `Bet on Polymarket ID: ${polymarketBetId}`]);
        db.run(
          'INSERT INTO PolymarketUserBets (userId, polymarketBetId, outcomeIndex, amount, shares, priceAtBet) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, polymarketBetId, outcomeIndex, amount, shares, priceAtBet],
          function (insErr) {
            if (insErr) {
              db.run('ROLLBACK');
              return reject(insErr);
            }
            db.run('COMMIT', (err) => err ? reject(err) : resolve({ id: this.lastID }));
          }
        );
      });
    });
  });
};

const getPolymarketUserBets = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT ub.*, gb.title, gb.outcomes, gb.status as eventStatus, gb.winnerIndex
      FROM PolymarketUserBets ub
      JOIN PolymarketGeneralBets gb ON ub.polymarketBetId = gb.id
      WHERE ub.userId = ?
      ORDER BY ub.createdAt DESC
    `;
    db.all(query, [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getPolymarketUserBetsByBetId = (betId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT ub.*, u.displayName, u.username
      FROM PolymarketUserBets ub
      LEFT JOIN Users u ON ub.userId = u.id
      WHERE ub.polymarketBetId = ?
      ORDER BY ub.createdAt ASC
    `;
    db.all(query, [betId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getPolymarketUserBetsByBetIds = (betIds) => {
  return new Promise((resolve, reject) => {
    if (!betIds || betIds.length === 0) return resolve([]);
    const placeholders = betIds.map(() => '?').join(',');
    const query = `
      SELECT ub.*, u.displayName, u.username
      FROM PolymarketUserBets ub
      LEFT JOIN Users u ON ub.userId = u.id
      WHERE ub.polymarketBetId IN (${placeholders})
      ORDER BY ub.createdAt ASC
    `;
    db.all(query, betIds, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// --- Admin Actions ---
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

// --- Feature Requests ---
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

const getUserVoteCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM FeatureVotes WHERE userId = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });
};

// --- RSS ---
const getRssFeeds = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM RssFeeds ORDER BY is_default DESC, name ASC', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getRssFeedById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM RssFeeds WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const addRssFeed = (name, url, icon = null) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO RssFeeds (name, url, icon) VALUES (?, ?, ?)', [name, url, icon], function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, name, url, icon });
    });
  });
};

const updateRssFeed = (id, name, url, icon) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE RssFeeds SET name = ?, url = ?, icon = ? WHERE id = ?', [name, url, icon, id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const deleteRssFeed = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM RssFeeds WHERE id = ?', [id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateRssArticlesCache = (feedId, articles) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run('DELETE FROM RssArticles_Cache WHERE feedId = ?', [feedId]);
      const stmt = db.prepare('INSERT INTO RssArticles_Cache (feedId, title, imageUrl, snippet, link, pubDate) VALUES (?, ?, ?, ?, ?, ?)');
      articles.forEach(art => {
        stmt.run([feedId, art.title, art.imageUrl || null, art.snippet || null, art.link, art.pubDate]);
      });
      stmt.finalize();
      db.run('COMMIT', (err) => err ? reject(err) : resolve(true));
    });
  });
};

const getCachedArticles = (feedIds = null, limit = 100) => {
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
};

const getTickerNews = (userId = null, limit = 50) => {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT a.*, f.name as feedName, f.icon as feedIcon
      FROM RssArticles_Cache a
      JOIN RssFeeds f ON a.feedId = f.id
    `;
    const params = [];
    if (userId) {
      query += `
        LEFT JOIN UserRssPreferences p ON a.feedId = p.feedId AND p.userId = ?
        WHERE (p.showInTicker = 1) 
           OR (p.feedId IS NULL AND f.is_default = 1)
      `;
      params.push(userId);
    } else {
      query += ` WHERE f.is_default = 1 `;
    }
    query += ` ORDER BY a.pubDate DESC LIMIT ? `;
    params.push(limit);
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const updateUserRssPreference = (userId, feedId, showOnSite, showInTicker) => {
  return new Promise((resolve, reject) => {
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
};

const getUserRssPreferences = (userId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT feedId, showOnSite, showInTicker FROM UserRssPreferences WHERE userId = ?', [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getRssCacheStats = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT f.id, f.name, COUNT(a.id) as articleCount, MAX(a.cachedAt) as lastCachedAt
      FROM RssFeeds f
      LEFT JOIN RssArticles_Cache a ON f.id = a.feedId
      GROUP BY f.id
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const getAdminRssArticles = (limit = 100, offset = 0) => {
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
};

const deleteRssArticle = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM RssArticles_Cache WHERE id = ?', [id], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const purgeRssArticles = (hoursThreshold) => {
  return new Promise((resolve, reject) => {
    const query = `DELETE FROM RssArticles_Cache WHERE cachedAt < datetime('now', '-' || ? || ' hours')`;
    db.run(query, [hoursThreshold], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

// --- Navbar & Pokemon ---
const getNavbarSettings = (adminOnly = false) => {
  return new Promise((resolve, reject) => {
    const query = adminOnly 
      ? 'SELECT * FROM NavbarSettings ORDER BY sortOrder ASC'
      : 'SELECT * FROM NavbarSettings WHERE isVisible = 1 ORDER BY sortOrder ASC';
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const updateNavbarSettings = (settings) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      try {
        const newKeys = settings.map(s => s.key);
        const placeholders = newKeys.map(() => '?').join(',');
        db.run(`DELETE FROM NavbarSettings WHERE key NOT IN (${placeholders})`, newKeys);
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
          stmt.run([item.key, item.label, item.path, item.category, item.isVisible ? 1 : 0, item.isLocked ? 1 : 0, item.sortOrder || 0, item.has_daily_badge ? 1 : 0, item.icon || null]);
        });
        stmt.finalize();
        db.run('COMMIT', (err) => err ? reject(err) : resolve());
      } catch (err) {
        db.run('ROLLBACK');
        reject(err);
      }
    });
  });
};

const getPokemonConfigs = () => {
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
};

const updatePokemonConfigs = (settings, colors) => {
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
      db.run('COMMIT', (err) => err ? reject(err) : resolve());
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

module.exports = {
  getTeamMappings,
  getTeamMapping,
  addTeamMapping,
  deleteTeamMapping,
  upsertEsportsTeams,
  getAllEsportsTeams,
  getEsportsTeamsLastUpdated,
  getPolymarketSettings,
  updatePolymarketSettings,
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
  getBettingAccuracyLeaderboard,
  addPolymarketGeneralBet,
  getAllPolymarketGeneralBets,
  getPolymarketGeneralBetById,
  updatePolymarketGeneralBetStatus,
  deletePolymarketGeneralBet,
  placePolymarketUserBet,
  getPolymarketUserBets,
  getPolymarketUserBetsByBetId,
  getPolymarketUserBetsByBetIds,
  logAdminAction,
  getAdminActions,
  createFeatureRequest,
  getUserFeatureRequestCount,
  getFeatureRequests,
  voteFeatureRequest,
  updateFeatureStatus,
  updateFeatureAdminComment,
  deleteFeatureRequest,
  getUserVoteCount,
  getRssFeeds,
  getRssFeedById,
  addRssFeed,
  updateRssFeed,
  deleteRssFeed,
  updateRssArticlesCache,
  getCachedArticles,
  getTickerNews,
  updateUserRssPreference,
  getUserRssPreferences,
  getRssCacheStats,
  getAdminRssArticles,
  deleteRssArticle,
  purgeRssArticles,
  getNavbarSettings,
  updateNavbarSettings,
  getPokemonConfigs,
  updatePokemonConfigs,
  hasUnderdogWin,
  hasLoyalFanWin
};

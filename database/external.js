const db = require('./connection');

function readRows(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function readRow(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function write(sql, params = []) {
  const result = db.prepare(sql).run(...params);
  return { lastID: Number(result.lastInsertRowid), changes: Number(result.changes) };
}

/**
 * External Integrations Domain (Esports, Bets, RSS, Countdowns, Feature Requests, Navbar, Pokemon)
 */

// --- Team Mappings ---
const getTeamMappings = async () => readRows('SELECT * FROM TeamMappings');

const getTeamMapping = async (originalCode) => {
  const row = readRow('SELECT polymarketCode FROM TeamMappings WHERE originalCode = ?', [originalCode.toUpperCase()]);
  return row ? row.polymarketCode : null;
};

const addTeamMapping = async (originalCode, polymarketCode) => write(
  'INSERT INTO TeamMappings (originalCode, polymarketCode) VALUES (?, ?) ON CONFLICT(originalCode) DO UPDATE SET polymarketCode=excluded.polymarketCode',
  [originalCode.toUpperCase(), polymarketCode.toUpperCase()]
).changes;

const deleteTeamMapping = async (id) => write('DELETE FROM TeamMappings WHERE id = ?', [id]).changes;

// --- Esports Teams ---
const upsertEsportsTeams = async (teams) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const statement = db.prepare(`
        INSERT INTO EsportsTeams (code, name, league, image, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(code) DO UPDATE SET
          name = excluded.name,
          league = excluded.league,
          image = excluded.image,
          updated_at = CURRENT_TIMESTAMP
    `);
    for (const team of teams) statement.run(team.code, team.name, team.league || null, team.image || null);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

const getAllEsportsTeams = async () => readRows('SELECT code, name, league, image FROM EsportsTeams ORDER BY name ASC');

const getEsportsTeamsLastUpdated = async () => {
  const row = readRow('SELECT MAX(updated_at) AS last_updated FROM EsportsTeams');
  return row ? row.last_updated : null;
};

// --- Polymarket Settings ---
const getPolymarketSettings = async () => {
  const row = readRow("SELECT value FROM ServerSettings WHERE key = 'polymarket_allow_users_add'");
  return { allowUsersToAdd: row ? row.value === '1' : false };
};

const updatePolymarketSettings = async (allowUsersAdd) => {
  write("INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('polymarket_allow_users_add', ?)", [allowUsersAdd ? '1' : '0']);
  return true;
};

// --- Countdowns ---
const getCountdowns = async (userId = null) => userId
  ? readRows('SELECT * FROM Countdowns WHERE isGlobal = 1 OR isPublic = 1 OR userId = ? ORDER BY targetDate ASC', [userId])
  : readRows('SELECT * FROM Countdowns WHERE isGlobal = 1 OR isPublic = 1 ORDER BY targetDate ASC');

const createCountdown = async (eventName, targetDate, userId, creatorName, isPublic, isGlobal) => ({
  id: write(
    'INSERT INTO Countdowns (eventName, targetDate, userId, creatorName, isPublic, isGlobal) VALUES (?, ?, ?, ?, ?, ?)',
    [eventName, targetDate, userId, creatorName, isPublic ? 1 : 0, isGlobal ? 1 : 0]
  ).lastID
});

const deleteCountdown = async (id) => write('DELETE FROM Countdowns WHERE id = ?', [id]).changes;

const getCountdownById = async (id) => readRow('SELECT * FROM Countdowns WHERE id = ?', [id]);

// --- Bets ---
const createBet = async (userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate, league, team1Logo, team2Logo) => ({
  id: write(
    'INSERT INTO Bets (userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate, league, team1Logo, team2Logo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate, league, team1Logo, team2Logo]
  ).lastID
});

const getUserBets = async (userId, limit = 50) => readRows(
  'SELECT * FROM Bets WHERE userId = ? ORDER BY createdAt DESC LIMIT ?', [userId, limit]
);

const getUnresolvedPastBets = async () => readRows(`
  SELECT * FROM Bets WHERE status = 'open'
    AND datetime(eventDate) <= datetime('now', '-1 hours')
`);

const hasUnresolvedBetsForMatch = async (nameOrUrl) => readRow(
  'SELECT COUNT(*) AS count FROM Bets WHERE (matchName = ? OR polymarketUrl = ?) AND status = ?',
  [nameOrUrl, nameOrUrl, 'open']
).count > 0;

const resolveBetAtomic = async (betId, newStatus, payoutAmount, reason) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = readRow('SELECT status, userId FROM Bets WHERE id = ?', [betId]);
    if (!row) throw new Error('Bet not found');
    if (row.status !== 'open') {
      db.exec('COMMIT');
      return { success: false, reason: 'Already resolved' };
    }
    write('UPDATE Bets SET status = ? WHERE id = ?', [newStatus, betId]);
    if (payoutAmount > 0) {
      write('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [row.userId, payoutAmount, reason]);
      write('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [payoutAmount, row.userId]);
    }
    db.exec('COMMIT');
    return { success: true };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

const updateBetStatus = async (betId, newStatus) => write('UPDATE Bets SET status = ? WHERE id = ?', [newStatus, betId]).changes;

const getAllBetsAdmin = async () => readRows(`
      SELECT b.*, u.displayName as userName
      FROM Bets b
      LEFT JOIN Users u ON b.userId = u.id
      ORDER BY b.createdAt DESC
`);

const getRecentBets = async (days = 7) => readRows(`
      SELECT b.*, u.displayName as userName, u.preferences as userPreferences
      FROM Bets b
      LEFT JOIN Users u ON b.userId = u.id
      WHERE b.createdAt >= datetime('now', '-' || ? || ' days')
      ORDER BY 
        CASE WHEN b.status = 'open' THEN 0 ELSE 1 END ASC,
        CASE WHEN b.status = 'open' THEN b.eventDate END ASC,
        b.eventDate DESC
`, [days]);

const updateBetStatusAdmin = async (betId, newStatus) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const bet = readRow('SELECT * FROM Bets WHERE id = ?', [betId]);
    if (!bet) throw new Error('Bet not found');
    const oldStatus = bet.status;
    if (oldStatus === newStatus) {
      db.exec('COMMIT');
      return 0;
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

    write('UPDATE Bets SET status = ? WHERE id = ?', [newStatus, betId]);
    if (coinAdjustment !== 0) {
      write('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [bet.userId, coinAdjustment, logReason]);
      write('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [coinAdjustment, bet.userId]);
    }
    db.exec('COMMIT');
    return 1;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

const getBettingAccuracyLeaderboard = async () => readRows(`
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
`);

// --- Custom Polymarket Bets ---
const addPolymarketGeneralBet = async (userId, title, slug, url, outcomes) => ({
  id: write(
    'INSERT INTO PolymarketGeneralBets (userId, title, slug, url, outcomes) VALUES (?, ?, ?, ?, ?)',
    [userId, title, slug, url, JSON.stringify(outcomes)]
  ).lastID
});

const getAllPolymarketGeneralBets = async () => readRows(`
      SELECT b.*, u.displayName
      FROM PolymarketGeneralBets b
      LEFT JOIN Users u ON b.userId = u.id
      ORDER BY b.createdAt DESC
`);

const getPolymarketGeneralBetById = async (id) => readRow(`
      SELECT b.*, u.displayName
      FROM PolymarketGeneralBets b
      LEFT JOIN Users u ON b.userId = u.id
      WHERE b.id = ?
`, [id]);

const updatePolymarketGeneralBetStatus = async (id, status, winnerIndex = null) => write(
  'UPDATE PolymarketGeneralBets SET status = ?, winnerIndex = ? WHERE id = ?', [status, winnerIndex, id]
).changes;

const deletePolymarketGeneralBet = async (id) => write('DELETE FROM PolymarketGeneralBets WHERE id = ?', [id]).changes;

const placePolymarketUserBet = async (userId, polymarketBetId, outcomeIndex, amount, shares, priceAtBet) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const user = readRow('SELECT koala_balance FROM Users WHERE id = ?', [userId]);
    if (!user || user.koala_balance < amount) throw new Error('Insufficient balance');
    write('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?', [amount, userId]);
    write('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', [userId, -amount, `Bet on Polymarket ID: ${polymarketBetId}`]);
    const result = write(
      'INSERT INTO PolymarketUserBets (userId, polymarketBetId, outcomeIndex, amount, shares, priceAtBet) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, polymarketBetId, outcomeIndex, amount, shares, priceAtBet]
    );
    db.exec('COMMIT');
    return { id: result.lastID };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

const getPolymarketUserBets = async (userId) => readRows(`
      SELECT ub.*, gb.title, gb.outcomes, gb.status as eventStatus, gb.winnerIndex
      FROM PolymarketUserBets ub
      JOIN PolymarketGeneralBets gb ON ub.polymarketBetId = gb.id
      WHERE ub.userId = ?
      ORDER BY ub.createdAt DESC
`, [userId]);

const getPolymarketUserBetsByBetId = async (betId) => readRows(`
      SELECT ub.*, u.displayName, u.username
      FROM PolymarketUserBets ub
      LEFT JOIN Users u ON ub.userId = u.id
      WHERE ub.polymarketBetId = ?
      ORDER BY ub.createdAt ASC
`, [betId]);

const getPolymarketUserBetsByBetIds = async (betIds) => {
  if (!betIds || betIds.length === 0) return [];
  const placeholders = betIds.map(() => '?').join(',');
  return readRows(`
      SELECT ub.*, u.displayName, u.username
      FROM PolymarketUserBets ub
      LEFT JOIN Users u ON ub.userId = u.id
      WHERE ub.polymarketBetId IN (${placeholders})
      ORDER BY ub.createdAt ASC
  `, betIds);
};

// --- Admin Actions ---
const logAdminAction = async (adminId, adminName, action, details) => write(
  'INSERT INTO AdminActions (adminId, adminName, action, details) VALUES (?, ?, ?, ?)',
  [adminId, adminName, action, typeof details === 'object' ? JSON.stringify(details) : details]
).lastID;

const getAdminActions = async (limit = 100) => readRows('SELECT * FROM AdminActions ORDER BY timestamp DESC LIMIT ?', [limit]);

// --- Feature Requests ---
const createFeatureRequest = async (userId, userName, title, description, type = 'Feature') => write(
  'INSERT INTO FeatureRequests (userId, userName, title, description, type) VALUES (?, ?, ?, ?, ?)',
  [userId, userName, title, description, type]
).lastID;

const getUserFeatureRequestCount = async (userId) => readRow(
  'SELECT COUNT(*) AS count FROM FeatureRequests WHERE userId = ?', [userId]
).count;

const getFeatureRequests = async () => readRows(`
      SELECT fr.*, 
             (SELECT SUM(value) FROM FeatureVotes WHERE requestId = fr.id) as score,
             (SELECT COUNT(*) FROM FeatureVotes WHERE requestId = fr.id AND value = 1) as upvotes,
             (SELECT COUNT(*) FROM FeatureVotes WHERE requestId = fr.id AND value = -1) as downvotes
      FROM FeatureRequests fr
      ORDER BY score DESC, fr.createdAt DESC
`);

const voteFeatureRequest = async (requestId, userId, value) => write(
  'INSERT INTO FeatureVotes (requestId, userId, value) VALUES (?, ?, ?) ON CONFLICT(requestId, userId) DO UPDATE SET value = excluded.value',
  [requestId, userId, value]
).changes;

const updateFeatureStatus = async (requestId, status) => write(
  'UPDATE FeatureRequests SET status = ? WHERE id = ?', [status, requestId]
).changes;

const updateFeatureAdminComment = async (requestId, comment) => write(
  'UPDATE FeatureRequests SET adminComment = ? WHERE id = ?', [comment, requestId]
).changes;

const deleteFeatureRequest = async (requestId) => write('DELETE FROM FeatureRequests WHERE id = ?', [requestId]).changes;

const getUserVoteCount = async (userId) => readRow('SELECT COUNT(*) AS count FROM FeatureVotes WHERE userId = ?', [userId]).count;

// --- RSS ---
const getRssFeeds = async () => readRows('SELECT * FROM RssFeeds ORDER BY is_default DESC, name ASC');

const getRssFeedById = async (id) => readRow('SELECT * FROM RssFeeds WHERE id = ?', [id]);

const addRssFeed = async (name, url, icon = null) => ({
  id: write('INSERT INTO RssFeeds (name, url, icon) VALUES (?, ?, ?)', [name, url, icon]).lastID,
  name,
  url,
  icon
});

const updateRssFeed = async (id, name, url, icon) => write(
  'UPDATE RssFeeds SET name = ?, url = ?, icon = ? WHERE id = ?', [name, url, icon, id]
).changes;

const deleteRssFeed = async (id) => write('DELETE FROM RssFeeds WHERE id = ?', [id]).changes;

const updateRssArticlesCache = async (feedId, articles) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    write('DELETE FROM RssArticles_Cache WHERE feedId = ?', [feedId]);
    const statement = db.prepare('INSERT INTO RssArticles_Cache (feedId, title, imageUrl, snippet, link, pubDate) VALUES (?, ?, ?, ?, ?, ?)');
    for (const article of articles) {
      statement.run(feedId, article.title, article.imageUrl || null, article.snippet || null, article.link, article.pubDate);
    }
    db.exec('COMMIT');
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

const getCachedArticles = async (feedIds = null, limit = 100) => {
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
  return readRows(query, params);
};

const getTickerNews = async (userId = null, limit = 50) => {
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
  return readRows(query, params);
};

const updateUserRssPreference = async (userId, feedId, showOnSite, showInTicker) => {
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
  return write(query, params).changes;
};

const getUserRssPreferences = async (userId) => readRows(
  'SELECT feedId, showOnSite, showInTicker FROM UserRssPreferences WHERE userId = ?', [userId]
);

const getRssCacheStats = async () => readRows(`
      SELECT f.id, f.name, COUNT(a.id) as articleCount, MAX(a.cachedAt) as lastCachedAt
      FROM RssFeeds f
      LEFT JOIN RssArticles_Cache a ON f.id = a.feedId
      GROUP BY f.id
`);

const getAdminRssArticles = async (limit = 100, offset = 0) => readRows(`
      SELECT a.id, a.title, a.pubDate, a.cachedAt, a.link, f.name as feedName
      FROM RssArticles_Cache a
      JOIN RssFeeds f ON a.feedId = f.id
      ORDER BY a.cachedAt DESC
      LIMIT ? OFFSET ?
`, [limit, offset]);

const deleteRssArticle = async (id) => write('DELETE FROM RssArticles_Cache WHERE id = ?', [id]).changes;

const purgeRssArticles = async (hoursThreshold) => write(
  "DELETE FROM RssArticles_Cache WHERE cachedAt < datetime('now', '-' || ? || ' hours')", [hoursThreshold]
).changes;

// --- Navbar & Pokemon ---
const getNavbarSettings = async (adminOnly = false) => readRows(adminOnly
  ? 'SELECT * FROM NavbarSettings ORDER BY sortOrder ASC'
  : 'SELECT * FROM NavbarSettings WHERE isVisible = 1 ORDER BY sortOrder ASC');

const updateNavbarSettings = async (settings) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const newKeys = settings.map((setting) => setting.key);
    if (newKeys.length === 0) {
      db.exec('DELETE FROM NavbarSettings');
    } else {
      const placeholders = newKeys.map(() => '?').join(',');
      write(`DELETE FROM NavbarSettings WHERE key NOT IN (${placeholders})`, newKeys);
    }
    const statement = db.prepare(`
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
    for (const item of settings) {
      statement.run(item.key, item.label, item.path, item.category, item.isVisible ? 1 : 0,
        item.isLocked ? 1 : 0, item.sortOrder || 0, item.has_daily_badge ? 1 : 0, item.icon || null);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

const getPokemonConfigs = async () => {
  const settings = {};
  for (const row of readRows('SELECT * FROM PokemonSettings')) settings[row.key] = row.value;
  const colors = {};
  for (const row of readRows('SELECT * FROM PokemonTypeColors')) colors[row.type_name] = row.hex_color;
  return { settings, colors };
};

const updatePokemonConfigs = async (settings, colors) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const settingStatement = db.prepare('INSERT OR REPLACE INTO PokemonSettings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(settings || {})) settingStatement.run(key, String(value));
    const colorStatement = db.prepare('INSERT OR REPLACE INTO PokemonTypeColors (type_name, hex_color) VALUES (?, ?)');
    for (const [type, hex] of Object.entries(colors || {})) colorStatement.run(type, hex);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

const hasUnderdogWin = async (userId) => readRow(
  "SELECT COUNT(*) AS count FROM Bets WHERE userId = ? AND status = 'won' AND odds > 3.0", [userId]
).count > 0 ? 1 : 0;

const hasLoyalFanWin = async (userId) => readRow(`
      SELECT COUNT(*) as c FROM Bets b
      JOIN Users u ON b.userId = u.id
      WHERE b.userId = ? AND b.status = 'won'
        AND u.preferences IS NOT NULL
        AND b.chosenTeam = JSON_EXTRACT(u.preferences, '$.fanTeam')
`, [userId]).c > 0 ? 1 : 0;

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

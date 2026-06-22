const db = require('./connection');
const path = require('node:path');
const fs = require('node:fs');

function hasColumn(database, table, column) {
  return database.prepare(`PRAGMA table_info(${table})`).all()
    .some((candidate) => candidate.name === column);
}

function addColumn(database, table, column, definition) {
  if (!hasColumn(database, table, column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Wordle 2.0: Seeds the dictionary from JSON if empty and syncs with history
 */
function seedWordleDictionary(database) {
  const row = database.prepare('SELECT COUNT(*) AS count FROM wordle_dictionary').get();
  if (row && row.count > 0) return;

  const listPath = path.join(__dirname, '..', 'WordleWordList.json');
  if (!fs.existsSync(listPath)) {
    console.warn('[Wordle Migration] WordleWordList.json not found. Skipping seed.');
    return;
  }

  const jsonData = JSON.parse(fs.readFileSync(listPath, 'utf8'));
  if (!jsonData || !Array.isArray(jsonData.data)) return;

  const words = [...new Set(jsonData.data.map((word) => word.trim().toUpperCase()).filter((word) => word.length === 5))];
  const insert = database.prepare('INSERT OR IGNORE INTO wordle_dictionary (word) VALUES (?)');

  database.exec('BEGIN IMMEDIATE');
  try {
    for (const word of words) insert.run(word);
    database.exec(`
      UPDATE wordle_dictionary
      SET is_used = 1,
          used_at = (SELECT createdAt FROM Wordle_DailyWords WHERE Wordle_DailyWords.word = wordle_dictionary.word LIMIT 1)
      WHERE word IN (SELECT word FROM Wordle_DailyWords)
    `);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function initializeDatabaseSchema(database = db) {
    // Users: stores local identity name and optional local account details
    database.exec(`CREATE TABLE IF NOT EXISTS Users (
      id TEXT PRIMARY KEY,
      displayName TEXT NOT NULL,
      username TEXT UNIQUE,
      password_hash TEXT,
      preferences TEXT,
      is_superadmin BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastActive DATETIME
    )`);

    // Migration for existing Users table
    addColumn(database, 'Users', 'username', 'TEXT');
    addColumn(database, 'Users', 'password_hash', 'TEXT');
    addColumn(database, 'Users', 'preferences', 'TEXT');
    addColumn(database, 'Users', 'is_superadmin', 'BOOLEAN DEFAULT 0');
    addColumn(database, 'Users', 'lastActive', 'DATETIME');
    addColumn(database, 'Users', 'koala_balance', 'INTEGER DEFAULT 0');
    addColumn(database, 'Users', 'last_daily_claim', 'DATETIME');
    database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON Users(username)');

    // LeaderboardSettings: visibility toggle for games
    database.exec(`CREATE TABLE IF NOT EXISTS LeaderboardSettings (
      game_id TEXT PRIMARY KEY,
      is_hidden BOOLEAN DEFAULT 0
    )`);

    // ServerSettings: stores global app configurations
    database.exec(`CREATE TABLE IF NOT EXISTS ServerSettings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);
    database.exec(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_points_per_hour', '1000')`);
    database.exec(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_start_coins', '10000')`);
    database.exec(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_daily_mission_multiplier', '1.0')`);
    database.exec(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('achievement_reward_multiplier', '2.5')`);

    database.exec(`CREATE TABLE IF NOT EXISTS chip_skins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      rarity TEXT NOT NULL DEFAULT 'common',
      release_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK(status IN ('draft', 'public', 'restricted', 'disabled')),
      CHECK(rarity IN ('common', 'rare', 'epic', 'legendary', 'limited', 'exclusive'))
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS chip_skin_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skin_id INTEGER NOT NULL,
      chip_value INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      original_filename TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(skin_id) REFERENCES chip_skins(id) ON DELETE CASCADE,
      UNIQUE(skin_id, chip_value),
      CHECK(chip_value IN (1, 5, 10, 25, 50, 100, 500, 1000))
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS chip_skin_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skin_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      granted_by TEXT,
      FOREIGN KEY(skin_id) REFERENCES chip_skins(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
      UNIQUE(skin_id, user_id)
    )`);

    database.exec('CREATE INDEX IF NOT EXISTS idx_chip_skins_status_release ON chip_skins(status, release_date)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_chip_skin_grants_user ON chip_skin_grants(user_id)');

    // KoalaTransactions: logs coin additions and deductions
    database.exec(`CREATE TABLE IF NOT EXISTS KoalaTransactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id)
    )`);
    database.exec('CREATE INDEX IF NOT EXISTS idx_transactions_user ON KoalaTransactions(user_id)');

    // BannedUsers: stores banned accounts
    database.exec(`CREATE TABLE IF NOT EXISTS BannedUsers (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      reason TEXT,
      bannedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(id) REFERENCES Users(id)
    )`);

    // UserAchievements: stores claimed milestone achievements and daily claims
    database.exec(`CREATE TABLE IF NOT EXISTS UserAchievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      achievementId TEXT NOT NULL,
      claimedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id),
      UNIQUE(userId, achievementId)
    )`);

    // Rooms table is no longer used (managed in RAM via roomManager.js)
    // We keep the migration logic below to drop it if it exists.

    // Friends: stores friendship connections
    database.exec(`CREATE TABLE IF NOT EXISTS Friends (
      userId TEXT,
      friendId TEXT,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (userId, friendId),
      FOREIGN KEY(userId) REFERENCES Users(id),
      FOREIGN KEY(friendId) REFERENCES Users(id)
    )`);
    database.exec('CREATE INDEX IF NOT EXISTS idx_friends_friendId ON Friends(friendId)');

    // BlockedUsers: stores blocked user relationships
    database.exec(`CREATE TABLE IF NOT EXISTS BlockedUsers (
      blockerId TEXT NOT NULL,
      blockedId TEXT NOT NULL,
      blockedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (blockerId, blockedId),
      FOREIGN KEY(blockerId) REFERENCES Users(id),
      FOREIGN KEY(blockedId) REFERENCES Users(id)
    )`);
    database.exec('CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON BlockedUsers(blockerId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON BlockedUsers(blockedId)');

    // TimerEvents: stores history of completed timers for stats
    // Note: No foreign key to Rooms anymore as rooms are RAM-only.
    database.exec(`CREATE TABLE IF NOT EXISTS TimerEvents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      roomId TEXT,
      roomName TEXT,
      durationMinutes REAL,
      completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    // Migration: Ensure durationMinutes is REAL and remove FK to Rooms
    addColumn(database, 'TimerEvents', 'roomName', 'TEXT');
    addColumn(database, 'TimerEvents', 'durationMinutes', 'REAL');
    const timerColumns = database.prepare('PRAGMA table_info(TimerEvents)').all();
    const durationColumn = timerColumns.find((column) => column.name === 'durationMinutes');
    const hasRoomsForeignKey = database.prepare('PRAGMA foreign_key_list(TimerEvents)').all()
      .some((foreignKey) => foreignKey.table === 'Rooms');

    if (hasRoomsForeignKey || (durationColumn && durationColumn.type !== 'REAL')) {
      database.exec('PRAGMA foreign_keys=OFF');
      database.exec('BEGIN IMMEDIATE');
      try {
        database.exec('DROP TABLE IF EXISTS TimerEvents_new');
        database.exec('CREATE TABLE TimerEvents_new (id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT, roomId TEXT, roomName TEXT, durationMinutes REAL, completedAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(userId) REFERENCES Users(id))');
        database.exec('INSERT INTO TimerEvents_new (id, userId, roomId, roomName, durationMinutes, completedAt) SELECT id, userId, roomId, roomName, durationMinutes, completedAt FROM TimerEvents');
        database.exec('DROP TABLE TimerEvents');
        database.exec('ALTER TABLE TimerEvents_new RENAME TO TimerEvents');
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      } finally {
        database.exec('PRAGMA foreign_keys=ON');
      }
    }
    database.exec('DROP TABLE IF EXISTS Rooms');

    // TeamMappings: maps lol esports acronyms to polymarket acronyms (e.g., EINS -> ES1)
    database.exec(`CREATE TABLE IF NOT EXISTS TeamMappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      originalCode TEXT UNIQUE NOT NULL,
      polymarketCode TEXT NOT NULL
    )`);

    // Countdowns: user-created countdown timers
    database.exec(`CREATE TABLE IF NOT EXISTS Countdowns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventName TEXT NOT NULL,
      targetDate TEXT NOT NULL,
      userId TEXT,
      creatorName TEXT,
      isPublic BOOLEAN DEFAULT 0,
      isGlobal BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // EsportsTeams: stores all fetched esports teams for autocomplete
    database.exec(`CREATE TABLE IF NOT EXISTS EsportsTeams (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      league TEXT,
      image TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Bets: user wagers on esports matches
    database.exec(`CREATE TABLE IF NOT EXISTS Bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      matchName TEXT NOT NULL,
      chosenTeam TEXT NOT NULL,
      polymarketTeam TEXT,
      stake INTEGER NOT NULL,
      odds REAL NOT NULL,
      polymarketUrl TEXT,
      eventDate DATETIME NOT NULL,
      status TEXT DEFAULT 'open',
      league TEXT,
      team1Logo TEXT,
      team2Logo TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    // Migration: Add polymarketTeam to Bets
    addColumn(database, 'Bets', 'polymarketTeam', 'TEXT');
    addColumn(database, 'Bets', 'league', 'TEXT');
    addColumn(database, 'Bets', 'team1Logo', 'TEXT');
    addColumn(database, 'Bets', 'team2Logo', 'TEXT');

    // ErrorLogs: persistent storage for server-side errors
    database.exec(`CREATE TABLE IF NOT EXISTS ErrorLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      stack TEXT,
      context TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // SystemLogs: dedicated table for info/warn logs with 24h retention
    database.exec(`CREATE TABLE IF NOT EXISTS SystemLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT,
      context TEXT,
      message TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // ─── Performance Indexes ───────────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_timer_userId ON TimerEvents(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_timer_completedAt ON TimerEvents(completedAt)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_koala_tx_userId ON KoalaTransactions(user_id)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_countdowns_userId ON Countdowns(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_countdowns_visibility ON Countdowns(isPublic, isGlobal)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_friends_userId ON Friends(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_friends_friendId ON Friends(friendId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_friends_user_status ON Friends(userId, status, friendId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_friends_friend_status ON Friends(friendId, status, userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_users_koalabalance ON Users(koala_balance);');
    database.exec('CREATE INDEX IF NOT EXISTS idx_users_last_active ON Users(lastActive);');
    database.exec('CREATE INDEX IF NOT EXISTS idx_bets_userid ON Bets(userId);');
    database.exec('CREATE INDEX IF NOT EXISTS idx_bets_status ON Bets(status);');
    database.exec('CREATE INDEX IF NOT EXISTS idx_timer_user_completed ON TimerEvents(userId, completedAt DESC)');

    // --- NavbarSettings ---
    database.exec(`CREATE TABLE IF NOT EXISTS NavbarSettings (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      path TEXT NOT NULL,
      category TEXT DEFAULT 'Other',
      isVisible BOOLEAN DEFAULT 1,
      isLocked BOOLEAN DEFAULT 0,
      sortOrder INTEGER DEFAULT 0,
      has_daily_badge BOOLEAN DEFAULT 0,
      icon TEXT
    )`);
    addColumn(database, 'NavbarSettings', 'has_daily_badge', 'BOOLEAN DEFAULT 0');
    addColumn(database, 'NavbarSettings', 'isLocked', 'BOOLEAN DEFAULT 0');
    addColumn(database, 'NavbarSettings', 'icon', 'TEXT');
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder, icon)
      VALUES ('news', 'News Feed', '/news', 'Tools', 1, 30, 'Rss')`);
    database.exec("UPDATE NavbarSettings SET category = 'Tools', icon = 'Rss' WHERE key = 'news'");
    database.exec("UPDATE NavbarSettings SET sortOrder = 30 WHERE key = 'news' AND (sortOrder = 0 OR sortOrder IS NULL)");

    database.exec('CREATE INDEX IF NOT EXISTS idx_navbar_visible_sort ON NavbarSettings(isVisible, sortOrder)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_navbar_sort ON NavbarSettings(sortOrder)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_esports_teams_name ON EsportsTeams(name)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_esports_teams_updated ON EsportsTeams(updated_at DESC)');

    // ─── New Admin & Feature Roadmap Tables ──────────────────────
    database.exec(`CREATE TABLE IF NOT EXISTS AdminActions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adminId TEXT NOT NULL,
      adminName TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS FeatureRequests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'Pending Review',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      adminComment TEXT
    )`);

    // Migration: Add adminComment to FeatureRequests
    addColumn(database, 'FeatureRequests', 'adminComment', 'TEXT');
    addColumn(database, 'FeatureRequests', 'type', "TEXT DEFAULT 'Feature'");

    database.exec(`CREATE TABLE IF NOT EXISTS FeatureVotes (
      requestId INTEGER NOT NULL,
      userId TEXT NOT NULL,
      value INTEGER NOT NULL,
      PRIMARY KEY (requestId, userId),
      FOREIGN KEY(requestId) REFERENCES FeatureRequests(id) ON DELETE CASCADE
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS UserGameStats (
      userId TEXT NOT NULL,
      gameId TEXT NOT NULL,
      highscore INTEGER DEFAULT 0,
      sprintHighscore INTEGER DEFAULT 0,
      totalScore INTEGER DEFAULT 0,
      totalLines INTEGER DEFAULT 0,
      maxLevel INTEGER DEFAULT 1,
      playCount INTEGER DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (userId, gameId),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Phase 19 Migration: Add maxLevel to UserGameStats
    addColumn(database, 'UserGameStats', 'maxLevel', 'INTEGER DEFAULT 1');
    addColumn(database, 'UserGameStats', 'sprintHighscore', 'INTEGER DEFAULT 0');

    // GameScores: stores historical performance entries
    database.exec(`CREATE TABLE IF NOT EXISTS GameScores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      gameId TEXT NOT NULL,
      score INTEGER NOT NULL,
      coinsEarned INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS TowerClimbRounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      bet INTEGER NOT NULL,
      tilesPerLevel INTEGER NOT NULL,
      levelCount INTEGER NOT NULL DEFAULT 8,
      currentLevel INTEGER NOT NULL DEFAULT 0,
      currentMultiplier REAL NOT NULL DEFAULT 1,
      selectedTiles TEXT NOT NULL DEFAULT '[]',
      trapPattern TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      payout INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolvedAt DATETIME,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);
    database.exec('CREATE INDEX IF NOT EXISTS idx_tower_rounds_user_created ON TowerClimbRounds(userId, createdAt DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_tower_rounds_user_status ON TowerClimbRounds(userId, status)');
    database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_tower_rounds_user_running ON TowerClimbRounds(userId) WHERE status = 'running'");

    database.exec(`CREATE TABLE IF NOT EXISTS BlackjackStats (
      userId TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      gamesPlayed INTEGER NOT NULL DEFAULT 0,
      blackjacksHit INTEGER NOT NULL DEFAULT 0,
      totalWagered INTEGER NOT NULL DEFAULT 0,
      totalWon INTEGER NOT NULL DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_totalWon ON BlackjackStats(totalWon DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_gamesPlayed ON BlackjackStats(gamesPlayed DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_blackjacksHit ON BlackjackStats(blackjacksHit DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_totalWagered ON BlackjackStats(totalWagered DESC)');

    // PolymarketGeneralBets: for user-submitted custom bets
    database.exec(`CREATE TABLE IF NOT EXISTS PolymarketGeneralBets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL UNIQUE,
      outcomes TEXT NOT NULL, -- JSON
      status TEXT DEFAULT 'open',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);
    addColumn(database, 'PolymarketGeneralBets', 'winnerIndex', 'INTEGER');

    // PolymarketUserBets: for user bets on custom Polymarket events
    database.exec(`CREATE TABLE IF NOT EXISTS PolymarketUserBets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      polymarketBetId INTEGER NOT NULL,
      outcomeIndex INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(polymarketBetId) REFERENCES PolymarketGeneralBets(id) ON DELETE CASCADE
    )`);

    // Migration: Add shares and priceAtBet to PolymarketUserBets
    addColumn(database, 'PolymarketUserBets', 'shares', 'REAL DEFAULT 0.0');
    addColumn(database, 'PolymarketUserBets', 'priceAtBet', 'REAL DEFAULT 0.0');

    // --- Wordle Minigame ---
    database.exec(`CREATE TABLE IF NOT EXISTS wordle_dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      is_used BOOLEAN DEFAULT 0,
      definition TEXT,
      funny_quote TEXT,
      used_at DATETIME
    )`);

    // --- Daily Fortune Cookie ---
    database.exec(`CREATE TABLE IF NOT EXISTS fortunes_dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT UNIQUE NOT NULL
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS user_fortunes_history (
      user_id TEXT NOT NULL,
      fortune_id INTEGER,
      opened_date TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
      UNIQUE(user_id, opened_date)
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS Wordle_DailyWords (
      date TEXT PRIMARY KEY,
      word TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS Wordle_DailyResults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      guesses TEXT NOT NULL, -- JSON array of guesses
      won BOOLEAN NOT NULL,
      earnedCoins INTEGER DEFAULT 0,
      hintUsed BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, date),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS Wordle_UserStats (
      userId TEXT PRIMARY KEY,
      totalPlayed INTEGER DEFAULT 0,
      totalWins INTEGER DEFAULT 0,
      currentStreak INTEGER DEFAULT 0,
      maxStreak INTEGER DEFAULT 0,
      totalHintsBought INTEGER DEFAULT 0,
      lastStreakDate TEXT,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);
    const wordleMigration = database.prepare(
      "SELECT value FROM ServerSettings WHERE key = 'wordle_history_migrated'"
    ).get();
    if (!wordleMigration || wordleMigration.value !== '1') {
      database.exec(`
        INSERT OR REPLACE INTO Wordle_UserStats
          (userId, totalPlayed, totalWins, currentStreak, maxStreak, lastStreakDate, totalHintsBought)
        SELECT userId, COUNT(*), SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END), 0, 0, NULL, 0
        FROM Wordle_DailyResults
        GROUP BY userId
      `);
      database.exec("INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('wordle_history_migrated', '1')");
    }

    // Migration: Add hintUsed to existing Wordle_DailyResults
    addColumn(database, 'Wordle_DailyResults', 'hintUsed', 'BOOLEAN DEFAULT 0');

    // Phase 19 Migration: Remove sessionLog column from GameScores
    if (hasColumn(database, 'GameScores', 'sessionLog')) {
      database.exec('BEGIN IMMEDIATE');
      try {
        database.exec('DROP TABLE IF EXISTS GameScores_new');
        database.exec('CREATE TABLE GameScores_new (id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT NOT NULL, gameId TEXT NOT NULL, score INTEGER NOT NULL, coinsEarned INTEGER NOT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(userId) REFERENCES Users(id))');
        database.exec('INSERT INTO GameScores_new (id, userId, gameId, score, coinsEarned, createdAt) SELECT id, userId, gameId, score, coinsEarned, createdAt FROM GameScores');
        database.exec('DROP TABLE GameScores');
        database.exec('ALTER TABLE GameScores_new RENAME TO GameScores');
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }

    // --- NEW: Game Upgrades & Config ---
    database.exec(`CREATE TABLE IF NOT EXISTS GameUpgrades_Config (
      upgrade_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      description TEXT,
      base_price INTEGER NOT NULL,
      price_step INTEGER NOT NULL,
      max_level INTEGER NOT NULL,
      category TEXT DEFAULT 'koala_flap'
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS UserUpgrades (
      userId TEXT NOT NULL,
      upgrade_id TEXT NOT NULL,
      current_level INTEGER DEFAULT 0,
      PRIMARY KEY (userId, upgrade_id),
      FOREIGN KEY(userId) REFERENCES Users(id),
      FOREIGN KEY(upgrade_id) REFERENCES GameUpgrades_Config(upgrade_id)
    )`);
    database.exec(`INSERT OR IGNORE INTO GameUpgrades_Config (upgrade_id, display_name, description, base_price, price_step, max_level, category) VALUES
      ('coin_base_value', 'Münz-Wert', 'Erhöht den KoalaCoin-Basiswert jeder Münze um +20% pro Level.', 500, 250, 10, 'koala_flap'),
      ('extra_lives', 'Extra-Leben', 'Jedes Level gewährt ein zusätzliches Herz zu Rundenbeginn.', 1000, 500, 3, 'koala_flap'),
      ('crit_coins', 'Crit Coins', 'Erhöht die Chance auf den 10-fachen Münzwert um +1% pro Level.', 1500, 750, 10, 'koala_flap')`);
    database.exec("UPDATE GameUpgrades_Config SET description = 'Erhöht den KoalaCoin-Basiswert jeder Münze um +20% pro Level.' WHERE upgrade_id = 'coin_base_value'");
    database.exec("UPDATE GameUpgrades_Config SET description = 'Jedes Level gewährt ein zusätzliches Herz zu Rundenbeginn.' WHERE upgrade_id = 'extra_lives'");
    database.exec("DELETE FROM UserUpgrades WHERE upgrade_id = 'hotstreak_multiplier'");
    database.exec("DELETE FROM GameUpgrades_Config WHERE upgrade_id = 'hotstreak_multiplier'");

    database.exec("INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_coin_conversion_rate', '0.01')");
    database.exec("INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_daily_mission_reward', '5000')");

    // UserMissions: tracks completion of daily tasks
    database.exec(`CREATE TABLE IF NOT EXISTS UserMissions (
      userId TEXT NOT NULL,
      mission_id TEXT NOT NULL,
      last_completed_at TEXT NOT NULL,
      PRIMARY KEY (userId, mission_id),
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    // ScratchcardPools: Manual superadmin assignment of teams to scratchcard types
    database.exec(`CREATE TABLE IF NOT EXISTS ScratchcardPools (
      card_type TEXT NOT NULL,
      team_code TEXT NOT NULL,
      PRIMARY KEY(card_type, team_code)
    )`);

    // ScratchcardConfigs: Superadmin configuration for economy (price, win chance, reward)
    database.exec(`CREATE TABLE IF NOT EXISTS ScratchcardConfigs (
      card_type TEXT PRIMARY KEY,
      price INTEGER NOT NULL,
      win_chance REAL NOT NULL,
      reward_amount INTEGER NOT NULL
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS scratchcard_packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      region_label TEXT,
      scope TEXT NOT NULL CHECK (scope IN ('Regional', 'International')),
      price INTEGER NOT NULL,
      win_chance REAL DEFAULT 0.3,
      reward_amount INTEGER, -- For non-weighted fixed reward
      is_weighted BOOLEAN DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS scratchcard_pack_teams (
      pack_id INTEGER NOT NULL,
      team_code TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      PRIMARY KEY(pack_id, team_code),
      FOREIGN KEY(pack_id) REFERENCES scratchcard_packs(id) ON DELETE CASCADE
    )`);


    database.exec("INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('game_koalaflap_payout_enabled', 'true')");

    database.exec('CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON AdminActions(timestamp)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_features_status ON FeatureRequests(status)');

    // Phase 3 Migration: Add max_daily_limit to scratchcard_packs
    addColumn(database, 'scratchcard_packs', 'max_daily_limit', 'INTEGER DEFAULT 0');

    // Phase 18 Migration: Add is_special to scratchcard_packs
    addColumn(database, 'scratchcard_packs', 'is_special', 'BOOLEAN DEFAULT 0');

    // Phase 18 Migration: Add type column to FeatureRequests
    addColumn(database, 'FeatureRequests', 'type', "TEXT DEFAULT 'Feature'");

    // SpeedcubeTimes: stores cube timer results
    database.exec(`CREATE TABLE IF NOT EXISTS SpeedcubeTimes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      note TEXT DEFAULT '',
      scramble TEXT DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);
    addColumn(database, 'SpeedcubeTimes', 'scramble', "TEXT DEFAULT ''");
    database.exec('CREATE INDEX IF NOT EXISTS idx_speedcube_userId ON SpeedcubeTimes(userId)');

    // Scratchcards: stores purchased but not yet claimed cards
    database.exec(`CREATE TABLE IF NOT EXISTS Scratchcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      grid TEXT NOT NULL,
      winAmount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'purchased',
      price INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    // Phase 14 Migration: Add price to Scratchcards
    addColumn(database, 'Scratchcards', 'price', 'INTEGER DEFAULT 0');
    database.exec('CREATE INDEX IF NOT EXISTS idx_scratchcards_userId ON Scratchcards(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_scratchcards_status ON Scratchcards(status)');

    // AchievementSettings: stores per-achievement multipliers
    database.exec(`CREATE TABLE IF NOT EXISTS AchievementSettings (
      achievementId TEXT PRIMARY KEY,
      multiplier REAL DEFAULT 1.0
    )`);

    // --- LEC Rift Defense ---
    database.exec(`CREATE TABLE IF NOT EXISTS RiftDefense_Towers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      teamCode TEXT NOT NULL,
      starLevel INTEGER DEFAULT 1,
      rarityTier INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);
    addColumn(database, 'RiftDefense_Towers', 'rarityTier', 'INTEGER DEFAULT 0');
    database.exec('CREATE INDEX IF NOT EXISTS idx_riftdefense_userId ON RiftDefense_Towers(userId)');

    database.exec(`CREATE TABLE IF NOT EXISTS RiftDefense_Stats (
      userId TEXT PRIMARY KEY,
      highestWave INTEGER DEFAULT 0,
      totalMinionsKilled INTEGER DEFAULT 0,
      totalBossesKilled INTEGER DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // --- LoL Idle Game (Road to Worlds) ---
    database.exec(`CREATE TABLE IF NOT EXISTS Idle_Profiles (
      userId TEXT PRIMARY KEY,
      level INTEGER DEFAULT 1,
      hype INTEGER DEFAULT 0,
      dollars INTEGER DEFAULT 1000000,
      last_sync_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      upgrades_json TEXT DEFAULT '{}',
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    addColumn(database, 'Idle_Profiles', 'dollars', 'INTEGER DEFAULT 1000000');

    database.exec(`CREATE TABLE IF NOT EXISTS Idle_Inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      team_code TEXT NOT NULL,
      tier INTEGER DEFAULT 1,
      role TEXT DEFAULT 'Top',
      level INTEGER DEFAULT 1,
      experience INTEGER DEFAULT 0,
      rarity TEXT DEFAULT 'Common',
      base_stats INTEGER DEFAULT 10,
      is_equipped BOOLEAN DEFAULT 0,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);
    addColumn(database, 'Idle_Inventory', 'role', "TEXT DEFAULT 'Top'");
    addColumn(database, 'Idle_Inventory', 'level', 'INTEGER DEFAULT 1');
    addColumn(database, 'Idle_Inventory', 'experience', 'INTEGER DEFAULT 0');
    addColumn(database, 'Idle_Inventory', 'rarity', "TEXT DEFAULT 'Common'");
    addColumn(database, 'Idle_Inventory', 'base_stats', 'INTEGER DEFAULT 10');

    database.exec(`CREATE TABLE IF NOT EXISTS Idle_Roster (
      userId TEXT NOT NULL,
      slot_id INTEGER NOT NULL,
      inventory_id INTEGER,
      current_mode TEXT DEFAULT 'Trainieren',
      PRIMARY KEY (userId, slot_id),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(inventory_id) REFERENCES Idle_Inventory(id) ON DELETE SET NULL
    )`);

    // --- end NavbarSettings ---
    // Phase 20 Migration: Color Sync Tables
    database.exec(`CREATE TABLE IF NOT EXISTS ColorSync_Scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      score REAL NOT NULL,
      target_color TEXT NOT NULL,
      guessed_color TEXT NOT NULL,
      mode TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS ColorSync_Daily (
      date TEXT PRIMARY KEY,
      target_color TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS ColorSync_DailyResults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      score REAL NOT NULL,
      guessed_color TEXT NOT NULL,
      date TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, date),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS ColorSync_Lobbies (
      id TEXT PRIMARY KEY,
      creatorId TEXT NOT NULL,
      target_color TEXT NOT NULL,
      status TEXT DEFAULT 'waiting',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(creatorId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS ColorSync_LobbyParticipants (
      lobby_id TEXT NOT NULL,
      userId TEXT NOT NULL,
      score REAL,
      guessed_color TEXT,
      submitted_at DATETIME,
      PRIMARY KEY(lobby_id, userId),
      FOREIGN KEY(lobby_id) REFERENCES ColorSync_Lobbies(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    database.exec('CREATE INDEX IF NOT EXISTS idx_colorsync_scores_userId ON ColorSync_Scores(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_colorsync_lobby_participants_lobbyId ON ColorSync_LobbyParticipants(lobby_id)');

    // Seed default menu items
    const defaults = [
      ['dashboard', 'Sync Timers', '/', 'Timers', 1, 1],
      ['countdowns', 'Countdowns', '/countdowns', 'Timers', 1, 2],
      ['speedcube', 'Speedcube Timer', '/speedcube', 'Timers', 1, 3],
      ['statistics', 'Statistics', '/highscores', 'Timers', 1, 4],
      ['esports', 'Esports', '/esports', 'Esports', 1, 1],
      ['esports-bets', 'Community Bets', '/global-bets', 'Esports', 1, 2],
      ['financial-dashboard', 'Financial Dashboard', '/koala-dashboard', 'Esports', 1, 3],
      ['achievements', 'Achievements & Boni', '/achievements', 'Esports', 1, 4],
      ['koala-flap', 'KoalaFlap', '/games/koalaflap', 'Games', 1, 1],
      ['scratch-cards', 'Scratchcards', '/scratchcards', 'Games', 1, 2],
      ['rift-defense', 'LEC Rift Defense', '/games/rift-defense', 'Games', 1, 3],
      ['game-leaderboards', 'Game Leaderboards', '/games/leaderboard', 'Games', 1, 4],
      ['settings', 'Settings', '/settings', 'System', 1, 1],
      ['roadmap', 'Feature Roadmap', '/features', 'System', 1, 2],
      ['changelog', 'Changelog', '/changelog', 'System', 1, 3],
      ['admin', 'Admin Panel', '/admin', 'System', 1, 4],
      ['friends', 'Friends', '/friends', 'Social', 1, 1]
    ];

    const insertNavbarItem = database.prepare(
      'INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const values of defaults) insertNavbarItem.run(...values);

    // Migration: Ensure friends link exists with proper icon
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder, icon)
            VALUES ('friends', 'Friends', '/friends', 'Social', 1, 1, 'Users')`);
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('admin', 'Admin Panel', '/admin', 'System', 1, 4)`);

    // Fix: Feature Roadmap path (was /roadmap, should be /features)
    // Removed because it overrides persistence: database.exec("UPDATE NavbarSettings SET path = '/features' WHERE key = 'roadmap'");

    // LoL Idle Game Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('lol-idle', 'Road to Worlds', '/games/lol-idle', 'Games', 1, 1.5)`);

    // Shift other games to make room for 1.5 (or just use REAL if SQLite allows, but it's INTEGER)
    // Actually, SQLite INTEGER can store REAL if needed, but let's be clean.

    // Color Sync Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('colorsync', 'Color Sync', '/color-sync', 'Games', 1, 6)`);
    // Removed because it overrides persistence: database.exec("UPDATE NavbarSettings SET sortOrder = 6 WHERE key = 'colorsync' AND category = 'Games'");

    // Leveling Tracker Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('leveling-tracker', 'Leveling Tracker', '/leveling', 'Timers', 1, 5)`);

    // Tetris Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('tetris', 'Tetris', '/tetris', 'Games', 1, 7)`);

    // Polymarket General Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('polymarket-general', 'Polymarket General', '/polymarket-general', 'Esports', 1, 5)`);

    // Wordle Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('wordle', 'Wordle', '/wordle', 'Games', 1, 8)`);

    // Tower Climb Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('tower-climb', 'Tower Climb', '/games/tower-climb', 'Games', 1, 9)`);

    // Lotto Imitat Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('lotto', 'Lotto Imitat', '/lotto', 'Games', 1, 10)`);

    // Blackjack Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('blackjack', 'Blackjack', '/games/blackjack', 'Games', 1, 11)`);


    // ─── Leveling Milestones Table ───────────────────────────────
    database.exec(`CREATE TABLE IF NOT EXISTS LevelingMilestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      level INTEGER NOT NULL,
      reachedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, level),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // ─── Pokemon System Tables ───────────────────────────────────
    database.exec(`CREATE TABLE IF NOT EXISTS PokemonSettings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);
    database.exec(`INSERT OR IGNORE INTO PokemonSettings (key, value) VALUES ('contrast_threshold', '0.6')`);

    database.exec(`CREATE TABLE IF NOT EXISTS PokemonTypeColors (
      type_name TEXT PRIMARY KEY,
      hex_color TEXT NOT NULL
    )`);
    const defaultColors = [
      ['normal', '#A8A878'], ['fire', '#F08030'], ['water', '#6890F0'], ['grass', '#78C850'],
      ['electric', '#F8D030'], ['ice', '#98D8D8'], ['fighting', '#C03028'], ['poison', '#A040A0'],
      ['ground', '#E0C068'], ['flying', '#A890F0'], ['psychic', '#F85888'], ['bug', '#A8B820'],
      ['rock', '#B8A038'], ['ghost', '#705898'], ['dragon', '#7038F8'], ['dark', '#705848'],
      ['steel', '#B8B8D0'], ['fairy', '#EE99AC']
    ];
    const insertTypeColor = database.prepare(
      'INSERT OR IGNORE INTO PokemonTypeColors (type_name, hex_color) VALUES (?, ?)'
    );
    for (const color of defaultColors) insertTypeColor.run(...color);

    // ─── MMO Market Prices Table ──────────────────────────────────
    database.exec(`CREATE TABLE IF NOT EXISTS MMO_MarketPrices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    itemName TEXT NOT NULL,
    price BIGINT NOT NULL,
    updatedBy TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    isDeleted INTEGER DEFAULT 0
  )`);

    addColumn(database, 'MMO_MarketPrices', 'createdAt', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

    database.exec(`CREATE INDEX IF NOT EXISTS idx_market_deleted_name ON MMO_MarketPrices(isDeleted, itemName);`);

    // GlobalGameStats: for fast global tracking of game winnings
    database.exec(`CREATE TABLE IF NOT EXISTS GlobalGameStats (
    gameId TEXT PRIMARY KEY,
    totalPayout INTEGER DEFAULT 0,
    totalWins INTEGER DEFAULT 0,
    totalPlayed INTEGER DEFAULT 0
  )`);
    addColumn(database, 'GlobalGameStats', 'totalPlayed', 'INTEGER DEFAULT 0');
    const insertGlobalStats = database.prepare(
      'INSERT OR IGNORE INTO GlobalGameStats (gameId, totalPayout, totalWins, totalPlayed) VALUES (?, ?, ?, ?)'
    );
    const towerStats = database.prepare(
      "SELECT COUNT(*) AS played, SUM(CASE WHEN status = 'cashed_out' THEN 1 ELSE 0 END) AS wins, SUM(payout) AS payout FROM TowerClimbRounds"
    ).get();
    insertGlobalStats.run('tower-climb', towerStats.payout || 0, towerStats.wins || 0, towerStats.played || 0);
    const scratchcardStats = database.prepare(
      'SELECT COUNT(*) AS played, SUM(winAmount) AS payout, SUM(CASE WHEN winAmount > 0 THEN 1 ELSE 0 END) AS wins FROM Scratchcards'
    ).get();
    insertGlobalStats.run('scratchcards', scratchcardStats.payout || 0, scratchcardStats.wins || 0, scratchcardStats.played || 0);
    insertGlobalStats.run('lotto', 0, 0, 0);

    // --- Lotto Imitat Tables ---
    database.exec(`CREATE TABLE IF NOT EXISTS LottoDrawings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drawDate TEXT NOT NULL UNIQUE,
    numbers TEXT NOT NULL,
    superzahl INTEGER NOT NULL,
    totalTickets INTEGER DEFAULT 0,
    totalWinners INTEGER DEFAULT 0,
    totalPayout INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    database.exec(`CREATE TABLE IF NOT EXISTS LottoTickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    drawDate TEXT NOT NULL,
    numbers TEXT NOT NULL,
    superzahl INTEGER NOT NULL,
    matchCount INTEGER DEFAULT 0,
    superzahlMatch BOOLEAN DEFAULT 0,
    winClass INTEGER DEFAULT 0,
    winAmount INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
  )`);

    database.exec('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_user ON LottoTickets(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_draw ON LottoTickets(drawDate, status)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_user_draw ON LottoTickets(userId, drawDate)');

    // --- RSS News Tables ---
    database.exec(`CREATE TABLE IF NOT EXISTS RssFeeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    icon TEXT,
    is_default BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
    database.prepare('INSERT OR IGNORE INTO RssFeeds (name, url, icon, is_default) VALUES (?, ?, ?, ?)')
      .run('Tagesschau', 'https://www.tagesschau.de/xml/rss2/', 'https://www.tagesschau.de/favicon.ico', 1);

    database.exec(`CREATE TABLE IF NOT EXISTS RssArticles_Cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feedId INTEGER NOT NULL,
    title TEXT NOT NULL,
    imageUrl TEXT,
    snippet TEXT,
    link TEXT NOT NULL,
    pubDate DATETIME,
    cachedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(feedId) REFERENCES RssFeeds(id) ON DELETE CASCADE
  )`);

    database.exec('CREATE INDEX IF NOT EXISTS idx_rss_articles_feed_date ON RssArticles_Cache(feedId, pubDate DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_rss_feeds_default ON RssFeeds(is_default)');

    database.exec(`CREATE TABLE IF NOT EXISTS UserRssPreferences (
    userId TEXT NOT NULL,
    feedId INTEGER NOT NULL,
    showOnSite BOOLEAN DEFAULT 1,
    showInTicker BOOLEAN DEFAULT 0,
    PRIMARY KEY (userId, feedId),
    FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY(feedId) REFERENCES RssFeeds(id) ON DELETE CASCADE
  )`);

    // Migration for UserRssPreferences
    const hadHiddenPreference = hasColumn(database, 'UserRssPreferences', 'isHidden');
    const hadShowOnSite = hasColumn(database, 'UserRssPreferences', 'showOnSite');
    addColumn(database, 'UserRssPreferences', 'showOnSite', 'BOOLEAN DEFAULT 1');
    if (!hadShowOnSite && hadHiddenPreference) {
      database.exec('UPDATE UserRssPreferences SET showOnSite = 0 WHERE isHidden = 1');
    }
    addColumn(database, 'UserRssPreferences', 'showInTicker', 'BOOLEAN DEFAULT 0');
    database.exec(`
      INSERT OR IGNORE INTO UserRssPreferences (userId, feedId, showOnSite, showInTicker)
      SELECT u.id, f.id, 1, 1 FROM Users u, RssFeeds f WHERE f.is_default = 1
    `);
    database.exec('UPDATE UserRssPreferences SET showInTicker = 1 WHERE feedId IN (SELECT id FROM RssFeeds WHERE is_default = 1)');

    // --- Wordle 2.0 Dictionary ---
    database.exec(`CREATE TABLE IF NOT EXISTS wordle_dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      is_used BOOLEAN DEFAULT 0,
      definition TEXT,
      funny_quote TEXT,
      used_at DATETIME
    )`);

    seedWordleDictionary(database);
}

module.exports = {
  initializeDatabaseSchema
};

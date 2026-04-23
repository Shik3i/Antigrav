const sqlite3 = require('sqlite3').verbose();
const db = require('./connection');
const path = require('path');
const fs = require('fs');

const dbFilePath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'timerapp.db');
const WORDLE_SEED_MAX_RETRIES = 5;
const WORDLE_SEED_RETRY_DELAY_MS = 500;

let wordleSeedInFlight = false;
let wordleSeedRetryTimer = null;

function scheduleWordleSeedRetry(attempt, reason) {
  if (attempt >= WORDLE_SEED_MAX_RETRIES) {
    console.error(`[Wordle Migration] Giving up after ${attempt} retries. Last error: ${reason?.message || reason}`);
    return;
  }

  const nextAttempt = attempt + 1;
  const delayMs = WORDLE_SEED_RETRY_DELAY_MS * nextAttempt;

  if (wordleSeedRetryTimer) {
    clearTimeout(wordleSeedRetryTimer);
  }

  console.warn(`[Wordle Migration] Retry ${nextAttempt}/${WORDLE_SEED_MAX_RETRIES} scheduled in ${delayMs}ms.`);
  wordleSeedRetryTimer = setTimeout(() => {
    wordleSeedRetryTimer = null;
    seedWordleDictionary(nextAttempt);
  }, delayMs);
}

/**
 * Wordle 2.0: Seeds the dictionary from JSON if empty and syncs with history
 */
function seedWordleDictionary(attempt = 0) {
  if (wordleSeedInFlight) return;

  db.get("SELECT COUNT(*) as count FROM wordle_dictionary", (err, row) => {
    if (err) return console.error("[Wordle Migration] Error checking dictionary:", err);
    if (row && row.count > 0) return; // Already seeded

    console.log("[Wordle Migration] Dictionary empty. Starting migration...");

    try {
      // Adjusted path because this file is in /database/
      const listPath = path.join(__dirname, '..', 'WordleWordList.json');
      
      if (!fs.existsSync(listPath)) {
        console.warn("[Wordle Migration] WordleWordList.json not found. Skipping seed.");
        return;
      }

      const content = fs.readFileSync(listPath, 'utf8');
      const jsonData = JSON.parse(content);
      if (!jsonData || !Array.isArray(jsonData.data)) return;

      const words = [...new Set(jsonData.data.map(w => w.trim().toUpperCase()).filter(w => w.length === 5))];
      wordleSeedInFlight = true;

      const seedDb = new sqlite3.Database(dbFilePath, (openErr) => {
        const closeSeedDb = (onClosed) => {
          seedDb.close((closeErr) => {
            wordleSeedInFlight = false;
            if (closeErr) {
              console.error("[Wordle Migration] Failed to close dedicated seed connection:", closeErr);
            }
            if (onClosed) onClosed(closeErr);
          });
        };

        if (openErr) {
          wordleSeedInFlight = false;
          console.error("[Wordle Migration] Failed to open dedicated seed connection:", openErr);
          scheduleWordleSeedRetry(attempt, openErr);
          return;
        }

        if (typeof db.applyDatabasePragmas === 'function') {
          db.applyDatabasePragmas(seedDb);
        }

        seedDb.serialize(() => {
          seedDb.run("BEGIN TRANSACTION", (beginErr) => {
            if (beginErr) {
              console.error("[Wordle Migration] Failed to start transaction:", beginErr);
              closeSeedDb(() => scheduleWordleSeedRetry(attempt, beginErr));
              return;
            }

            const rollbackWithLog = (message, cause, shouldRetry = false) => {
              console.error(message, cause);
              seedDb.run("ROLLBACK", (rollbackErr) => {
                if (rollbackErr) {
                  console.error("[Wordle Migration] Rollback failed:", rollbackErr);
                }
                closeSeedDb(() => {
                  if (shouldRetry) {
                    scheduleWordleSeedRetry(attempt, cause);
                  }
                });
              });
            };

            const stmt = seedDb.prepare("INSERT OR IGNORE INTO wordle_dictionary (word) VALUES (?)");
            words.forEach((word) => {
              stmt.run(word);
            });

            stmt.finalize((finalizeErr) => {
              if (finalizeErr) {
                rollbackWithLog("[Wordle Migration] Error inserting dictionary words:", finalizeErr, true);
                return;
              }

              // Historical Sync: Mark already played words as used
              const syncQuery = `
                UPDATE wordle_dictionary
                SET is_used = 1,
                    used_at = (SELECT createdAt FROM Wordle_DailyWords WHERE Wordle_DailyWords.word = wordle_dictionary.word LIMIT 1)
                WHERE word IN (SELECT word FROM Wordle_DailyWords)
              `;
              seedDb.run(syncQuery, (syncErr) => {
                if (syncErr) {
                  rollbackWithLog("[Wordle Migration] Error during historical sync:", syncErr, true);
                  return;
                }

                seedDb.run("COMMIT", (commitErr) => {
                  if (commitErr) {
                    rollbackWithLog("[Wordle Migration] Commit failed:", commitErr, true);
                  } else {
                    console.log(`[Wordle Migration] Successfully seeded ${words.length} words and synced history.`);
                    closeSeedDb();
                  }
                });
              });
            });
          });
        });
      });
    } catch (error) {
      wordleSeedInFlight = false;
      console.error("[Wordle Migration] Fatal error during seeding:", error);
    }
  });
}

function initializeDatabaseSchema() {
  db.serialize(() => {
    // Users: stores local identity name and optional local account details
    db.run(`CREATE TABLE IF NOT EXISTS Users (
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
    db.run("ALTER TABLE Users ADD COLUMN username TEXT", (err) => {
      if (!err || (err && err.message.includes("duplicate column name"))) {
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON Users(username)");
      }
    });
    db.run("ALTER TABLE Users ADD COLUMN password_hash TEXT", () => { });
    db.run("ALTER TABLE Users ADD COLUMN preferences TEXT", () => { });
    db.run("ALTER TABLE Users ADD COLUMN is_superadmin BOOLEAN DEFAULT 0", () => { });
    db.run("ALTER TABLE Users ADD COLUMN lastActive DATETIME", () => { });
    db.run("ALTER TABLE Users ADD COLUMN koala_balance INTEGER DEFAULT 0", () => { });
    db.run("ALTER TABLE Users ADD COLUMN last_daily_claim DATETIME", () => { });
    db.run("ALTER TABLE Users ADD COLUMN lastActive DATETIME", () => { });

    // LeaderboardSettings: visibility toggle for games
    db.run(`CREATE TABLE IF NOT EXISTS LeaderboardSettings (
      game_id TEXT PRIMARY KEY,
      is_hidden BOOLEAN DEFAULT 0
    )`);

    // ServerSettings: stores global app configurations
    db.run(`CREATE TABLE IF NOT EXISTS ServerSettings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`, () => {
      // Insert default koala baseline
      db.run(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_points_per_hour', '1000')`);
      db.run(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_start_coins', '10000')`);
      db.run(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_daily_mission_multiplier', '1.0')`);
      db.run(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('achievement_reward_multiplier', '2.5')`);
    });

    // KoalaTransactions: logs coin additions and deductions
    db.run(`CREATE TABLE IF NOT EXISTS KoalaTransactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id)
    )`);
    db.run('CREATE INDEX IF NOT EXISTS idx_transactions_user ON KoalaTransactions(user_id)');

    // BannedUsers: stores banned accounts
    db.run(`CREATE TABLE IF NOT EXISTS BannedUsers (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      reason TEXT,
      bannedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(id) REFERENCES Users(id)
    )`);

    // UserAchievements: stores claimed milestone achievements and daily claims
    db.run(`CREATE TABLE IF NOT EXISTS UserAchievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      achievementId TEXT NOT NULL,
      claimedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id),
      UNIQUE(userId, achievementId)
    )`);

    // Rooms table is no longer used (managed in RAM via roomManager.js)
    // We keep the migration logic below to drop it if it exists.

    // Drop legacy Rooms table if it exists
    db.run("DROP TABLE IF EXISTS Rooms", () => { });

    // Friends: stores friendship connections
    db.run(`CREATE TABLE IF NOT EXISTS Friends (
      userId TEXT,
      friendId TEXT,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (userId, friendId),
      FOREIGN KEY(userId) REFERENCES Users(id),
      FOREIGN KEY(friendId) REFERENCES Users(id)
    )`);
    db.run('CREATE INDEX IF NOT EXISTS idx_friends_friendId ON Friends(friendId)');

    // TimerEvents: stores history of completed timers for stats
    // Note: No foreign key to Rooms anymore as rooms are RAM-only.
    db.run(`CREATE TABLE IF NOT EXISTS TimerEvents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      roomId TEXT,
      roomName TEXT,
      durationMinutes REAL,
      completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    // Migration: Ensure durationMinutes is REAL and remove FK to Rooms
    db.all("PRAGMA table_info(TimerEvents)", (err, cols) => {
      if (err) return;
      const durationCol = cols.find(c => c.name === 'durationMinutes');
      const hasRoomsFK = new Promise((res) => {
        db.all("PRAGMA foreign_key_list(TimerEvents)", (e, rows) => res(!e && rows && rows.some(r => r.table === 'Rooms')));
      });

      hasRoomsFK.then(needsFKCleanup => {
        if (needsFKCleanup || (durationCol && durationCol.type !== 'REAL')) {
          console.log("[Migration] Upgrading TimerEvents for precision and legacy cleanup...");
          db.serialize(() => {
            db.run("CREATE TABLE TimerEvents_new (id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT, roomId TEXT, roomName TEXT, durationMinutes REAL, completedAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(userId) REFERENCES Users(id))");
            db.run("INSERT INTO TimerEvents_new (id, userId, roomId, roomName, durationMinutes, completedAt) SELECT id, userId, roomId, roomName, durationMinutes, completedAt FROM TimerEvents");
            db.run("DROP TABLE TimerEvents");
            db.run("ALTER TABLE TimerEvents_new RENAME TO TimerEvents");
            db.run("CREATE INDEX IF NOT EXISTS idx_timer_userId ON TimerEvents(userId)");
            db.run("CREATE INDEX IF NOT EXISTS idx_timer_completedAt ON TimerEvents(completedAt)");
          });
        }
      });
    });

    // Migration: Add new columns to existing TimerEvents table
    db.run("ALTER TABLE TimerEvents ADD COLUMN roomName TEXT", () => { });
    db.run("ALTER TABLE TimerEvents ADD COLUMN durationMinutes REAL", () => { });

    // TeamMappings: maps lol esports acronyms to polymarket acronyms (e.g., EINS -> ES1)
    db.run(`CREATE TABLE IF NOT EXISTS TeamMappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      originalCode TEXT UNIQUE NOT NULL,
      polymarketCode TEXT NOT NULL
    )`);

    // Countdowns: user-created countdown timers
    db.run(`CREATE TABLE IF NOT EXISTS Countdowns (
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
    db.run(`CREATE TABLE IF NOT EXISTS EsportsTeams (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      league TEXT,
      image TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Bets: user wagers on esports matches
    db.run(`CREATE TABLE IF NOT EXISTS Bets (
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
    db.run("ALTER TABLE Bets ADD COLUMN polymarketTeam TEXT", () => { });
    db.run("ALTER TABLE Bets ADD COLUMN league TEXT", () => { });
    db.run("ALTER TABLE Bets ADD COLUMN team1Logo TEXT", () => { });
    db.run("ALTER TABLE Bets ADD COLUMN team2Logo TEXT", () => { });

    // ErrorLogs: persistent storage for server-side errors
    db.run(`CREATE TABLE IF NOT EXISTS ErrorLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      stack TEXT,
      context TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // SystemLogs: dedicated table for info/warn logs with 24h retention
    db.run(`CREATE TABLE IF NOT EXISTS SystemLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT,
      context TEXT,
      message TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // ─── Performance Indexes ───────────────────────────────────────
    db.run('CREATE INDEX IF NOT EXISTS idx_timer_userId ON TimerEvents(userId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_timer_completedAt ON TimerEvents(completedAt)');
    db.run('CREATE INDEX IF NOT EXISTS idx_koala_tx_userId ON KoalaTransactions(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_countdowns_userId ON Countdowns(userId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_countdowns_visibility ON Countdowns(isPublic, isGlobal)');
    db.run('CREATE INDEX IF NOT EXISTS idx_friends_userId ON Friends(userId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_friends_friendId ON Friends(friendId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_friends_user_status ON Friends(userId, status, friendId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_friends_friend_status ON Friends(friendId, status, userId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_users_koalabalance ON Users(koala_balance);');
    db.run('CREATE INDEX IF NOT EXISTS idx_users_last_active ON Users(lastActive);');
    db.run('CREATE INDEX IF NOT EXISTS idx_bets_userid ON Bets(userId);');
    db.run('CREATE INDEX IF NOT EXISTS idx_bets_status ON Bets(status);');
    db.run('CREATE INDEX IF NOT EXISTS idx_timer_user_completed ON TimerEvents(userId, completedAt DESC)');

    // --- NavbarSettings ---
    db.run(`CREATE TABLE IF NOT EXISTS NavbarSettings (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      path TEXT NOT NULL,
      category TEXT DEFAULT 'Other',
      isVisible BOOLEAN DEFAULT 1,
      isLocked BOOLEAN DEFAULT 0,
      sortOrder INTEGER DEFAULT 0,
      has_daily_badge BOOLEAN DEFAULT 0,
      icon TEXT
    )`, () => {
      // Sequential migration for existing tables
      db.serialize(() => {
        // Safely add missing columns if they don't exist
        db.run("ALTER TABLE NavbarSettings ADD COLUMN has_daily_badge BOOLEAN DEFAULT 0", (err) => { });
        db.run("ALTER TABLE NavbarSettings ADD COLUMN isLocked BOOLEAN DEFAULT 0", (err) => { });
        db.run("ALTER TABLE NavbarSettings ADD COLUMN icon TEXT", (err) => {
          // Now it's safe to run inserts/updates that use the icon column

          // Migration: Ensure News Feed exists in NavbarSettings under 'Tools' category
          db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder, icon) 
                  VALUES ('news', 'News Feed', '/news', 'Tools', 1, 30, 'Rss')`);

          // Force category and icon for the news entry to ensure it moves to the new group
          db.run(`UPDATE NavbarSettings SET category = 'Tools', icon = 'Rss' WHERE key = 'news'`);

          // Optional: Ensure a reasonable sort order if it's currently 0 or default
          db.run(`UPDATE NavbarSettings SET sortOrder = 30 WHERE key = 'news' AND (sortOrder = 0 OR sortOrder IS NULL)`);
        });
      });
    });

    db.run('CREATE INDEX IF NOT EXISTS idx_navbar_visible_sort ON NavbarSettings(isVisible, sortOrder)');
    db.run('CREATE INDEX IF NOT EXISTS idx_navbar_sort ON NavbarSettings(sortOrder)');
    db.run('CREATE INDEX IF NOT EXISTS idx_esports_teams_name ON EsportsTeams(name)');
    db.run('CREATE INDEX IF NOT EXISTS idx_esports_teams_updated ON EsportsTeams(updated_at DESC)');

    // ─── New Admin & Feature Roadmap Tables ──────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS AdminActions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adminId TEXT NOT NULL,
      adminName TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS FeatureRequests (
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
    db.run("ALTER TABLE FeatureRequests ADD COLUMN adminComment TEXT", () => { });
    db.run("ALTER TABLE FeatureRequests ADD COLUMN type TEXT DEFAULT 'Feature'", () => { });

    db.run(`CREATE TABLE IF NOT EXISTS FeatureVotes (
      requestId INTEGER NOT NULL,
      userId TEXT NOT NULL,
      value INTEGER NOT NULL,
      PRIMARY KEY (requestId, userId),
      FOREIGN KEY(requestId) REFERENCES FeatureRequests(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS UserGameStats (
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
    db.run("ALTER TABLE UserGameStats ADD COLUMN maxLevel INTEGER DEFAULT 1", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Migration error adding maxLevel to UserGameStats:", err);
      }
    });

    db.run("ALTER TABLE UserGameStats ADD COLUMN sprintHighscore INTEGER DEFAULT 0", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Migration error adding sprintHighscore to UserGameStats:", err);
      }
    });

    // GameScores: stores historical performance entries
    db.run(`CREATE TABLE IF NOT EXISTS GameScores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      gameId TEXT NOT NULL,
      score INTEGER NOT NULL,
      coinsEarned INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS TowerClimbRounds (
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
    db.run('CREATE INDEX IF NOT EXISTS idx_tower_rounds_user_created ON TowerClimbRounds(userId, createdAt DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_tower_rounds_user_status ON TowerClimbRounds(userId, status)');
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_tower_rounds_user_running ON TowerClimbRounds(userId) WHERE status = 'running'");

    db.run(`CREATE TABLE IF NOT EXISTS BlackjackStats (
      userId TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      gamesPlayed INTEGER NOT NULL DEFAULT 0,
      blackjacksHit INTEGER NOT NULL DEFAULT 0,
      totalWagered INTEGER NOT NULL DEFAULT 0,
      totalWon INTEGER NOT NULL DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);
    db.run('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_totalWon ON BlackjackStats(totalWon DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_gamesPlayed ON BlackjackStats(gamesPlayed DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_blackjacksHit ON BlackjackStats(blackjacksHit DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_totalWagered ON BlackjackStats(totalWagered DESC)');

    // PolymarketGeneralBets: for user-submitted custom bets
    db.run(`CREATE TABLE IF NOT EXISTS PolymarketGeneralBets (
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
    db.run("ALTER TABLE PolymarketGeneralBets ADD COLUMN winnerIndex INTEGER", () => { });

    // PolymarketUserBets: for user bets on custom Polymarket events
    db.run(`CREATE TABLE IF NOT EXISTS PolymarketUserBets (
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
    db.run("ALTER TABLE PolymarketUserBets ADD COLUMN shares REAL DEFAULT 0.0", () => { });
    db.run("ALTER TABLE PolymarketUserBets ADD COLUMN priceAtBet REAL DEFAULT 0.0", () => { });

    // --- Wordle Minigame ---
    db.run(`CREATE TABLE IF NOT EXISTS wordle_dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      is_used BOOLEAN DEFAULT 0,
      definition TEXT,
      funny_quote TEXT,
      used_at DATETIME
    )`);

    // --- Daily Fortune Cookie ---
    db.run(`CREATE TABLE IF NOT EXISTS fortunes_dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT UNIQUE NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_fortunes_history (
      user_id TEXT NOT NULL,
      fortune_id INTEGER,
      opened_date TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
      UNIQUE(user_id, opened_date)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS Wordle_DailyWords (
      date TEXT PRIMARY KEY,
      word TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS Wordle_DailyResults (
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

    db.run(`CREATE TABLE IF NOT EXISTS Wordle_UserStats (
      userId TEXT PRIMARY KEY,
      totalPlayed INTEGER DEFAULT 0,
      totalWins INTEGER DEFAULT 0,
      currentStreak INTEGER DEFAULT 0,
      maxStreak INTEGER DEFAULT 0,
      totalHintsBought INTEGER DEFAULT 0,
      lastStreakDate TEXT,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`, () => {
      // Check if the history has already been migrated
      db.get("SELECT value FROM ServerSettings WHERE key = 'wordle_history_migrated'", (err, row) => {
        if (!err && (!row || row.value !== '1')) {
          console.log("[Migration] Full backfill of Wordle_UserStats from history...");
          db.run(`
                    INSERT OR REPLACE INTO Wordle_UserStats (userId, totalPlayed, totalWins, currentStreak, maxStreak, lastStreakDate, totalHintsBought)
                    SELECT 
                      userId, 
                      COUNT(*) as totalPlayed, 
                      SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) as totalWins,
                      0, 0, NULL, 0
                    FROM Wordle_DailyResults
                    GROUP BY userId
                `, (err) => {
            if (!err) {
              db.run("INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('wordle_history_migrated', '1')");
              console.log("[Migration] Wordle history backfill completed.");
            } else {
              console.error("[Migration] Wordle backfill failed:", err.message);
            }
          });
        }
      });
    });

    // Migration: Add hintUsed to existing Wordle_DailyResults
    db.run("ALTER TABLE Wordle_DailyResults ADD COLUMN hintUsed BOOLEAN DEFAULT 0", () => { });

    // Phase 19 Migration: Remove sessionLog column from GameScores
    db.all("PRAGMA table_info(GameScores)", (err, cols) => {
      if (!err && cols && cols.some(c => c.name === 'sessionLog')) {
        console.log("[Migration] Removing sessionLog column from GameScores...");
        db.serialize(() => {
          db.run("BEGIN TRANSACTION");
          db.run("CREATE TABLE GameScores_new (id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT NOT NULL, gameId TEXT NOT NULL, score INTEGER NOT NULL, coinsEarned INTEGER NOT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(userId) REFERENCES Users(id))");
          db.run("INSERT INTO GameScores_new (id, userId, gameId, score, coinsEarned, createdAt) SELECT id, userId, gameId, score, coinsEarned, createdAt FROM GameScores");
          db.run("DROP TABLE GameScores");
          db.run("ALTER TABLE GameScores_new RENAME TO GameScores");
          db.run("COMMIT", (err) => {
            if (err) console.error("[Migration] Failed to remove sessionLog column:", err);
            else console.log("[Migration] Successfully removed sessionLog column.");
          });
        });
      }
    });

    // --- NEW: Game Upgrades & Config ---
    db.run(`CREATE TABLE IF NOT EXISTS GameUpgrades_Config (
      upgrade_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      description TEXT,
      base_price INTEGER NOT NULL,
      price_step INTEGER NOT NULL,
      max_level INTEGER NOT NULL,
      category TEXT DEFAULT 'koala_flap'
    )`, () => {
      // Initial data for KoalaFlap upgrades
      db.run(`INSERT OR IGNORE INTO GameUpgrades_Config (upgrade_id, display_name, description, base_price, price_step, max_level, category) VALUES 
        ('coin_base_value', 'Münz-Wert', 'Erhöht den KoalaCoin-Basiswert jeder Münze um +20% pro Level.', 500, 250, 10, 'koala_flap'),
        ('extra_lives', 'Extra-Leben', 'Jedes Level gewährt ein zusätzliches Herz zu Rundenbeginn.', 1000, 500, 3, 'koala_flap'),
        ('crit_coins', 'Crit Coins', 'Erhöht die Chance auf den 10-fachen Münzwert um +1% pro Level.', 1500, 750, 10, 'koala_flap')`);

      // Update existing descriptions if needed (since INSERT OR IGNORE won't update them)
      db.run("UPDATE GameUpgrades_Config SET description = 'Erhöht den KoalaCoin-Basiswert jeder Münze um +20% pro Level.' WHERE upgrade_id = 'coin_base_value'");
      db.run("UPDATE GameUpgrades_Config SET description = 'Jedes Level gewährt ein zusätzliches Herz zu Rundenbeginn.' WHERE upgrade_id = 'extra_lives'");

      // Phase 15: Clean up Hotstreak-Multiplier (Removed for economy reasons)
      db.run("DELETE FROM GameUpgrades_Config WHERE upgrade_id = 'hotstreak_multiplier'");
      db.run("DELETE FROM UserUpgrades WHERE upgrade_id = 'hotstreak_multiplier'");
    });

    db.run(`CREATE TABLE IF NOT EXISTS UserUpgrades (
      userId TEXT NOT NULL,
      upgrade_id TEXT NOT NULL,
      current_level INTEGER DEFAULT 0,
      PRIMARY KEY (userId, upgrade_id),
      FOREIGN KEY(userId) REFERENCES Users(id),
      FOREIGN KEY(upgrade_id) REFERENCES GameUpgrades_Config(upgrade_id)
    )`);

    db.run("INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_coin_conversion_rate', '0.01')");
    db.run("INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_daily_mission_reward', '5000')");

    // UserMissions: tracks completion of daily tasks
    db.run(`CREATE TABLE IF NOT EXISTS UserMissions (
      userId TEXT NOT NULL,
      mission_id TEXT NOT NULL,
      last_completed_at TEXT NOT NULL,
      PRIMARY KEY (userId, mission_id),
      FOREIGN KEY(userId) REFERENCES Users(id)
    )`);

    // ScratchcardPools: Manual superadmin assignment of teams to scratchcard types
    db.run(`CREATE TABLE IF NOT EXISTS ScratchcardPools (
      card_type TEXT NOT NULL,
      team_code TEXT NOT NULL,
      PRIMARY KEY(card_type, team_code)
    )`);

    // ScratchcardConfigs: Superadmin configuration for economy (price, win chance, reward)
    db.run(`CREATE TABLE IF NOT EXISTS ScratchcardConfigs (
      card_type TEXT PRIMARY KEY,
      price INTEGER NOT NULL,
      win_chance REAL NOT NULL,
      reward_amount INTEGER NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS scratchcard_packs (
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

    db.run(`CREATE TABLE IF NOT EXISTS scratchcard_pack_teams (
      pack_id INTEGER NOT NULL,
      team_code TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      PRIMARY KEY(pack_id, team_code),
      FOREIGN KEY(pack_id) REFERENCES scratchcard_packs(id) ON DELETE CASCADE
    )`);


    db.run("INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('game_koalaflap_payout_enabled', 'true')");

    db.run('CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON AdminActions(timestamp)');
    db.run('CREATE INDEX IF NOT EXISTS idx_features_status ON FeatureRequests(status)');

    // Phase 3 Migration: Add max_daily_limit to scratchcard_packs
    db.run("ALTER TABLE scratchcard_packs ADD COLUMN max_daily_limit INTEGER DEFAULT 0", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Migration error adding max_daily_limit:", err);
      }
    });

    // Phase 18 Migration: Add is_special to scratchcard_packs
    db.run("ALTER TABLE scratchcard_packs ADD COLUMN is_special BOOLEAN DEFAULT 0", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Migration error adding is_special:", err);
      }
    });

    // Phase 18 Migration: Add type column to FeatureRequests
    db.run("ALTER TABLE FeatureRequests ADD COLUMN type TEXT DEFAULT 'Feature'", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Migration error adding type to FeatureRequests:", err);
      }
    });

    // SpeedcubeTimes: stores cube timer results
    db.run(`CREATE TABLE IF NOT EXISTS SpeedcubeTimes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      note TEXT DEFAULT '',
      scramble TEXT DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);
    db.run("ALTER TABLE SpeedcubeTimes ADD COLUMN scramble TEXT DEFAULT ''", () => { });
    db.run('CREATE INDEX IF NOT EXISTS idx_speedcube_userId ON SpeedcubeTimes(userId)');

    // Scratchcards: stores purchased but not yet claimed cards
    db.run(`CREATE TABLE IF NOT EXISTS Scratchcards (
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
    db.run("ALTER TABLE Scratchcards ADD COLUMN price INTEGER DEFAULT 0", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Migration error adding price to Scratchcards:", err);
      }
    });
    db.run('CREATE INDEX IF NOT EXISTS idx_scratchcards_userId ON Scratchcards(userId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_scratchcards_status ON Scratchcards(status)');

    // AchievementSettings: stores per-achievement multipliers
    db.run(`CREATE TABLE IF NOT EXISTS AchievementSettings (
      achievementId TEXT PRIMARY KEY,
      multiplier REAL DEFAULT 1.0
    )`);

    // --- LEC Rift Defense ---
    db.run(`CREATE TABLE IF NOT EXISTS RiftDefense_Towers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      teamCode TEXT NOT NULL,
      starLevel INTEGER DEFAULT 1,
      rarityTier INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);
    db.run("ALTER TABLE RiftDefense_Towers ADD COLUMN rarityTier INTEGER DEFAULT 0", () => { });
    db.run('CREATE INDEX IF NOT EXISTS idx_riftdefense_userId ON RiftDefense_Towers(userId)');

    db.run(`CREATE TABLE IF NOT EXISTS RiftDefense_Stats (
      userId TEXT PRIMARY KEY,
      highestWave INTEGER DEFAULT 0,
      totalMinionsKilled INTEGER DEFAULT 0,
      totalBossesKilled INTEGER DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // --- LoL Idle Game (Road to Worlds) ---
    db.run(`CREATE TABLE IF NOT EXISTS Idle_Profiles (
      userId TEXT PRIMARY KEY,
      level INTEGER DEFAULT 1,
      hype INTEGER DEFAULT 0,
      dollars INTEGER DEFAULT 1000000,
      last_sync_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      upgrades_json TEXT DEFAULT '{}',
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    db.run("ALTER TABLE Idle_Profiles ADD COLUMN dollars INTEGER DEFAULT 1000000", () => { });

    db.run(`CREATE TABLE IF NOT EXISTS Idle_Inventory (
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
    db.run("ALTER TABLE Idle_Inventory ADD COLUMN role TEXT DEFAULT 'Top'", () => { });
    db.run("ALTER TABLE Idle_Inventory ADD COLUMN level INTEGER DEFAULT 1", () => { });
    db.run("ALTER TABLE Idle_Inventory ADD COLUMN experience INTEGER DEFAULT 0", () => { });
    db.run("ALTER TABLE Idle_Inventory ADD COLUMN rarity TEXT DEFAULT 'Common'", () => { });
    db.run("ALTER TABLE Idle_Inventory ADD COLUMN base_stats INTEGER DEFAULT 10", () => { });

    db.run(`CREATE TABLE IF NOT EXISTS Idle_Roster (
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
    db.run(`CREATE TABLE IF NOT EXISTS ColorSync_Scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      score REAL NOT NULL,
      target_color TEXT NOT NULL,
      guessed_color TEXT NOT NULL,
      mode TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ColorSync_Daily (
      date TEXT PRIMARY KEY,
      target_color TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ColorSync_DailyResults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      score REAL NOT NULL,
      guessed_color TEXT NOT NULL,
      date TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, date),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ColorSync_Lobbies (
      id TEXT PRIMARY KEY,
      creatorId TEXT NOT NULL,
      target_color TEXT NOT NULL,
      status TEXT DEFAULT 'waiting',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(creatorId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ColorSync_LobbyParticipants (
      lobby_id TEXT NOT NULL,
      userId TEXT NOT NULL,
      score REAL,
      guessed_color TEXT,
      submitted_at DATETIME,
      PRIMARY KEY(lobby_id, userId),
      FOREIGN KEY(lobby_id) REFERENCES ColorSync_Lobbies(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    db.run('CREATE INDEX IF NOT EXISTS idx_colorsync_scores_userId ON ColorSync_Scores(userId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_colorsync_lobby_participants_lobbyId ON ColorSync_LobbyParticipants(lobby_id)');

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
      ['admin', 'Admin Panel', '/admin', 'System', 1, 4]
    ];

    defaults.forEach(([key, label, path, category, isVisible, sortOrder]) => {
      db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder) VALUES (?, ?, ?, ?, ?, ?)`,
        [key, label, path, category, isVisible, sortOrder]);
    });

    // Migration: Remove dead friends link and ensure admin link exists
    db.run("DELETE FROM NavbarSettings WHERE key = 'friends'");
    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder) 
            VALUES ('admin', 'Admin Panel', '/admin', 'System', 1, 4)`);

    // Fix: Feature Roadmap path (was /roadmap, should be /features)
    // Removed because it overrides persistence: db.run("UPDATE NavbarSettings SET path = '/features' WHERE key = 'roadmap'");

    // LoL Idle Game Link
    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder) 
            VALUES ('lol-idle', 'Road to Worlds', '/games/lol-idle', 'Games', 1, 1.5)`);

    // Shift other games to make room for 1.5 (or just use REAL if SQLite allows, but it's INTEGER)
    // Actually, SQLite INTEGER can store REAL if needed, but let's be clean.

    // Color Sync Link
    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder) 
            VALUES ('colorsync', 'Color Sync', '/color-sync', 'Games', 1, 6)`);
    // Removed because it overrides persistence: db.run("UPDATE NavbarSettings SET sortOrder = 6 WHERE key = 'colorsync' AND category = 'Games'");

    // Leveling Tracker Link
    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder) 
            VALUES ('leveling-tracker', 'Leveling Tracker', '/leveling', 'Timers', 1, 5)`);

    // Tetris Link
    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder) 
            VALUES ('tetris', 'Tetris', '/tetris', 'Games', 1, 7)`);

    // Polymarket General Link
    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder) 
            VALUES ('polymarket-general', 'Polymarket General', '/polymarket-general', 'Esports', 1, 5)`);

    // Wordle Link
    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder) 
            VALUES ('wordle', 'Wordle', '/wordle', 'Games', 1, 8)`);

    // Tower Climb Link
    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('tower-climb', 'Tower Climb', '/games/tower-climb', 'Games', 1, 9)`);

    // Lotto Imitat Link
    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('lotto', 'Lotto Imitat', '/lotto', 'Games', 1, 10)`);

    // Blackjack Link
    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('blackjack', 'Blackjack', '/games/blackjack', 'Games', 1, 11)`);


    // ─── Leveling Milestones Table ───────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS LevelingMilestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      level INTEGER NOT NULL,
      reachedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, level),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // ─── Pokemon System Tables ───────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS PokemonSettings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`, () => {
      db.run(`INSERT OR IGNORE INTO PokemonSettings (key, value) VALUES ('contrast_threshold', '0.6')`);
    });

    db.run(`CREATE TABLE IF NOT EXISTS PokemonTypeColors (
      type_name TEXT PRIMARY KEY,
      hex_color TEXT NOT NULL
    )`, () => {
      const defaultColors = [
        ['normal', '#A8A878'], ['fire', '#F08030'], ['water', '#6890F0'], ['grass', '#78C850'],
        ['electric', '#F8D030'], ['ice', '#98D8D8'], ['fighting', '#C03028'], ['poison', '#A040A0'],
        ['ground', '#E0C068'], ['flying', '#A890F0'], ['psychic', '#F85888'], ['bug', '#A8B820'],
        ['rock', '#B8A038'], ['ghost', '#705898'], ['dragon', '#7038F8'], ['dark', '#705848'],
        ['steel', '#B8B8D0'], ['fairy', '#EE99AC']
      ];
      defaultColors.forEach(([name, hex]) => {
        db.run(`INSERT OR IGNORE INTO PokemonTypeColors (type_name, hex_color) VALUES (?, ?)`, [name, hex]);
      });
    });

    // ─── MMO Market Prices Table ──────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS MMO_MarketPrices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    itemName TEXT NOT NULL,
    price BIGINT NOT NULL,
    updatedBy TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    isDeleted INTEGER DEFAULT 0
  )`);

    db.run("ALTER TABLE MMO_MarketPrices ADD COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP", (err) => {
      // Ignore duplicate column error if already run
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_market_deleted_name ON MMO_MarketPrices(isDeleted, itemName);`);

    // GlobalGameStats: for fast global tracking of game winnings
    db.run(`CREATE TABLE IF NOT EXISTS GlobalGameStats (
    gameId TEXT PRIMARY KEY,
    totalPayout INTEGER DEFAULT 0,
    totalWins INTEGER DEFAULT 0,
    totalPlayed INTEGER DEFAULT 0
  )`, () => {
      // Migration: Add totalPlayed column if it doesn't exist (Phase 27)
      db.run("ALTER TABLE GlobalGameStats ADD COLUMN totalPlayed INTEGER DEFAULT 0", () => {
        // 1. Migration for Tower Climb
        db.get("SELECT COUNT(*) as count FROM GlobalGameStats WHERE gameId = 'tower-climb'", (err, row) => {
          if (!err && row?.count === 0) {
            db.get("SELECT COUNT(*) as played, SUM(CASE WHEN status = 'cashed_out' THEN 1 ELSE 0 END) as wins, SUM(payout) as payout FROM TowerClimbRounds", (err, stats) => {
              if (!err && stats) {
                db.run("INSERT OR IGNORE INTO GlobalGameStats (gameId, totalPayout, totalWins, totalPlayed) VALUES (?, ?, ?, ?)",
                  ['tower-climb', stats.payout || 0, stats.wins || 0, stats.played || 0], () => {
                    console.log(`[Migration] GlobalGameStats: Initial seed for tower-climb completed (${stats.wins} wins, ${stats.payout} payout, ${stats.played} played)`);
                  });
              }
            });
          }
        });

        // 2. Migration for Scratchcards
        db.get("SELECT COUNT(*) as count FROM GlobalGameStats WHERE gameId = 'scratchcards'", (err, row) => {
          if (!err && row?.count === 0) {
            db.get("SELECT COUNT(*) as played, SUM(winAmount) as payout, SUM(CASE WHEN winAmount > 0 THEN 1 ELSE 0 END) as wins FROM Scratchcards", (statsErr, stats) => {
              if (!statsErr && stats) {
                db.run("INSERT OR IGNORE INTO GlobalGameStats (gameId, totalPayout, totalWins, totalPlayed) VALUES (?, ?, ?, ?)",
                  ['scratchcards', stats.payout || 0, stats.wins || 0, stats.played || 0], () => {
                    console.log(`[Migration] GlobalGameStats: Initial seed for scratchcards completed (${stats.wins} wins, ${stats.payout} payout, ${stats.played} played)`);
                  });
              }
            });
          }
        });

        // 3. Migration for Lotto
        db.get("SELECT COUNT(*) as count FROM GlobalGameStats WHERE gameId = 'lotto'", (err, row) => {
          if (!err && row?.count === 0) {
            db.run("INSERT OR IGNORE INTO GlobalGameStats (gameId, totalPayout, totalWins, totalPlayed) VALUES (?, ?, ?, ?) ",
              ['lotto', 0, 0, 0]);
          }
        });
      });
    });

    // --- Lotto Imitat Tables ---
    db.run(`CREATE TABLE IF NOT EXISTS LottoDrawings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drawDate TEXT NOT NULL UNIQUE,
    numbers TEXT NOT NULL,
    superzahl INTEGER NOT NULL,
    totalTickets INTEGER DEFAULT 0,
    totalWinners INTEGER DEFAULT 0,
    totalPayout INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS LottoTickets (
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

    db.run('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_user ON LottoTickets(userId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_draw ON LottoTickets(drawDate, status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_user_draw ON LottoTickets(userId, drawDate)');

    // --- RSS News Tables ---
    db.run(`CREATE TABLE IF NOT EXISTS RssFeeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    icon TEXT,
    is_default BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, () => {
      // Seed default Tagesschau feed
      db.run(`INSERT OR IGNORE INTO RssFeeds (name, url, icon, is_default) VALUES (?, ?, ?, ?)`,
        ['Tagesschau', 'https://www.tagesschau.de/xml/rss2/', 'https://www.tagesschau.de/favicon.ico', 1]);
    });

    db.run(`CREATE TABLE IF NOT EXISTS RssArticles_Cache (
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

    db.run('CREATE INDEX IF NOT EXISTS idx_rss_articles_feed_date ON RssArticles_Cache(feedId, pubDate DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_rss_feeds_default ON RssFeeds(is_default)');

    db.run(`CREATE TABLE IF NOT EXISTS UserRssPreferences (
    userId TEXT NOT NULL,
    feedId INTEGER NOT NULL,
    showOnSite BOOLEAN DEFAULT 1,
    showInTicker BOOLEAN DEFAULT 0,
    PRIMARY KEY (userId, feedId),
    FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY(feedId) REFERENCES RssFeeds(id) ON DELETE CASCADE
  )`);

    // Migration for UserRssPreferences
    db.run("ALTER TABLE UserRssPreferences ADD COLUMN showOnSite BOOLEAN DEFAULT 1", () => {
      // If we just added it, we want to migrate from isHidden if it existed
      db.all("PRAGMA table_info(UserRssPreferences)", (err, columns) => {
        if (!err && columns.some(c => c.name === 'isHidden')) {
          db.run("UPDATE UserRssPreferences SET showOnSite = 0 WHERE isHidden = 1");
        }
      });
    });
    db.run("ALTER TABLE UserRssPreferences ADD COLUMN showInTicker BOOLEAN DEFAULT 0", () => {
      // Default feeds (Tagesschau etc) should have showInTicker = 1 by default in preferences
      db.run(`
          INSERT OR IGNORE INTO UserRssPreferences (userId, feedId, showOnSite, showInTicker)
          SELECT u.id, f.id, 1, 1
          FROM Users u, RssFeeds f
          WHERE f.is_default = 1
      `);
      // Also update existing preferences for default feeds
      db.run("UPDATE UserRssPreferences SET showInTicker = 1 WHERE feedId IN (SELECT id FROM RssFeeds WHERE is_default = 1)");
    });

    // --- Wordle 2.0 Dictionary ---
    db.run(`CREATE TABLE IF NOT EXISTS wordle_dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      is_used BOOLEAN DEFAULT 0,
      definition TEXT,
      funny_quote TEXT,
      used_at DATETIME
    )`);

    // Signal database is ready
    db.run("SELECT 1", () => {
      console.log('Database initialized and ready.');
      seedWordleDictionary();
    });
  });
}

module.exports = {
  initializeDatabaseSchema
};

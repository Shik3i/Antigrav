const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Determine DB file path: env var for Docker, fallback for local dev
const dbFilePath = process.env.DB_PATH || path.join(__dirname, 'data', 'timerapp.db');

// Ensure parent directory exists
const dbDir = path.dirname(dbFilePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbFilePath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database');
    // Enable WAL mode for better concurrent read/write performance
    db.run('PRAGMA journal_mode=WAL;');
    // Enforce foreign key constraints (SQLite ignores them by default)
    db.run('PRAGMA foreign_keys=ON;');
  }
});

// Initialize tables
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
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES Users(id)
  )`);

  // Migration: Add polymarketTeam to Bets
  db.run("ALTER TABLE Bets ADD COLUMN polymarketTeam TEXT", () => { });
  db.run("ALTER TABLE Bets ADD COLUMN league TEXT", () => { });

  // ErrorLogs: persistent storage for server-side errors
  db.run(`CREATE TABLE IF NOT EXISTS ErrorLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    stack TEXT,
    context TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ─── Performance Indexes ───────────────────────────────────────
  db.run('CREATE INDEX IF NOT EXISTS idx_timer_userId ON TimerEvents(userId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_timer_completedAt ON TimerEvents(completedAt)');
  db.run('CREATE INDEX IF NOT EXISTS idx_koala_tx_userId ON KoalaTransactions(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_countdowns_userId ON Countdowns(userId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_countdowns_visibility ON Countdowns(isPublic, isGlobal)');
  db.run('CREATE INDEX IF NOT EXISTS idx_friends_userId ON Friends(userId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_friends_friendId ON Friends(friendId)');

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

  db.run(`CREATE TABLE IF NOT EXISTS GameScores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    gameId TEXT NOT NULL,
    score INTEGER NOT NULL,
    coinsEarned INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES Users(id)
  )`);

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

  db.run(`CREATE TABLE IF NOT EXISTS Changelog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    date TEXT NOT NULL,
    changes TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
  )`);
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

  // --- NavbarSettings ---
  db.run(`CREATE TABLE IF NOT EXISTS NavbarSettings (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    path TEXT NOT NULL,
    category TEXT DEFAULT 'Other',
    isVisible BOOLEAN DEFAULT 1,
    sortOrder INTEGER DEFAULT 0
  )`, () => {
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
    db.run("UPDATE NavbarSettings SET path = '/features' WHERE key = 'roadmap'");
  });
});

// Speedcube Helpers
const addSpeedcubeTime = (userId, time_ms, note = '') => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO SpeedcubeTimes (userId, time_ms, note) VALUES (?, ?, ?)', [userId, time_ms, note], function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, userId, time_ms, note, createdAt: new Date().toISOString() });
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
const addUser = (id, displayName) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO Users (id, displayName) VALUES (?, ?)', [id, displayName], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateUserName = (id, displayName) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Users SET displayName = ? WHERE id = ?', [displayName, id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getUser = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const registerUser = (id, displayName, username, passwordHash) => {
  return new Promise((resolve, reject) => {
    getKoalaBaseline().then(settings => {
      const startingCoins = settings.koala_start_coins !== undefined ? settings.koala_start_coins : 10000;
      db.run(
        'INSERT INTO Users (id, displayName, username, password_hash, preferences, koala_balance) VALUES (?, ?, ?, ?, ?, ?)',
        [id, displayName, username, passwordHash, '{}', startingCoins],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    }).catch(reject);
  });
};

const getUserByUsername = (username) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Users WHERE username = ? COLLATE NOCASE', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getAllRegisteredUsers = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        u.id, 
        u.displayName, 
        u.username, 
        u.is_superadmin, 
        u.createdAt, 
        u.lastActive,
        CAST(u.koala_balance AS INTEGER) AS koala_balance,
        CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END as is_banned
      FROM Users u
      LEFT JOIN BannedUsers b ON u.id = b.id
      WHERE u.username IS NOT NULL 
      ORDER BY u.createdAt DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve((rows || []).map(r => ({ ...r, koala_balance: Number(r.koala_balance || 0) })));
    });
  });
};

const updateUserLastActive = (id) => {
  return new Promise((resolve, reject) => {
    db.run("UPDATE Users SET lastActive = CURRENT_TIMESTAMP WHERE id = ?", [id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateUserPreferences = (id, preferences) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Users SET preferences = ? WHERE id = ?', [JSON.stringify(preferences), id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateUserPassword = (id, newPasswordHash) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Users SET password_hash = ? WHERE id = ?', [newPasswordHash, id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const updateUserRole = (id, isSuperadmin) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Users SET is_superadmin = ? WHERE id = ?', [isSuperadmin ? 1 : 0, id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const addRoom = (id, name, isPublic, defaultDurationMinutes, ownerId, defaultRole = 'read', visibleToFriends = false) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO Rooms (id, name, isPublic, defaultDurationMinutes, ownerId, defaultRole, visibleToFriends) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, isPublic, defaultDurationMinutes, ownerId, defaultRole, visibleToFriends ? 1 : 0], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
  });
};

const getRoom = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Rooms WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const recordTimerCompletion = (userId, roomId, roomName, durationMinutes) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO TimerEvents (userId, roomId, roomName, durationMinutes) VALUES (?, ?, ?, ?)', [userId, roomId, roomName || 'Unknown Room', durationMinutes || 0], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

const getHighscores = (limit = 10) => {
  return new Promise((resolve, reject) => {
    // 1. Top Users by total focus time (hours), also returning session count
    const queryUsers = `
      SELECT u.id, u.username, u.displayName, u.preferences,
        ROUND(SUM(CASE WHEN te.durationMinutes IS NULL OR te.durationMinutes = '' THEN 20 ELSE te.durationMinutes END) / 60.0, 1) as totalCompleted,
        COUNT(te.id) as sessionCount
      FROM Users u
      JOIN TimerEvents te ON u.id = te.userId
      GROUP BY u.id
      ORDER BY totalCompleted DESC
      LIMIT ?
    `;

    // 2. Completions by Weekday (0 = Sunday, 1 = Monday, etc.)
    const queryWeekday = `
      SELECT strftime('%w', completedAt) as dayOfWeek, 
      ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) as count,
      COUNT(id) as sessions
      FROM TimerEvents
      GROUP BY dayOfWeek
      ORDER BY dayOfWeek ASC
    `;

    // 3. Completions by Hour of Day (00-23)
    const queryHour = `
      SELECT strftime('%H', completedAt) as hourOfDay, 
      ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) as count,
      COUNT(id) as sessions
      FROM TimerEvents
      GROUP BY hourOfDay
      ORDER BY hourOfDay ASC
    `;

    // 4. Completions by Month (01-12)
    const queryMonth = `
      SELECT strftime('%m', completedAt) as monthOfYear, 
      ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) as count,
      COUNT(id) as sessions
      FROM TimerEvents
      GROUP BY monthOfYear
      ORDER BY monthOfYear ASC
    `;

    // Execute queries in parallel using Promise.all
    Promise.all([
      new Promise((res, rej) => db.all(queryUsers, [limit], (err, rows) => err ? rej(err) : res(rows))),
      new Promise((res, rej) => db.all(queryWeekday, [], (err, rows) => err ? rej(err) : res(rows))),
      new Promise((res, rej) => db.all(queryHour, [], (err, rows) => err ? rej(err) : res(rows))),
      new Promise((res, rej) => db.all(queryMonth, [], (err, rows) => err ? rej(err) : res(rows)))
    ])
      .then(([topUsers, byWeekday, byHour, byMonth]) => {
        resolve({
          topUsers,
          stats: {
            byWeekday: byWeekday.map(row => ({ label: getWeekdayName(row.dayOfWeek), count: row.count, sessions: row.sessions })),
            byHour: byHour.map(row => ({ label: `${row.hourOfDay}:00`, count: row.count, sessions: row.sessions })),
            byMonth: byMonth.map(row => ({ label: getMonthName(row.monthOfYear), count: row.count, sessions: row.sessions }))
          }
        });
      })
      .catch(reject);
  });
};

const getActivityHistory = (days = 30) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        date(completedAt) as date,
        ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) as count,
        COUNT(id) as sessions
      FROM TimerEvents
      WHERE completedAt >= date('now', '-' || ? || ' days')
      GROUP BY date
      ORDER BY date ASC
    `;

    db.all(query, [days], (err, rows) => {
      if (err) return reject(err);

      // Backfill missing days
      const result = [];
      const today = new Date();
      for (let i = days; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const existing = (rows || []).find(r => r.date === dateStr);
        result.push({
          label: dateStr,
          count: existing ? existing.count : 0,
          sessions: existing ? existing.sessions : 0
        });
      }
      resolve(result);
    });
  });
};

const getTopUsersByCoins = (limit = 10) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT id as userId, username, displayName, preferences, koala_balance FROM Users WHERE koala_balance > 0 ORDER BY koala_balance DESC LIMIT ?`, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Helpers for stats labels
function getWeekdayName(dayStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[parseInt(dayStr, 10)] || dayStr;
}

function getMonthName(monthStr) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[parseInt(monthStr, 10) - 1] || monthStr;
}

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
    // Get both accepted friends and pending requests involving this user
    // userId is the requester, friendId is the target
    const query = `
      SELECT 
        f.status, 
        f.userId as requesterId, 
        f.friendId as targetId,
        u.id as id,
        u.displayName,
        u.username
      FROM Friends f
      JOIN Users u ON (u.id = f.friendId AND f.userId = ?) OR (u.id = f.userId AND f.friendId = ?)
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
    // Get both accepted friends and pending requests involving this user
    // bypassing the user auth check for the superadmin
    const query = `
      SELECT 
        f.status, 
        f.userId as requesterId, 
        f.friendId as targetId,
        u.id as id,
        u.displayName,
        u.username
      FROM Friends f
      JOIN Users u ON (u.id = f.friendId AND f.userId = ?) OR (u.id = f.userId AND f.friendId = ?)
    `;
    db.all(query, [userId, userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// ─── Guest Account Merge ─────────────────────────────────────────

const mergeGuestStats = (newUserId, targetUsername) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Find all guest accounts that have this username (either exactly or as _guest_xyz...)
      // But only if they were actually guests (password_hash is null)
      const guestQuery = `SELECT id FROM Users WHERE (username = ? OR username LIKE ? OR displayName = ?) AND password_hash IS NULL`;

      db.all(guestQuery, [targetUsername, `_guest_%_${targetUsername}`, targetUsername], (err, guestRows) => {
        if (err) return reject(err);
        if (!guestRows || guestRows.length === 0) return resolve(0);

        const guestIds = guestRows.map(r => r.id);
        const placeholders = guestIds.map(() => '?').join(',');

        // 1. Move all timer completions from those guests to the newly registered user
        db.run(`UPDATE TimerEvents SET userId = ? WHERE userId IN (${placeholders})`, [newUserId, ...guestIds], function (updateErr) {
          if (updateErr) return reject(updateErr);

          // 2. Move all private countdowns from those guests to the newly registered user
          db.run(`UPDATE Countdowns SET userId = ? WHERE userId IN (${placeholders})`, [newUserId, ...guestIds], function (countErr) {
            if (countErr) return reject(countErr);

            // 3. Delete the old guest accounts so they don't clutter the highscores
            db.run(`DELETE FROM Users WHERE id IN (${placeholders})`, [...guestIds], function (delErr) {
              if (delErr) return reject(delErr);
              resolve(guestIds.length);
            });
          });
        });
      });
    });
  });
};

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
const getAllTimerCompletions = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT te.id, te.completedAt, u.displayName as userName, 
             te.roomName, 
             te.durationMinutes as defaultDurationMinutes
      FROM TimerEvents te
      LEFT JOIN Users u ON te.userId = u.id
      ORDER BY te.completedAt DESC
      LIMIT 100
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const deleteTimerCompletion = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM TimerEvents WHERE id = ?', [id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getAllRoomsAdmin = () => {
  return new Promise((resolve, reject) => {
    // Rooms are now exclusively in RAM (roomManager.js).
    // The Admin panel should fetch active rooms via socket events that tap into roomManager.
    resolve([]); 
  });
};

const deleteRoomAdmin = (id) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Delete associated timer events from history
      db.run('DELETE FROM TimerEvents WHERE roomId = ?', [id], function (err) {
        if (err) console.error("Error deleting timer events for room", id, err);
      });
      // 2. Room removal itself happens in roomManager for RAM rooms.
      // Database record no longer exists.
      resolve(1);
    });
  });
};

const deleteUserAdmin = (id) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Delete friends relationships involving this user
      db.run('DELETE FROM Friends WHERE userId = ? OR friendId = ?', [id, id], function (err) {
        if (err) console.error("Error deleting friend links for user", id, err);
      });
      // 2. Delete timer events for this user
      db.run('DELETE FROM TimerEvents WHERE userId = ?', [id], function (err) {
        if (err) console.error("Error deleting timer events for user", id, err);
      });
      // 3. User deletion no longer needs to clean up the Rooms DB table
      // 4. Finally delete the user
      db.run('DELETE FROM Users WHERE id = ?', [id], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  });
};

// ─── Banning System ────────────────────────────────────────────────
const banUser = (userId, username, reason) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO BannedUsers (userId, username, reason) VALUES (?, ?, ?)', [userId, username, reason || null], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const unbanUser = (userId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM BannedUsers WHERE userId = ?', [userId], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const checkIsBanned = (username) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM BannedUsers WHERE username = ? COLLATE NOCASE', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getBannedUsersList = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM BannedUsers ORDER BY bannedAt DESC', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

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
const getKoalaBaseline = () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT key, value FROM ServerSettings WHERE key IN ('koala_points_per_hour', 'koala_start_coins', 'koala_coin_conversion_rate', 'koala_daily_mission_multiplier', 'achievement_reward_multiplier')`, (err, rows) => {
      if (err) reject(err);
      else {
        const settings = { koala_points_per_hour: 1000, koala_start_coins: 10000, koala_coin_conversion_rate: 0.01, koala_daily_mission_multiplier: 1.0, achievement_reward_multiplier: 2.5 };
        if (rows) {
          rows.forEach(r => {
            if (r.key === 'koala_coin_conversion_rate' || r.key === 'koala_daily_mission_multiplier' || r.key === 'achievement_reward_multiplier') settings[r.key] = parseFloat(r.value);
            else settings[r.key] = parseInt(r.value, 10);
          });
        }
        resolve(settings);
      }
    });
  });
};

const updateKoalaBaseline = (settings) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (settings.koala_points_per_hour !== undefined) {
        await new Promise((res, rej) => db.run(`UPDATE ServerSettings SET value = ? WHERE key = 'koala_points_per_hour'`, [String(settings.koala_points_per_hour)], err => err ? rej(err) : res()));
      }
      if (settings.koala_start_coins !== undefined) {
        await new Promise((res, rej) => db.run(`INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('koala_start_coins', ?)`, [String(settings.koala_start_coins)], err => err ? rej(err) : res()));
      }
      if (settings.koala_coin_conversion_rate !== undefined) {
        await new Promise((res, rej) => db.run(`INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('koala_coin_conversion_rate', ?)`, [String(settings.koala_coin_conversion_rate)], err => err ? rej(err) : res()));
      }
      if (settings.koala_daily_mission_multiplier !== undefined) {
        await new Promise((res, rej) => db.run(`INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('koala_daily_mission_multiplier', ?)`, [String(settings.koala_daily_mission_multiplier)], err => err ? rej(err) : res()));
      }
      if (settings.achievement_reward_multiplier !== undefined) {
        await new Promise((res, rej) => db.run(`INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('achievement_reward_multiplier', ?)`, [String(settings.achievement_reward_multiplier)], err => err ? rej(err) : res()));
      }
      resolve(true);
    } catch (e) {
      reject(e);
    }
  });
};

const addKoalaCoins = (userId, amountCents, reason) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(`UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?`, [amountCents, userId], function (err) {
        if (err) {
          logError(`addKoalaCoins: Update user failed: ${err.message}`, err.stack, JSON.stringify({ userId, amountCents, reason }));
          return db.run('ROLLBACK', () => reject(err));
        }
      });
      db.run(`INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)`, [userId, amountCents, reason], function (err) {
        if (err) {
          logError(`addKoalaCoins: Insert transaction failed: ${err.message}`, err.stack, JSON.stringify({ userId, amountCents, reason }));
          return db.run('ROLLBACK', () => reject(err));
        }
      });
      db.run('COMMIT', (err) => {
        if (err) {
          logError(`addKoalaCoins: Commit failed: ${err.message}`, err.stack, JSON.stringify({ userId, amountCents, reason }));
          return reject(err);
        }
        // Return the new balance as a plain JS Number
        db.get(`SELECT CAST(koala_balance AS INTEGER) AS koala_balance FROM Users WHERE id = ?`, [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row ? Number(row.koala_balance) : 0);
        });
      });
    });
  });
};

const getKoalaTransactions = (userId, limit = 5) => {
  return new Promise((resolve, reject) => {
    const query = limit > 0 
      ? `SELECT id, amount, reason, created_at FROM KoalaTransactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
      : `SELECT id, amount, reason, created_at FROM KoalaTransactions WHERE user_id = ? ORDER BY created_at DESC`;
    const params = limit > 0 ? [userId, limit] : [userId];
    
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
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

const logError = (message, stack = null, context = null) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO ErrorLogs (message, stack, context) VALUES (?, ?, ?)', [message, stack, context], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

const getErrorLogs = (limit = 100) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ErrorLogs ORDER BY timestamp DESC LIMIT ?', [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const deleteErrorLog = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM ErrorLogs WHERE id = ?', [id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const clearErrorLogs = () => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM ErrorLogs', function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

// ─── Bets ──────────────────────────────────────────────
const createBet = (userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate, league) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO Bets (userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate, league) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate, league],
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

const getUserUpgrades = (userId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM UserUpgrades WHERE userId = ?', [userId], (err, rows) => {
      if (err) {
        logError(`getUserUpgrades failed: ${err.message}`, err.stack, userId);
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
      SELECT u.displayName, u.username, u.preferences, u.id as userId, SUM(gs.coinsEarned) as totalEarned
      FROM GameScores gs
      JOIN Users u ON gs.userId = u.id
      WHERE gs.gameId = ?
      GROUP BY gs.userId
      ORDER BY totalEarned DESC
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

function checkDailyMission(userId, missionId) {
  const today = new Date().toISOString().split('T')[0];
  return new Promise((resolve, reject) => {
    db.get('SELECT last_completed_at FROM UserMissions WHERE userId = ? AND mission_id = ?', [userId, missionId], (err, row) => {
      if (err) return reject(err);
      // Use startsWith to handle both 'YYYY-MM-DD' and 'YYYY-MM-DD HH:MM:SS' formats
      if (row && row.last_completed_at && row.last_completed_at.startsWith(today)) resolve(true);
      else resolve(false);
    });
  });
}

function completeDailyMission(userId, missionId, rewardCents) {
  const today = new Date().toISOString().split('T')[0];
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run('INSERT INTO UserMissions (userId, mission_id, last_completed_at) VALUES (?, ?, ?) ON CONFLICT(userId, mission_id) DO UPDATE SET last_completed_at = ?', 
        [userId, missionId, today, today], (err) => {
        if (err) return db.run('ROLLBACK', () => reject(err));
        
        db.run('UPDATE Users SET koala_balance = koala_balance + ? WHERE id = ?', [rewardCents, userId], (err) => {
          if (err) return db.run('ROLLBACK', () => reject(err));
          
          db.run('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)', 
            [userId, rewardCents, `Daily Mission: ${missionId}`], (err) => {
            if (err) return db.run('ROLLBACK', () => reject(err));
            
            db.run('COMMIT', (err) => err ? reject(err) : resolve());
          });
        });
      });
    });
  });
}

function getChangelog() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Changelog ORDER BY createdAt DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function addChangelogEntry(version, date, changes) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO Changelog (version, date, changes) VALUES (?, ?, ?)', [version, date, changes], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

function updateChangelogEntry(id, version, date, changes) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Changelog SET version = ?, date = ?, changes = ? WHERE id = ?', [version, date, changes, id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

function deleteChangelogEntry(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM Changelog WHERE id = ?', [id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

// ─── Achievements & Daily Bonus ────────────────────────────────
const getUserAchievements = (userId) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT achievementId, claimedAt FROM UserAchievements WHERE userId = ?`, [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const claimAchievement = (userId, achievementId) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO UserAchievements (userId, achievementId) VALUES (?, ?)`, [userId, achievementId], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

const updateDailyClaimTime = (userId) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE Users SET last_daily_claim = CURRENT_TIMESTAMP WHERE id = ?`, [userId], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const getUserTimerCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM TimerEvents WHERE userId = ?`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });
};

const getUserDailyClaim = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT last_daily_claim FROM Users WHERE id = ?`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.last_daily_claim : null);
    });
  });
};

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

// ─── Special Achievement Queries ─────────────────────────────
const hasEarlyBirdTimer = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as c FROM TimerEvents WHERE userId = ? AND CAST(strftime('%H', completedAt) AS INTEGER) BETWEEN 5 AND 7`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row && row.c > 0 ? 1 : 0);
    });
  });
};

const hasNightOwlTimer = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as c FROM TimerEvents WHERE userId = ? AND CAST(strftime('%H', completedAt) AS INTEGER) BETWEEN 0 AND 3`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row && row.c > 0 ? 1 : 0);
    });
  });
};

const hasWeekendWarrior = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT COUNT(*) as c FROM (
        SELECT strftime('%Y-%W', completedAt) as yw
        FROM TimerEvents
        WHERE userId = ?
        GROUP BY yw
        HAVING SUM(CASE WHEN strftime('%w', completedAt) = '6' THEN 1 ELSE 0 END) > 0
           AND SUM(CASE WHEN strftime('%w', completedAt) = '0' THEN 1 ELSE 0 END) > 0
      )
    `, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row && row.c > 0 ? 1 : 0);
    });
  });
};

const getUserBalance = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT koala_balance FROM Users WHERE id = ?`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.koala_balance : 0);
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

const getAchievementSettings = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM AchievementSettings', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const updateAchievementSetting = (achievementId, multiplier) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR REPLACE INTO AchievementSettings (achievementId, multiplier) VALUES (?, ?)', [achievementId, multiplier], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const getGlobalScratchcardStats = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as total_sold, SUM(winAmount) as total_won FROM Scratchcards', [], (err, row) => {
      if (err) reject(err);
      else resolve({
        total_sold: row?.total_sold || 0,
        total_won: row?.total_won || 0
      });
    });
  });
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

module.exports = {
  db,
  getGlobalScratchcardStats,
  getLatestScratchcardWinners,
  getUserDailyPackCount,
  purchaseScratchcardTransaction,
  addUser,
  updateUserName,
  getUser,
  addRoom,
  getRoom,
  recordTimerCompletion,
  getHighscores,
  getActivityHistory,
  getTopUsersByCoins,
  mergeGuestStats,
  getTeamMappings,
  getTeamMapping,
  addTeamMapping,
  deleteTeamMapping,
  getAllTimerCompletions,
  deleteTimerCompletion,
  getAllRoomsAdmin,
  deleteRoomAdmin,
  registerUser,
  getUserByUsername,
  getAllRegisteredUsers,
  updateUserPreferences,
  updateUserRole,
  updateUserPassword,
  updateUserLastActive,
  addFriend,
  removeFriend,
  getFriends,
  getFriendStatus,
  getAdminFriends,
  deleteUserAdmin,
  banUser,
  unbanUser,
  checkIsBanned,
  getBannedUsersList,
  upsertEsportsTeams,
  getAllEsportsTeams,
  getEsportsTeamsLastUpdated,
  getKoalaBaseline,
  updateKoalaBaseline,
  addKoalaCoins,
  getKoalaTransactions,
  getCountdowns,
  createCountdown,
  deleteCountdown,
  getCountdownById,
  logError,
  getErrorLogs,
  deleteErrorLog,
  clearErrorLogs,
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
  getGameUpgradesConfig,
  getUserUpgrades,
  purchaseUpgrade,
  getUserAchievements,
  claimAchievement,
  updateDailyClaimTime,
  getUserTimerCount,
  getUserDailyClaim,
  getUserWonMatchCount,
  getUserGameRoundCount,
  getAdminGameScores,
  deleteGameScore,
  checkDailyMission,
  completeDailyMission,
  getChangelog,
  addChangelogEntry,
  updateChangelogEntry,
  deleteChangelogEntry,
  addSpeedcubeTime,
  getSpeedcubeTimes,
  updateSpeedcubeNote,
  deleteSpeedcubeTime,
  hasEarlyBirdTimer,
  hasNightOwlTimer,
  hasWeekendWarrior,
  getUserBalance,
  hasUnderdogWin,
  hasLoyalFanWin,
  getUserVoteCount,
  getUserZeroScoreStreak,
  getAchievementSettings,
  updateAchievementSetting,
  getUserFeatureRequestCount,
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
        let completed = 0;
        let hasError = false;

        if (settings.length === 0) {
          db.run('COMMIT');
          return resolve();
        }

        settings.forEach(item => {
          db.run(
            'UPDATE NavbarSettings SET isVisible = ?, sortOrder = ? WHERE key = ?',
            [item.isVisible ? 1 : 0, item.sortOrder, item.key],
            (err) => {
              if (err) hasError = true;
              completed++;
              if (completed === settings.length) {
                if (hasError) {
                  db.run('ROLLBACK');
                  reject(new Error('Failed to update some navbar settings'));
                } else {
                  db.run('COMMIT');
                  resolve();
                }
              }
            }
          );
        });
      });
    });
  }
};

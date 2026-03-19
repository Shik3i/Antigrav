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

  // ServerSettings: stores global app configurations
  db.run(`CREATE TABLE IF NOT EXISTS ServerSettings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`, () => {
    // Insert default koala baseline
    db.run(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_points_per_hour', '100')`);
    db.run(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_start_coins', '10000')`);
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

  db.run(`CREATE TABLE IF NOT EXISTS FeatureVotes (
    requestId INTEGER NOT NULL,
    userId TEXT NOT NULL,
    value INTEGER NOT NULL,
    PRIMARY KEY (requestId, userId),
    FOREIGN KEY(requestId) REFERENCES FeatureRequests(id) ON DELETE CASCADE
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON AdminActions(timestamp)');
  db.run('CREATE INDEX IF NOT EXISTS idx_features_status ON FeatureRequests(status)');
});

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
      SELECT u.displayName, 
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
    db.all(`SELECT id, displayName, koala_balance FROM Users WHERE koala_balance > 0 ORDER BY koala_balance DESC LIMIT ?`, [limit], (err, rows) => {
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
    db.all(`SELECT key, value FROM ServerSettings WHERE key IN ('koala_points_per_hour', 'koala_start_coins')`, (err, rows) => {
      if (err) reject(err);
      else {
        const settings = { koala_points_per_hour: 10000, koala_start_coins: 10000 };
        if (rows) {
          rows.forEach(r => settings[r.key] = parseInt(r.value, 10));
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
        if (err) return db.run('ROLLBACK', () => reject(err));
      });
      db.run(`INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)`, [userId, amountCents, reason], function (err) {
        if (err) return db.run('ROLLBACK', () => reject(err));
      });
      db.run('COMMIT', () => {
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
const createBet = (userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO Bets (userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
};

const getUserBets = (userId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Bets WHERE userId = ? ORDER BY createdAt DESC', [userId], (err, rows) => {
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
      AND datetime(eventDate) <= datetime('now', '-3 hours')
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
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
      SELECT b.*, u.displayName as userName
      FROM Bets b
      LEFT JOIN Users u ON b.userId = u.id
      WHERE b.createdAt >= datetime('now', '-' || ? || ' days')
      ORDER BY b.createdAt DESC
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
const createFeatureRequest = (userId, userName, title, description) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO FeatureRequests (userId, userName, title, description) VALUES (?, ?, ?, ?)',
      [userId, userName, title, description],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
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

module.exports = {
  db,
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
  updateBetStatus,
  getAllBetsAdmin,
  getRecentBets,
  updateBetStatusAdmin,
  logAdminAction,
  getAdminActions,
  createFeatureRequest,
  getFeatureRequests,
  voteFeatureRequest,
  updateFeatureStatus,
  updateFeatureAdminComment,
  deleteFeatureRequest,
  getBettingAccuracyLeaderboard
};

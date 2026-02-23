const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbPath = path.resolve(__dirname, 'data');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath);
}

const db = new sqlite3.Database(path.join(dbPath, 'timerapp.db'), (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Initialize tables
db.serialize(() => {
  // Users: stores local identity name
  db.run(`CREATE TABLE IF NOT EXISTS Users (
    id TEXT PRIMARY KEY,
    displayName TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Rooms: stores persistent room configs
  db.run(`CREATE TABLE IF NOT EXISTS Rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    isPublic BOOLEAN DEFAULT 1,
    defaultRole TEXT DEFAULT 'read',
    defaultDurationMinutes INTEGER DEFAULT 20,
    ownerId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ownerId) REFERENCES Users(id)
  )`);

  // Migration: Add defaultRole if it doesn't exist (for existing databases)
  db.run("ALTER TABLE Rooms ADD COLUMN defaultRole TEXT DEFAULT 'read'", (err) => {
    // Ignore error if column already exists
  });

  // TimerEvents: stores history of completed timers for stats
  db.run(`CREATE TABLE IF NOT EXISTS TimerEvents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    roomId TEXT,
    completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES Users(id),
    FOREIGN KEY(roomId) REFERENCES Rooms(id)
  )`);
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

const addRoom = (id, name, isPublic, defaultDurationMinutes, ownerId, defaultRole = 'read') => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO Rooms (id, name, isPublic, defaultDurationMinutes, ownerId, defaultRole) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, isPublic, defaultDurationMinutes, ownerId, defaultRole], function (err) {
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

const recordTimerCompletion = (userId, roomId) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO TimerEvents (userId, roomId) VALUES (?, ?)', [userId, roomId], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

const getHighscores = (limit = 10) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT u.displayName, COUNT(te.id) as totalCompleted
      FROM Users u
      JOIN TimerEvents te ON u.id = te.userId
      GROUP BY u.id
      ORDER BY totalCompleted DESC
      LIMIT ?
    `;
    db.all(query, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
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
  getHighscores
};

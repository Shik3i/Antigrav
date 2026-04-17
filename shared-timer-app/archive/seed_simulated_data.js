const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Use the same DB path logic as database.js
const dbFilePath = process.env.DB_PATH || path.join(__dirname, 'data', 'timerapp.db');

const db = new sqlite3.Database(dbFilePath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database for seeding.');
});

const testUserId = 'TestSimUser';
const testDisplayName = 'Simulated User';

const seedData = async () => {
  try {
    // 1. Ensure test user exists
    await new Promise((resolve, reject) => {
      db.run('INSERT OR IGNORE INTO Users (id, displayName) VALUES (?, ?)', [testUserId, testDisplayName], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 2. Clear old test data for this user to have a clean slate
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM TimerEvents WHERE userId = ?', [testUserId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`Seeding data for ${testDisplayName}...`);

    const sessions = [
      { mins: 5, daysAgo: 0 },   // Today
      { mins: 15, daysAgo: 0 },  // Today
      { mins: 60, daysAgo: 0 },  // Today (Total today: 80 mins = 1.33h)
      { mins: 30, daysAgo: 1 },  // Yesterday
      { mins: 45, daysAgo: 2 },  // 2 days ago
      { mins: 0.5, daysAgo: 0 }, // 30 seconds today (test fractional)
      { mins: 120, daysAgo: 3 }, // 3 days ago (2 hours)
    ];

    for (const session of sessions) {
      const date = new Date();
      date.setDate(date.getDate() - session.daysAgo);
      const timestamp = date.toISOString().replace('T', ' ').replace('Z', '');

      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO TimerEvents (userId, roomId, roomName, durationMinutes, completedAt) VALUES (?, ?, ?, ?, ?)',
          [testUserId, 'test-room', 'Simulated Room', session.mins, timestamp],
          (err) => {
            if (err) reject(err);
            else {
              console.log(`Inserted ${session.mins}m session for ${timestamp}`);
              resolve();
            }
          }
        );
      });
    }

    console.log('Seeding completed successfully!');
    db.close();
  } catch (err) {
    console.error('Error during seeding:', err);
    db.close();
  }
};

seedData();

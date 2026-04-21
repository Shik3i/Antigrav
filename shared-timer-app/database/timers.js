const db = require('./connection');

/**
 * Timers and Rooms Domain
 */

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
    const queryUsers = `
      SELECT u.id, u.username, u.displayName, u.preferences,
        te.totalCompleted,
        te.sessionCount
      FROM (
        SELECT
          userId,
          ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) as totalCompleted,
          COUNT(id) as sessionCount
        FROM TimerEvents
        GROUP BY userId
      ) te
      JOIN Users u ON u.id = te.userId
      ORDER BY te.totalCompleted DESC
      LIMIT ?
    `;

    const queryWeekday = `
      SELECT strftime('%w', completedAt) as dayOfWeek, 
      ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) as count,
      COUNT(id) as sessions
      FROM TimerEvents
      GROUP BY dayOfWeek
      ORDER BY dayOfWeek ASC
    `;

    const queryHour = `
      SELECT strftime('%H', completedAt) as hourOfDay, 
      ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) as count,
      COUNT(id) as sessions
      FROM TimerEvents
      GROUP BY hourOfDay
      ORDER BY hourOfDay ASC
    `;

    const queryMonth = `
      SELECT strftime('%m', completedAt) as monthOfYear, 
      ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) as count,
      COUNT(id) as sessions
      FROM TimerEvents
      GROUP BY monthOfYear
      ORDER BY monthOfYear ASC
    `;

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

const getAllTimerCompletions = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT te.*, u.displayName, u.username FROM TimerEvents te JOIN Users u ON te.userId = u.id ORDER BY te.completedAt DESC', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
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
    db.all('SELECT * FROM Rooms ORDER BY createdAt DESC', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const deleteRoomAdmin = (id) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM Rooms WHERE id = ?', [id]);
      db.run('DELETE FROM TimerEvents WHERE roomId = ?', [id], function (err) {
        if (err) console.error("Error deleting timer events for room", id, err);
      });
      resolve(1);
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
    db.get(`SELECT COUNT(*) as c FROM TimerEvents WHERE userId = ? AND (CAST(strftime('%H', completedAt) AS INTEGER) >= 23 OR CAST(strftime('%H', completedAt) AS INTEGER) < 4)`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row && row.c > 0 ? 1 : 0);
    });
  });
};

const hasWeekendWarrior = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as c FROM TimerEvents WHERE userId = ? AND CAST(strftime('%w', completedAt) AS INTEGER) IN (0, 6)`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row && row.c > 0 ? 1 : 0);
    });
  });
};

/**
 * Helpers
 */
function getWeekdayName(dayStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[parseInt(dayStr, 10)] || dayStr;
}

function getMonthName(monthStr) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[parseInt(monthStr, 10) - 1] || monthStr;
}

module.exports = {
  addRoom,
  getRoom,
  recordTimerCompletion,
  getHighscores,
  getActivityHistory,
  getAllTimerCompletions,
  deleteTimerCompletion,
  getAllRoomsAdmin,
  deleteRoomAdmin,
  getUserTimerCount,
  hasEarlyBirdTimer,
  hasNightOwlTimer,
  hasWeekendWarrior
};

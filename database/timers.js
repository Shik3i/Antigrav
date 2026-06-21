const db = require('./connection');

function hasRoomsTable() {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'Rooms'").get());
}

async function addRoom(id, name, isPublic, defaultDurationMinutes, ownerId, defaultRole = 'read', visibleToFriends = false) {
  if (!hasRoomsTable()) return 0;
  const result = db.prepare(`
    INSERT OR IGNORE INTO Rooms
      (id, name, isPublic, defaultDurationMinutes, ownerId, defaultRole, visibleToFriends)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, isPublic, defaultDurationMinutes, ownerId, defaultRole, visibleToFriends ? 1 : 0);
  return Number(result.changes);
}

async function getRoom(id) {
  if (!hasRoomsTable()) return undefined;
  return db.prepare('SELECT * FROM Rooms WHERE id = ?').get(id);
}

async function recordTimerCompletion(userId, roomId, roomName, durationMinutes) {
  const result = db.prepare(`
    INSERT INTO TimerEvents (userId, roomId, roomName, durationMinutes) VALUES (?, ?, ?, ?)
  `).run(userId, roomId, roomName || 'Unknown Room', durationMinutes || 0);
  return Number(result.lastInsertRowid);
}

async function getHighscores(limit = 10) {
  const topUsers = db.prepare(`
    SELECT u.id, u.username, u.displayName, u.preferences,
      te.totalCompleted, te.sessionCount
    FROM (
      SELECT userId,
        ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) AS totalCompleted,
        COUNT(id) AS sessionCount
      FROM TimerEvents
      GROUP BY userId
    ) te
    JOIN Users u ON u.id = te.userId
    ORDER BY te.totalCompleted DESC
    LIMIT ?
  `).all(limit);
  const byWeekday = db.prepare(`
    SELECT strftime('%w', completedAt) AS dayOfWeek,
      ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) AS count,
      COUNT(id) AS sessions
    FROM TimerEvents GROUP BY dayOfWeek ORDER BY dayOfWeek ASC
  `).all();
  const byHour = db.prepare(`
    SELECT strftime('%H', completedAt) AS hourOfDay,
      ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) AS count,
      COUNT(id) AS sessions
    FROM TimerEvents GROUP BY hourOfDay ORDER BY hourOfDay ASC
  `).all();
  const byMonth = db.prepare(`
    SELECT strftime('%m', completedAt) AS monthOfYear,
      ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) AS count,
      COUNT(id) AS sessions
    FROM TimerEvents GROUP BY monthOfYear ORDER BY monthOfYear ASC
  `).all();

  return {
    topUsers,
    stats: {
      byWeekday: byWeekday.map((row) => ({ label: getWeekdayName(row.dayOfWeek), count: row.count, sessions: row.sessions })),
      byHour: byHour.map((row) => ({ label: `${row.hourOfDay}:00`, count: row.count, sessions: row.sessions })),
      byMonth: byMonth.map((row) => ({ label: getMonthName(row.monthOfYear), count: row.count, sessions: row.sessions }))
    }
  };
}

async function getActivityHistory(days = 30) {
  const rows = db.prepare(`
    SELECT date(completedAt) AS date,
      ROUND(SUM(CASE WHEN durationMinutes IS NULL OR durationMinutes = '' THEN 20 ELSE durationMinutes END) / 60.0, 1) AS count,
      COUNT(id) AS sessions
    FROM TimerEvents
    WHERE completedAt >= date('now', '-' || ? || ' days')
    GROUP BY date
    ORDER BY date ASC
  `).all(days);
  const result = [];
  const today = new Date();
  for (let index = days; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    const dateString = date.toISOString().split('T')[0];
    const existing = rows.find((row) => row.date === dateString);
    result.push({
      label: dateString,
      count: existing ? existing.count : 0,
      sessions: existing ? existing.sessions : 0
    });
  }
  return result;
}

async function getAllTimerCompletions() {
  return db.prepare(`
    SELECT te.*, u.displayName, u.username
    FROM TimerEvents te
    JOIN Users u ON te.userId = u.id
    ORDER BY te.completedAt DESC
  `).all();
}

async function deleteTimerCompletion(id) {
  return Number(db.prepare('DELETE FROM TimerEvents WHERE id = ?').run(id).changes);
}

async function getAllRoomsAdmin() {
  if (!hasRoomsTable()) return [];
  return db.prepare('SELECT * FROM Rooms ORDER BY createdAt DESC').all();
}

async function deleteRoomAdmin(id) {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (hasRoomsTable()) db.prepare('DELETE FROM Rooms WHERE id = ?').run(id);
    db.prepare('DELETE FROM TimerEvents WHERE roomId = ?').run(id);
    db.exec('COMMIT');
    return 1;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

async function getUserTimerCount(userId) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM TimerEvents WHERE userId = ?').get(userId);
  return row ? row.count : 0;
}

async function hasEarlyBirdTimer(userId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count FROM TimerEvents
    WHERE userId = ? AND CAST(strftime('%H', completedAt) AS INTEGER) BETWEEN 5 AND 7
  `).get(userId);
  return row && row.count > 0 ? 1 : 0;
}

async function hasNightOwlTimer(userId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count FROM TimerEvents
    WHERE userId = ?
      AND (CAST(strftime('%H', completedAt) AS INTEGER) >= 23
        OR CAST(strftime('%H', completedAt) AS INTEGER) < 4)
  `).get(userId);
  return row && row.count > 0 ? 1 : 0;
}

async function hasWeekendWarrior(userId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count FROM TimerEvents
    WHERE userId = ? AND CAST(strftime('%w', completedAt) AS INTEGER) IN (0, 6)
  `).get(userId);
  return row && row.count > 0 ? 1 : 0;
}

function getWeekdayName(dayString) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[parseInt(dayString, 10)] || dayString;
}

function getMonthName(monthString) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[parseInt(monthString, 10) - 1] || monthString;
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

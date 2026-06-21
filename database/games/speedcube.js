const db = require('../connection');

async function addSpeedcubeTime(userId, time_ms, note = '', scramble = '') {
  const result = db.prepare('INSERT INTO SpeedcubeTimes (userId, time_ms, note, scramble) VALUES (?, ?, ?, ?)')
    .run(userId, time_ms, note, scramble);
  return { id: Number(result.lastInsertRowid), userId, time_ms, note, scramble, createdAt: new Date().toISOString() };
}

async function getSpeedcubeTimes(userId) {
  return db.prepare('SELECT * FROM SpeedcubeTimes WHERE userId = ? ORDER BY createdAt DESC').all(userId);
}

async function updateSpeedcubeNote(id, userId, note) {
  return Number(db.prepare('UPDATE SpeedcubeTimes SET note = ? WHERE id = ? AND userId = ?')
    .run(note, id, userId).changes);
}

async function deleteSpeedcubeTime(id, userId) {
  return Number(db.prepare('DELETE FROM SpeedcubeTimes WHERE id = ? AND userId = ?').run(id, userId).changes);
}

module.exports = { addSpeedcubeTime, getSpeedcubeTimes, updateSpeedcubeNote, deleteSpeedcubeTime };

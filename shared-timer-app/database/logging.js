const db = require('./connection');

async function logError(message, stack = null, context = null) {
  const result = db.prepare('INSERT INTO ErrorLogs (message, stack, context) VALUES (?, ?, ?)')
    .run(message, stack, context);
  return Number(result.lastInsertRowid);
}

async function getErrorLogs(limit = 100) {
  return db.prepare('SELECT * FROM ErrorLogs ORDER BY timestamp DESC LIMIT ?').all(limit);
}

async function deleteErrorLog(id) {
  return Number(db.prepare('DELETE FROM ErrorLogs WHERE id = ?').run(id).changes);
}

async function clearErrorLogs() {
  return Number(db.prepare('DELETE FROM ErrorLogs').run().changes);
}

async function logSystemEvent(level, context, message) {
  const result = db.prepare('INSERT INTO SystemLogs (level, context, message) VALUES (?, ?, ?)')
    .run(level, context, message);
  db.prepare("DELETE FROM SystemLogs WHERE createdAt < datetime('now', '-24 hours')").run();
  return Number(result.lastInsertRowid);
}

async function getSystemLogs() {
  return db.prepare('SELECT * FROM SystemLogs ORDER BY createdAt DESC').all();
}

async function clearSystemLogs() {
  return Number(db.prepare('DELETE FROM SystemLogs').run().changes);
}

module.exports = {
  logError,
  getErrorLogs,
  deleteErrorLog,
  clearErrorLogs,
  logSystemEvent,
  getSystemLogs,
  clearSystemLogs
};

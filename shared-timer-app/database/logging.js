const db = require('./connection');

/**
 * Centralized Logging for Error and System Events
 */

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
    db.run('DELETE FROM ErrorLogs', [], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const logSystemEvent = async (level, context, message) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO SystemLogs (level, context, message) VALUES (?, ?, ?)', [level, context, message], function (err) {
      if (err) reject(err);
      else {
        // Enforce 24h retention
        db.run("DELETE FROM SystemLogs WHERE createdAt < datetime('now', '-24 hours')", () => {
          resolve(this.lastID);
        });
      }
    });
  });
};

const getSystemLogs = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM SystemLogs ORDER BY createdAt DESC', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const clearSystemLogs = () => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM SystemLogs', function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

module.exports = {
  logError,
  getErrorLogs,
  deleteErrorLog,
  clearErrorLogs,
  logSystemEvent,
  getSystemLogs,
  clearSystemLogs
};

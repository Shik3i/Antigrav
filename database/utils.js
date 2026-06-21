const db = require('./connection');

/**
 * Database Utilities
 */

const safeJsonParse = (value, fallback) => {
  try {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const dbLayer = {
  db
};

module.exports = {
  safeJsonParse,
  dbLayer
};

const db = require('./connection');

/**
 * Legacy Database Facade
 * 
 * This file formerly contained the entire database logic. 
 * Most functions have been moved to domain-specific modules.
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

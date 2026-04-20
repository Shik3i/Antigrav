const { initializeDatabaseSchema } = require('./schema');
const legacy = require('./legacy');

// 1. Initialize the database schema and migrations
initializeDatabaseSchema();

// 2. Export everything from the modularized and legacy files
module.exports = {
  ...legacy
};

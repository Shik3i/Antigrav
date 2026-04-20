const { initializeDatabaseSchema } = require('./schema');
const logging = require('./logging');
const users = require('./users');
const economy = require('./economy');
const timers = require('./timers');
const legacy = require('./legacy');

// 1. Initialize the database schema and migrations
initializeDatabaseSchema();

// 2. Export everything from the modularized and legacy files
module.exports = {
  ...legacy,
  ...logging,
  ...users,
  ...economy,
  ...timers
};

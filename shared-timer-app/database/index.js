const db = require('./connection');
const { initializeDatabaseSchema } = require('./schema');
const logging = require('./logging');
const users = require('./users');
const economy = require('./economy');
const timers = require('./timers');
const social = require('./social');
const external = require('./external');
const games = require('./games');
const legacy = require('./legacy');

// 1. Initialize the database schema and migrations
initializeDatabaseSchema();

// 2. Export everything from the modularized and legacy files
module.exports = {
  db,
  ...legacy,
  ...logging,
  ...users,
  ...economy,
  ...timers,
  ...social,
  ...external,
  ...games
};

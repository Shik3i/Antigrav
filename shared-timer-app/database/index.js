const db = require('./connection');
const { initializeDatabaseSchema } = require('./schema');
const logging = require('./logging');
const users = require('./users');
const economy = require('./economy');
const timers = require('./timers');
const social = require('./social');
const external = require('./external');
const games = require('./games');
const utils = require('./utils');

// 1. Initialize the database schema and migrations
initializeDatabaseSchema();

// 2. Export everything from the modularized files
module.exports = {
  db,
  ...utils,
  ...logging,
  ...users,
  ...economy,
  ...timers,
  ...social,
  ...external,
  ...games
};

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

let initializationError;
try {
  initializeDatabaseSchema(db);
} catch (error) {
  initializationError = error;
}

const ready = initializationError
  ? Promise.reject(initializationError)
  : Promise.resolve();

// Prevent an unhandled rejection between module loading and server startup.
ready.catch(() => {});

// 2. Export everything from the modularized files
module.exports = {
  db,
  ready,
  ...utils,
  ...logging,
  ...users,
  ...economy,
  ...timers,
  ...social,
  ...external,
  ...games
};

const speedcube = require('./speedcube');
const upgrades = require('./upgrades');
const scores = require('./scores');
const scratchcards = require('./scratchcards');
const tower = require('./tower');
const wordle = require('./wordle');
const blackjack = require('./blackjack');
const lotto = require('./lotto');
const fortune = require('./fortune');
const idle = require('./idle');
const chipSkins = require('./chipSkins');

module.exports = {
  ...speedcube,
  ...upgrades,
  ...scores,
  ...scratchcards,
  ...tower,
  ...wordle,
  ...blackjack,
  ...lotto,
  ...fortune,
  ...idle,
  ...chipSkins,
};

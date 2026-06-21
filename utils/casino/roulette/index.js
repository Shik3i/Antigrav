const { getOdds, ODDS } = require('./odds');
const { getBetCoverage, doesBetWin } = require('./coverage');
const { spin, getColor } = require('./wheel');
const { validateBet, addBet, removeLastBet, getTotalBetsForRound, getBetsForRound, getBetLimit } = require('./bets');
const { calculatePayouts, calculateBalanceChange, prepareSettlementUpdates } = require('./settlement');
const {
  initializeRoom, createNewRound, transitionPhase,
  addParticipant, removeParticipant, getActiveParticipants,
  PHASE_SEQUENCE, PHASE_DURATIONS,
} = require('./tableLifecycle');
const { serializeRoom } = require('./serialization');

module.exports = {
  getOdds, ODDS,
  getBetCoverage, doesBetWin,
  spin, getColor,
  validateBet, addBet, removeLastBet, getTotalBetsForRound, getBetsForRound, getBetLimit,
  calculatePayouts, calculateBalanceChange, prepareSettlementUpdates,
  initializeRoom, createNewRound, transitionPhase,
  addParticipant, removeParticipant, getActiveParticipants,
  PHASE_SEQUENCE, PHASE_DURATIONS,
  serializeRoom,
};

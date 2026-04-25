const assert = require('node:assert/strict');
const { diffBlackjackMotion } = require('../src/features/blackjack/utils/motionDiff.cjs');

const prevState = {
  dealerHand: [{ code: '7D', visible: true }],
  players: [{ userId: 'u1', hands: [{ cards: [{ code: '10C' }] }] }],
};

const nextState = {
  dealerHand: [{ code: '7D', visible: true }, { code: 'AS', visible: false }],
  players: [{ userId: 'u1', hands: [{ cards: [{ code: '10C' }, { code: '3H' }] }] }],
};

const motion = diffBlackjackMotion(prevState, nextState);

assert.equal(motion.deals.length, 2, 'new dealer and player cards should produce two deal animations');
assert.equal(motion.discards.length, 0, 'no cards should discard during a deal transition');
assert.deepEqual(
  motion.deals.map(({ id, source, target }) => ({ id, source, target })),
  [
    { id: 'dealer-hand-card-1', source: 'shoe', target: 'dealer-hand' },
    { id: 'player-u1-hand-0-card-1', source: 'shoe', target: 'player-u1-hand-0' },
  ],
  'deal animations should target the expected anchor ids and sources'
);

const discardPrevState = {
  dealerHand: [{ code: '9S', visible: true }],
  players: [{ userId: 'u1', hands: [{ cards: [{ code: '10C' }, { code: '3H' }] }] }],
};

const discardNextState = {
  dealerHand: [{ code: '9S', visible: true }],
  players: [{ userId: 'u1', hands: [{ cards: [{ code: '10C' }] }] }],
};

const discardMotion = diffBlackjackMotion(discardPrevState, discardNextState);

assert.equal(discardMotion.deals.length, 0, 'no deal animations should emit when a card disappears');
assert.equal(discardMotion.discards.length, 1, 'removed player card should produce one discard animation');
assert.deepEqual(
  discardMotion.discards.map(({ id, source, target }) => ({ id, source, target })),
  [{ id: 'player-u1-hand-0-card-1', source: 'player-u1-hand-0', target: 'discard' }],
  'discard animations should start from the previous hand anchor and point to the discard pile'
);

const sideBetPrevState = {
  viewerUserId: 'u1',
  players: [
    { userId: 'u1', activeSideBets: { twins: 25 }, pendingSideBets: {} },
    { userId: 'u2', activeSideBets: { bust: 25 }, pendingSideBets: {} },
  ],
};

const sideBetNextState = {
  viewerUserId: 'u1',
  players: [
    { userId: 'u1', activeSideBets: {}, pendingSideBets: {} },
    { userId: 'u2', activeSideBets: {}, pendingSideBets: {} },
  ],
  lastSettlement: [
    { userId: 'u1', settlementType: 'sidebet', sideBetKey: 'twins', netProfit: 250 },
    { userId: 'u2', settlementType: 'sidebet', sideBetKey: 'bust', netProfit: -25 },
  ],
};

const sideBetMotion = diffBlackjackMotion(sideBetPrevState, sideBetNextState);

assert.equal(sideBetMotion.sideBetDeals.length, 0, 'no new side bet deal should emit in a pure resolve transition');
assert.deepEqual(
  sideBetMotion.sideBetResolves.map(({ id, source, target }) => ({ id, source, target })),
  [{ id: 'player-u1-sidebet-twins', source: 'player-u1-sidebet-twins', target: 'pending-bet' }],
  'local winning side bets should resolve back toward the player area, not the dealer'
);

console.log('blackjack motion diff regression passed');

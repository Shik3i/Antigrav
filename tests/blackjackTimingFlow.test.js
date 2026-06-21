const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'blackjack-timing-flow';
const USER_A = 'timing-user-a';
const USER_B = 'timing-user-b';

function cleanupRoom() {
  const room = blackjackRoomManager.getRoom(ROOM_ID);
  if (!room) return;
  room.players.slice().forEach((player) => blackjackRoomManager.leaveRoom(ROOM_ID, player.userId));
}

try {
  cleanupRoom();
  blackjackRoomManager.createRoom(ROOM_ID, 3);
  blackjackRoomManager.joinRoom(ROOM_ID, { userId: USER_A, username: 'timinga' });
  blackjackRoomManager.joinRoom(ROOM_ID, { userId: USER_B, username: 'timingb' });

  const beforeFirstBet = Date.now();
  blackjackRoomManager.placeBet(ROOM_ID, USER_A, 10000, 100000);
  let room = blackjackRoomManager.getRoom(ROOM_ID);
  assert(room.autoStartAt, 'auto-start should be scheduled after the first player bets');
  assert(
    room.autoStartAt >= beforeFirstBet + 29000 && room.autoStartAt <= beforeFirstBet + 30500,
    'partially-ready tables should give remaining players about 30 seconds to place bets'
  );

  const beforeAllReady = Date.now();
  blackjackRoomManager.placeBet(ROOM_ID, USER_B, 10000, 100000);

  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert(room.autoStartAt, 'auto-start should be scheduled once seated players have bets');
  assert(
    room.autoStartAt >= beforeAllReady + 29000 && room.autoStartAt <= beforeAllReady + 30500,
    'manual all-bets-ready tables should still use the full bet window'
  );

  blackjackRoomManager.updateAutoBet(ROOM_ID, USER_A, true);
  blackjackRoomManager.updateAutoBet(ROOM_ID, USER_B, true);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert(
    room.autoStartAt <= Date.now() + 2500,
    'tables with all seated players on auto-bet should use the short countdown'
  );

  blackjackRoomManager.updateTimerConfig(ROOM_ID, USER_A, { betWindowSeconds: 45, turnTimeoutSeconds: 60 });
  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(room.timerConfig.betWindowMs, 30000, 'timer changes should not affect the current betting window');
  assert.strictEqual(room.pendingTimerConfig.betWindowMs, 45000, 'timer changes should be queued for the next round');

  room.shoe = [
    { rank: '5', suit: 'spades', code: '5S' },
    { rank: '9', suit: 'hearts', code: '9H' },
    { rank: '6', suit: 'spades', code: '6S' },
    { rank: '10', suit: 'hearts', code: '10H' },
    { rank: '7', suit: 'clubs', code: '7C' },
    { rank: '8', suit: 'diamonds', code: '8D' },
    ...Array.from({ length: 80 }, () => ({ rank: '2', suit: 'clubs', code: '2C' }))
  ];
  room.reshuffleRemainingPercent = 0;

  blackjackRoomManager.startRound(ROOM_ID, USER_A);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert(
    room.turnDeadlineAt >= Date.now() + 59500 && room.turnDeadlineAt <= Date.now() + 60500,
    'queued turn timeout changes should apply to the next round when it starts'
  );
  assert.strictEqual(room.timerConfig.betWindowMs, 45000, 'queued timer config should apply when the next round starts');
  assert.strictEqual(room.pendingTimerConfig, null, 'pending timer config should clear once the next round starts');
  blackjackRoomManager.settleRound(ROOM_ID);
  room = blackjackRoomManager.getRoom(ROOM_ID);

  assert(
    room.settlementCompleteAt >= Date.now() + 4500,
    'settlement result should remain visible for several seconds'
  );

  blackjackRoomManager.finishSettlementPhase(room, room.settlementCompleteAt + 1);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(room.timerConfig.betWindowMs, 45000, 'next betting window should keep the configured bet window');
  assert.strictEqual(room.timerConfig.turnTimeoutMs, 60000, 'next betting window should keep the configured turn timeout');
} finally {
  cleanupRoom();
}

console.log('blackjack timing flow regression passed');

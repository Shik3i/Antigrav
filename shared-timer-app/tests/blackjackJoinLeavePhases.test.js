const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'join-leave-phases';
const ACTIVE_USER = 'join-leave-active-user';
const NEXT_ROUND_USER = 'join-leave-next-round-user';

function cleanupRoom() {
  const room = blackjackRoomManager.getRoom(ROOM_ID);
  if (!room) return;

  room.players.slice().forEach((player) => {
    blackjackRoomManager.leaveRoom(ROOM_ID, player.userId);
  });
}

try {
  cleanupRoom();
  blackjackRoomManager.createRoom(ROOM_ID, 3);

  blackjackRoomManager.joinRoom(ROOM_ID, {
    userId: ACTIVE_USER,
    username: 'activeuser',
    displayName: 'Active User'
  });
  blackjackRoomManager.placeBet(ROOM_ID, ACTIVE_USER, 10000, 100000);
  blackjackRoomManager.startRound(ROOM_ID, ACTIVE_USER);

  let room = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(room.status, 'player_turns', 'fixture should be in an active player turn');

  blackjackRoomManager.joinRoom(ROOM_ID, {
    userId: NEXT_ROUND_USER,
    username: 'nextrounduser',
    displayName: 'Next Round User'
  });

  room = blackjackRoomManager.getRoom(ROOM_ID);
  const waitingPlayer = room.players.find((player) => player.userId === NEXT_ROUND_USER);
  assert.strictEqual(room.status, 'player_turns', 'joining during an active hand must not reset the room phase');
  assert(waitingPlayer, 'joining player should be seated immediately');
  assert.strictEqual(waitingPlayer.currentBet, 0, 'joining player should not enter the active hand');
  assert.strictEqual(waitingPlayer.waitingForNextRound, true, 'joining player should be marked for the next round');
  assert.strictEqual(room.autoStartAt, null, 'joining during an active hand must not schedule a new auto-start');

  blackjackRoomManager.leaveRoom(ROOM_ID, NEXT_ROUND_USER);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert(!room.players.some((player) => player.userId === NEXT_ROUND_USER), 'next-round player without an active bet should leave immediately');
  assert.strictEqual(room.status, 'player_turns', 'next-round leave must not alter the active round');

  blackjackRoomManager.leaveRoom(ROOM_ID, ACTIVE_USER);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  const disconnectedPlayer = room.players.find((player) => player.userId === ACTIVE_USER);
  assert(disconnectedPlayer, 'active bettor should remain until settlement can resolve the bet');
  assert.strictEqual(disconnectedPlayer.connected, false, 'active bettor should be marked disconnected');

  blackjackRoomManager.settleRound(ROOM_ID);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  blackjackRoomManager.tick(room.settlementCompleteAt + 1);

  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert(room, 'room should still exist until normal cleanup removes empty rooms separately');
  assert(!room.players.some((player) => player.userId === ACTIVE_USER), 'disconnected active bettor should be removed after settlement');
} finally {
  cleanupRoom();
}

console.log('blackjack join/leave phase regression passed');

const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'plan-blackjack-round-flow';
const USER_ID = 'plan-user-round';

let createdRoom = false;

function card(rank, suit = 'spades') {
  const suitCode = suit === 'hearts' ? 'H' : suit === 'diamonds' ? 'D' : suit === 'clubs' ? 'C' : 'S';
  return { rank, suit, code: `${rank}${suitCode}` };
}

try {
  if (!blackjackRoomManager.getRoom(ROOM_ID)) {
    blackjackRoomManager.createRoom(ROOM_ID, 3);
    createdRoom = true;
  }

  blackjackRoomManager.joinRoom(ROOM_ID, {
    userId: USER_ID,
    username: 'rounduser',
    displayName: 'Round User'
  });
  blackjackRoomManager.addBot(ROOM_ID);

  blackjackRoomManager.placeBet(ROOM_ID, USER_ID, 10000, 100000);
  let room = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(room.phase, 'betting');
  assert.strictEqual(room.players[0].currentBet, 10000);
  room.shoe = [
    card('5'),
    card('9', 'hearts'),
    card('6'),
    card('10', 'hearts'),
    ...Array.from({ length: 80 }, () => card('2', 'clubs'))
  ];
  room.needsShuffle = false;
  room.reshuffleRemainingPercent = 0;

  blackjackRoomManager.startRound(ROOM_ID, USER_ID);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(room.phase, 'player_turns');
  assert(room.currentPlayerTurn, 'a player turn should be active');
  assert.strictEqual(room.players[0].hands.length, 1);
  assert.strictEqual(room.players[0].hands[0].cards.length, 2);
  assert.strictEqual(room.dealerHand.length, 2);

  blackjackRoomManager.settleRound(ROOM_ID);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(room.discardPile.length, 0, 'cards should remain in hands while settlement is visible');

  blackjackRoomManager.tick(room.settlementCompleteAt + 1);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(room.dealerHand.length, 0, 'dealer hand should be cleared after settlement cleanup');
  assert.strictEqual(room.players[0].hands[0].cards.length, 0, 'player hand cards should be cleared after settlement cleanup');
  assert.strictEqual(room.discardPile.length, 4, 'dealer and player cards should all move to the discard pile');
} finally {
  blackjackRoomManager.leaveRoom(ROOM_ID, USER_ID);
  if (createdRoom) {
    blackjackRoomManager.leaveRoom(ROOM_ID, USER_ID);
  }
}

console.log('blackjack round flow regression passed');

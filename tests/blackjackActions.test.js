const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'plan-blackjack-actions';
const USER_ID = 'plan-user-actions';

let createdRoom = false;

try {
  if (!blackjackRoomManager.getRoom(ROOM_ID)) {
    blackjackRoomManager.createRoom(ROOM_ID, 3);
    createdRoom = true;
  }

  blackjackRoomManager.joinRoom(ROOM_ID, {
    userId: USER_ID,
    username: 'actionuser',
    displayName: 'Action User'
  });

  blackjackRoomManager.placeBet(ROOM_ID, USER_ID, 10000, 100000);
  blackjackRoomManager.startRound(ROOM_ID, USER_ID);

  const before = blackjackRoomManager.getRoom(ROOM_ID);
  const handBefore = before.players[0].hands[0];
  assert.strictEqual(before.currentPlayerTurn, USER_ID);
  assert.strictEqual(handBefore.cards.length, 2);

  blackjackRoomManager.doubleDown(ROOM_ID, USER_ID, 100000);

  const after = blackjackRoomManager.getRoom(ROOM_ID);
  const handAfter = after.players[0].hands[0];
  assert.strictEqual(handAfter.cards.length, 3);
  assert.strictEqual(handAfter.bet, 20000);
  assert.strictEqual(after.players[0].currentBet, 20000);
} finally {
  const room = blackjackRoomManager.getRoom(ROOM_ID);
  if (room) {
    room.players.slice().forEach((player) => {
      blackjackRoomManager.leaveRoom(ROOM_ID, player.userId);
    });
  }
  if (createdRoom) {
    const cleanupRoom = blackjackRoomManager.getRoom(ROOM_ID);
    if (cleanupRoom) {
      cleanupRoom.players.slice().forEach((player) => {
        blackjackRoomManager.leaveRoom(ROOM_ID, player.userId);
      });
    }
  }
}

console.log('blackjack actions regression passed');

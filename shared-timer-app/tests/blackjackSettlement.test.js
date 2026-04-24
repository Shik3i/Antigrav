const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'plan-blackjack-settlement';
const USER_ID = 'plan-user-settlement';

let createdRoom = false;

try {
  if (!blackjackRoomManager.getRoom(ROOM_ID)) {
    blackjackRoomManager.createRoom(ROOM_ID, 3);
    createdRoom = true;
  }

  blackjackRoomManager.joinRoom(ROOM_ID, {
    userId: USER_ID,
    username: 'settler',
    displayName: 'Settler'
  });
  blackjackRoomManager.addBot(ROOM_ID);
  blackjackRoomManager.placeBet(ROOM_ID, USER_ID, 10000, 100000);
  blackjackRoomManager.startRound(ROOM_ID, USER_ID);

  let guard = 0;
  while (blackjackRoomManager.getRoom(ROOM_ID)?.status === 'player_turns' && guard < 10) {
    const room = blackjackRoomManager.getRoom(ROOM_ID);
    if (room.currentPlayerTurn === USER_ID) {
      blackjackRoomManager.stand(ROOM_ID, USER_ID);
    } else {
      blackjackRoomManager.tick(Date.now() + guard * 5000);
    }
    guard += 1;
  }

  while (blackjackRoomManager.getRoom(ROOM_ID)?.status !== 'betting' && guard < 40) {
    blackjackRoomManager.tick(Date.now() + guard * 5000);
    guard += 1;
  }

  const room = blackjackRoomManager.getRoom(ROOM_ID);
  assert(room, 'room should still exist');
  assert.strictEqual(room.phase, 'betting');
  assert(Array.isArray(room.lastSettlement), 'settlement should be recorded');
  assert(room.lastSettlement.length > 0, 'settlement should contain entries');
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

console.log('blackjack settlement regression passed');

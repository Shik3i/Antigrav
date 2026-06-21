const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'plan-blackjack-core';
const USER_ID = 'plan-user-core';

let createdRoom = false;

try {
  if (!blackjackRoomManager.getRoom(ROOM_ID)) {
    blackjackRoomManager.createRoom(ROOM_ID, 5);
    createdRoom = true;
  }

  blackjackRoomManager.joinRoom(ROOM_ID, {
    userId: USER_ID,
    username: 'planuser',
    displayName: 'Plan User'
  });

  const summary = blackjackRoomManager.listRooms().find((room) => room.roomId === ROOM_ID);
  assert(summary, 'room should appear in listRooms');
  assert.strictEqual(summary.status, 'betting');
  assert.strictEqual(summary.phase, 'betting');
  assert.strictEqual(summary.occupiedSeats.length, 1);

  const room = blackjackRoomManager.getRoom(ROOM_ID);
  assert(room, 'room should exist');
  assert.strictEqual(room.phase, 'betting');
  assert.strictEqual(room.players[0].seat, 1);

  blackjackRoomManager.moveSeat(ROOM_ID, {
    userId: USER_ID,
    username: 'planuser',
    displayName: 'Plan User'
  }, 3);

  let updatedRoom = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(updatedRoom.players[0].seat, 3);

  blackjackRoomManager.addBot(ROOM_ID);
  updatedRoom = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(updatedRoom.players.length, 2);
  assert.strictEqual(updatedRoom.status, 'betting');
  assert.strictEqual(updatedRoom.phase, 'betting');
  blackjackRoomManager.removeBot(ROOM_ID);
  updatedRoom = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(updatedRoom.players.length, 1);
  assert(!updatedRoom.players.some((player) => player.isBot));
} finally {
  blackjackRoomManager.leaveRoom(ROOM_ID, USER_ID);
  if (createdRoom) {
    blackjackRoomManager.leaveRoom(ROOM_ID, USER_ID);
  }
}

console.log('blackjackRoomManager core regression passed');

const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'plan-blackjack-split-aces';
const USER_ID = 'plan-user-split-aces';

function card(rank, suit = 'S') {
  return { rank, suit, code: `${rank}${suit}` };
}

try {
  const existingRoom = blackjackRoomManager.getRoom(ROOM_ID);
  if (existingRoom) {
    existingRoom.players.slice().forEach((player) => {
      blackjackRoomManager.leaveRoom(ROOM_ID, player.userId);
    });
  }

  const room = blackjackRoomManager.createRoom(ROOM_ID, 3);
  blackjackRoomManager.joinRoom(ROOM_ID, {
    userId: USER_ID,
    username: 'splitaces',
    displayName: 'Split Aces'
  });
  blackjackRoomManager.placeBet(ROOM_ID, USER_ID, 10000, 100000);

  // Draw order: player A, dealer 6, player A, dealer 5, split draws K and 8.
  room.shoe = [
    card('A', 'S'),
    card('6', 'C'),
    card('A', 'D'),
    card('5', 'C'),
    card('K', 'H'),
    card('8', 'D')
  ];
  for (let index = 0; index < 90; index += 1) {
    room.shoe.push(card('2', 'H'));
  }

  blackjackRoomManager.startRound(ROOM_ID, USER_ID);
  blackjackRoomManager.split(ROOM_ID, USER_ID, 100000);

  const afterSplit = blackjackRoomManager.getRoom(ROOM_ID);
  const player = afterSplit.players.find((entry) => entry.userId === USER_ID);

  assert(player.done, 'split aces should complete the player turn after one card per ace');
  assert(player.hands.every((hand) => hand.done), 'both split ace hands should be done');
  assert.strictEqual(afterSplit.currentPlayerTurn, null, 'no player turn should remain after split aces are complete');
  assert.strictEqual(afterSplit.status, 'dealer_turn', 'dealer should start after completed split aces');
} finally {
  const room = blackjackRoomManager.getRoom(ROOM_ID);
  if (room) {
    room.players.slice().forEach((player) => {
      blackjackRoomManager.leaveRoom(ROOM_ID, player.userId);
    });
  }
}

console.log('blackjack split aces regression passed');

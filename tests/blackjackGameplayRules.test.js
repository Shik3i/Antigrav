const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');
const dealer = require('../utils/casino/blackjack/dealer');
const { calculateHandValue, isSoft17 } = require('../utils/blackjackRules');

const ROOM_ID = 'plan-blackjack-gameplay-rules';
const USER_A = 'plan-user-a-rules';
const USER_B = 'plan-user-b-rules';

let createdRoom = false;

function card(rank, suit = 'S') {
  return { rank, suit, code: `${rank}${suit}` };
}

try {
  if (!blackjackRoomManager.getRoom(ROOM_ID)) {
    blackjackRoomManager.createRoom(ROOM_ID, 3);
    createdRoom = true;
  }

  blackjackRoomManager.joinRoom(ROOM_ID, {
    userId: USER_A,
    username: 'rulesa',
    displayName: 'Rules A'
  });

  blackjackRoomManager.joinRoom(ROOM_ID, {
    userId: USER_B,
    username: 'rulesb',
    displayName: 'Rules B'
  });

  blackjackRoomManager.placeBet(ROOM_ID, USER_A, 10000, 100000);
  blackjackRoomManager.updateAutoBet(ROOM_ID, USER_A, true);
  blackjackRoomManager.placeBet(ROOM_ID, USER_B, 10000, 100000);
  blackjackRoomManager.updateAutoBet(ROOM_ID, USER_B, true);

  let room = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(room.phase, 'betting', 'table should stay in betting until auto-start deadline expires');
  assert(room.autoStartAt, 'auto-start deadline should be scheduled after active auto-bet players have bets');
  assert(room.autoStartAt <= Date.now() + 2500, 'auto-start should be short when all seated players have auto-bet enabled');

  blackjackRoomManager.tick(room.autoStartAt - 1);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(room.phase, 'betting', 'table should not start before the deadline');

  blackjackRoomManager.tick(room.autoStartAt + 1);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(room.phase, 'betting', 'manager should keep betting state until the socket layer charges and starts the round');
  assert([USER_A, USER_B].includes(room.pendingRoundStartByUserId), 'deadline expiry should queue the round start for an active bettor');

  blackjackRoomManager.startRound(ROOM_ID, room.pendingRoundStartByUserId);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  assert.strictEqual(room.phase, 'player_turns', 'table should enter player turns once the queued round is started');

  const fakeRoom = {
    status: 'dealer_turn',
    dealerPhase: 'reveal',
    dealerHand: [card('A'), card('6')],
    dealerActionAt: null
  };

  dealer.resolveDealerTurn(fakeRoom, Date.now(), {
    calculateHandValue,
    dealerActionDelayMs: 1200,
    drawIntoHand() {
      throw new Error('dealer should only decide to draw on reveal');
    },
    isSoft17,
    setDeadline(roomObj, key, value) {
      roomObj[key] = value;
    },
    setPhase() {},
    settleRound() {
      throw new Error('dealer should not settle immediately on soft 17');
    }
  });

  assert.strictEqual(fakeRoom.dealerPhase, 'draw', 'dealer should hit on soft 17');
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

console.log('blackjack gameplay rules regression passed');

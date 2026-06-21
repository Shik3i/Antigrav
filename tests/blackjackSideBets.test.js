const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'plan-blackjack-side-bets';
const USER_ID = 'plan-user-side-bets';

function card(rank, suit = 'S') {
  return { rank, suit, code: `${rank}${suit}` };
}

function resetRoom() {
  const existingRoom = blackjackRoomManager.getRoom(ROOM_ID);
  if (existingRoom) {
    existingRoom.players.slice().forEach((player) => {
      blackjackRoomManager.leaveRoom(ROOM_ID, player.userId);
    });
  }
  return blackjackRoomManager.createRoom(ROOM_ID, 3);
}

try {
  let room = resetRoom();
  blackjackRoomManager.joinRoom(ROOM_ID, {
    userId: USER_ID,
    username: 'sidebettor',
    displayName: 'Side Bettor'
  });
  blackjackRoomManager.placeBet(ROOM_ID, USER_ID, 10000, 100000);
  blackjackRoomManager.placeSideBet(ROOM_ID, USER_ID, 'twins', 2000, 100000);
  blackjackRoomManager.placeSideBet(ROOM_ID, USER_ID, 'bust', 3000, 100000);

  room = blackjackRoomManager.getRoom(ROOM_ID);
  let player = room.players.find((entry) => entry.userId === USER_ID);
  assert.deepStrictEqual(player.pendingSideBets, { twins: 2000, bust: 3000 });

  // Draw order: player 8, dealer 10, player 8, dealer 6. Dealer later draws 9 and busts.
  room.shoe = [card('8', 'S'), card('10', 'C'), card('8', 'D'), card('6', 'H'), card('9', 'S')];
  for (let index = 0; index < 90; index += 1) {
    room.shoe.push(card('2', 'H'));
  }

  blackjackRoomManager.startRound(ROOM_ID, USER_ID);
  room = blackjackRoomManager.getRoom(ROOM_ID);
  player = room.players.find((entry) => entry.userId === USER_ID);
  assert.deepStrictEqual(player.activeSideBets, { twins: 2000, bust: 3000 });
  assert.deepStrictEqual(player.pendingSideBets, {});

  blackjackRoomManager.stand(ROOM_ID, USER_ID);
  blackjackRoomManager.resolveDealerTurn(ROOM_ID, Date.now() + 2000);
  blackjackRoomManager.resolveDealerTurn(ROOM_ID, Date.now() + 4000);
  blackjackRoomManager.resolveDealerTurn(ROOM_ID, Date.now() + 6000);
  room = blackjackRoomManager.getRoom(ROOM_ID);

  const sideBetResults = room.lastSettlement.filter((entry) => entry.settlementType === 'sideBet');
  assert.strictEqual(sideBetResults.length, 2, 'both side bets should settle');

  const twins = sideBetResults.find((entry) => entry.sideBetKey === 'twins');
  const bust = sideBetResults.find((entry) => entry.sideBetKey === 'bust');
  assert.strictEqual(twins.result, 'win');
  assert.strictEqual(twins.payout, 22000, 'twins should pay stake plus 10:1 profit');
  assert.strictEqual(bust.result, 'win');
  assert.strictEqual(bust.payout, 10500, 'dealer bust should pay stake plus 5:2 profit');

  let validationError = null;
  try {
    blackjackRoomManager.placeSideBet(ROOM_ID, USER_ID, 'twins', 1000, 100000);
  } catch (err) {
    validationError = err;
  }
  assert(validationError, 'side bets should not be editable after round start');

  const balanceRoomId = `${ROOM_ID}-balance`;
  const existingBalanceRoom = blackjackRoomManager.getRoom(balanceRoomId);
  if (existingBalanceRoom) {
    existingBalanceRoom.players.slice().forEach((playerEntry) => {
      blackjackRoomManager.leaveRoom(balanceRoomId, playerEntry.userId);
    });
  }
  blackjackRoomManager.createRoom(balanceRoomId, 3);
  blackjackRoomManager.joinRoom(balanceRoomId, {
    userId: USER_ID,
    username: 'sidebettor',
    displayName: 'Side Bettor'
  });
  blackjackRoomManager.placeBet(balanceRoomId, USER_ID, 9000, 10000);
  blackjackRoomManager.placeSideBet(balanceRoomId, USER_ID, 'twins', 1000, 10000);

  let overBudgetError = null;
  try {
    blackjackRoomManager.placeBet(balanceRoomId, USER_ID, 10000, 10000);
  } catch (err) {
    overBudgetError = err;
  }
  assert(overBudgetError, 'main bet changes should include pending side bets in balance validation');

  const losingRoomId = `${ROOM_ID}-losing`;
  const existingLosingRoom = blackjackRoomManager.getRoom(losingRoomId);
  if (existingLosingRoom) {
    existingLosingRoom.players.slice().forEach((playerEntry) => {
      blackjackRoomManager.leaveRoom(losingRoomId, playerEntry.userId);
    });
  }
  blackjackRoomManager.createRoom(losingRoomId, 3);
  blackjackRoomManager.joinRoom(losingRoomId, {
    userId: USER_ID,
    username: 'sidebettor',
    displayName: 'Side Bettor'
  });
  blackjackRoomManager.placeBet(losingRoomId, USER_ID, 10000, 100000);
  blackjackRoomManager.placeSideBet(losingRoomId, USER_ID, 'twins', 2000, 100000);
  blackjackRoomManager.placeSideBet(losingRoomId, USER_ID, 'bust', 3000, 100000);

  let losingRoom = blackjackRoomManager.getRoom(losingRoomId);
  // Draw order: player 8/9 is not twins, dealer 10/7 stands on 17 and does not bust.
  losingRoom.shoe = [card('8', 'S'), card('10', 'C'), card('9', 'D'), card('7', 'H')];
  for (let index = 0; index < 90; index += 1) {
    losingRoom.shoe.push(card('2', 'H'));
  }

  blackjackRoomManager.startRound(losingRoomId, USER_ID);
  blackjackRoomManager.stand(losingRoomId, USER_ID);
  blackjackRoomManager.resolveDealerTurn(losingRoomId, Date.now() + 2000);
  blackjackRoomManager.resolveDealerTurn(losingRoomId, Date.now() + 4000);
  losingRoom = blackjackRoomManager.getRoom(losingRoomId);

  const losingSideBetResults = losingRoom.lastSettlement.filter((entry) => entry.settlementType === 'sideBet');
  const losingTwins = losingSideBetResults.find((entry) => entry.sideBetKey === 'twins');
  const losingBust = losingSideBetResults.find((entry) => entry.sideBetKey === 'bust');
  assert.strictEqual(losingTwins.result, 'lose');
  assert.strictEqual(losingTwins.payout, 0, 'losing twins side bet should not pay out');
  assert.strictEqual(losingTwins.netProfit, -2000, 'losing twins side bet should keep the stake deducted');
  assert.strictEqual(losingBust.result, 'lose');
  assert.strictEqual(losingBust.payout, 0, 'losing bust side bet should not pay out');
  assert.strictEqual(losingBust.netProfit, -3000, 'losing bust side bet should keep the stake deducted');
} finally {
  [ROOM_ID, `${ROOM_ID}-balance`, `${ROOM_ID}-losing`].forEach((roomId) => {
    const room = blackjackRoomManager.getRoom(roomId);
    if (room) {
      room.players.slice().forEach((player) => {
        blackjackRoomManager.leaveRoom(roomId, player.userId);
      });
    }
  });
}

console.log('blackjack side bets regression passed');

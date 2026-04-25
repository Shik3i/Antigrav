function startRound(room, startedByUserId, helpers) {
  if (startedByUserId && !helpers.getPlayerByUserId(room, startedByUserId)) {
    throw new Error('Only seated players can start a blackjack round.');
  }

  const activePlayers = helpers.getOrderedPlayers(room).filter((player) => player.currentBet > 0);
  if (activePlayers.length === 0) {
    throw new Error('At least one player needs a bet before the round can start.');
  }

  if (room.needsShuffle || helpers.shouldReshuffle(room)) {
    helpers.reshuffleShoe(room);
  }

  helpers.setPhase(room, 'dealing');
  helpers.clearDeadline(room, 'turnDeadlineAt');
  helpers.clearDeadline(room, 'autoStartAt');
  helpers.clearDeadline(room, 'settlementCompleteAt');
  helpers.clearDeadline(room, 'dealerActionAt');
  helpers.clearDeadline(room, 'botActionAt');
  room.currentPlayerTurn = null;
  room.autoStartQueuedByUserId = null;
  room.dealerPhase = null;
  room.lastSettlement = [];
  room.lastSettlementRoundId = null;
  room.dealerHand = [];

  room.players.forEach((player) => helpers.resetPlayerRoundState(player));

  activePlayers.forEach((player) => {
    helpers.lockSideBets(player);
    helpers.drawIntoHand(room, player.hands[0].cards);
    helpers.syncPlayerState(player);
  });

  helpers.drawIntoHand(room, room.dealerHand);

  activePlayers.forEach((player) => {
    helpers.drawIntoHand(room, player.hands[0].cards);
    helpers.syncPlayerState(player);
  });

  helpers.drawIntoHand(room, room.dealerHand);

  activePlayers.forEach((player) => {
    helpers.syncPlayerState(player);
    if (player.hands[0].blackjack) {
      player.hands[0].stood = true;
      player.hands[0].done = true;
      player.done = true;
    }
  });

  helpers.setPhase(room, 'player_turns');
  room.currentPlayerTurn = activePlayers.find((player) => !player.done)?.userId || null;
  helpers.setDeadline(room, 'turnDeadlineAt', room.currentPlayerTurn ? Date.now() + helpers.getTurnTimeoutMs(room) : null);
  helpers.setDeadline(
    room,
    'botActionAt',
    room.currentPlayerTurn && helpers.getPlayerByUserId(room, room.currentPlayerTurn)?.isBot
      ? Date.now() + helpers.botActionDelayMs
      : null
  );

  return room;
}

module.exports = {
  startRound
};

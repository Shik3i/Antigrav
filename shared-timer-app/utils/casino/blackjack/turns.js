function hit(room, userId, helpers) {
  if (room.status !== 'player_turns') {
    throw new Error('Hit is only available during player turns.');
  }

  if (String(room.currentPlayerTurn) !== String(userId)) {
    throw new Error('It is not your turn.');
  }

  const player = helpers.getPlayerByUserId(room, userId);
  if (!player || player.done || player.currentBet <= 0) {
    throw new Error('This player cannot hit right now.');
  }

  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.done) {
    throw new Error('This hand is already complete.');
  }

  helpers.drawIntoHand(room, hand.cards);
  helpers.syncPlayerState(player);

  if (hand.busted || hand.value >= 21) {
    hand.done = true;
    helpers.advanceTurn(room);
  }

  return room;
}

function stand(room, userId, helpers) {
  if (room.status !== 'player_turns') {
    throw new Error('Stand is only available during player turns.');
  }

  if (String(room.currentPlayerTurn) !== String(userId)) {
    throw new Error('It is not your turn.');
  }

  const player = helpers.getPlayerByUserId(room, userId);
  if (!player || player.done || player.currentBet <= 0) {
    throw new Error('This player cannot stand right now.');
  }

  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.done) {
    throw new Error('This hand is already complete.');
  }

  hand.stood = true;
  hand.done = true;

  helpers.advanceTurn(room);
  return room;
}

function advanceTurn(room, helpers) {
  const currentPlayer = helpers.getPlayerByUserId(room, room.currentPlayerTurn);
  if (currentPlayer) {
    if (currentPlayer.hands.length > currentPlayer.activeHandIndex + 1) {
      currentPlayer.activeHandIndex += 1;

      const nextHand = currentPlayer.hands[currentPlayer.activeHandIndex];
      if (nextHand.blackjack || nextHand.value === 21) {
        nextHand.done = true;
        return advanceTurn(room, helpers);
      }

      helpers.setDeadline(room, 'turnDeadlineAt', Date.now() + helpers.turnTimeoutMs);
      helpers.setDeadline(
        room,
        'botActionAt',
        currentPlayer.isBot ? Date.now() + helpers.botActionDelayMs : null
      );
      return room;
    }

    currentPlayer.done = true;
  }

  const orderedPlayers = helpers.getOrderedPlayers(room).filter((player) => player.currentBet > 0);
  if (orderedPlayers.length === 0) {
    room.currentPlayerTurn = null;
    helpers.clearDeadline(room, 'turnDeadlineAt');
    helpers.setPhase(room, 'waiting');
    return room;
  }

  const currentIndex = orderedPlayers.findIndex((player) => String(player.userId) === String(room.currentPlayerTurn));
  const nextPlayer = orderedPlayers.slice(currentIndex + 1).find((player) => !player.done)
    || orderedPlayers.find((player) => !player.done);

  if (!nextPlayer) {
    room.currentPlayerTurn = null;
    helpers.clearDeadline(room, 'turnDeadlineAt');
    helpers.beginDealerTurn(room);
    return room;
  }

  room.currentPlayerTurn = nextPlayer.userId;
  helpers.setDeadline(room, 'turnDeadlineAt', Date.now() + helpers.turnTimeoutMs);
  helpers.setDeadline(
    room,
    'botActionAt',
    nextPlayer.isBot ? Date.now() + helpers.botActionDelayMs : null
  );
  helpers.setPhase(room, 'player_turns');
  return room;
}

module.exports = {
  advanceTurn,
  hit,
  stand
};

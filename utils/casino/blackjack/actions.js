function split(room, userId, userBalance, helpers) {
  if (room.status !== 'player_turns') {
    throw new Error('Split is only available during player turns.');
  }

  if (String(room.currentPlayerTurn) !== String(userId)) {
    throw new Error('It is not your turn.');
  }

  const player = helpers.getPlayerByUserId(room, userId);
  if (!player || player.done || player.currentBet <= 0) {
    throw new Error('This player cannot split right now.');
  }

  if (player.hands.length >= 2) {
    throw new Error('You can only split once per seat.');
  }

  const hand = player.hands[0];
  if (hand.cards.length !== 2) {
    throw new Error('Splitting is only allowed on the initial two cards.');
  }

  const rank1 = hand.cards[0].rank;
  const rank2 = hand.cards[1].rank;
  if (rank1 !== rank2) {
    throw new Error('You can only split cards of the same rank.');
  }

  if (!player.isBot && (!Number.isFinite(userBalance) || userBalance < hand.bet)) {
    throw new Error('Not enough KoalaCoins to split.');
  }

  const additionalBet = hand.bet;
  const splitCard = hand.cards.pop();
  player.currentBet += additionalBet;
  hand.value = helpers.calculateHandValue(hand.cards);

  const hand2 = helpers.createHandState(additionalBet);
  hand2.cards.push(splitCard);
  hand2.value = helpers.calculateHandValue(hand2.cards);
  player.hands.push(hand2);

  const isAces = rank1 === 'A';
  if (isAces) {
    hand.isAcesSplit = true;
    hand2.isAcesSplit = true;
    helpers.drawIntoHand(room, hand.cards);
    helpers.drawIntoHand(room, hand2.cards);
    hand.stood = true;
    hand.done = true;
    hand2.stood = true;
    hand2.done = true;
  } else {
    helpers.drawIntoHand(room, hand.cards);
  }

  helpers.syncPlayerState(player);

  if (player.done) {
    helpers.advanceTurn(room);
  }

  return { room, additionalBet };
}

function doubleDown(room, userId, userBalance, helpers) {
  if (room.status !== 'player_turns') {
    throw new Error('Double Down is only available during player turns.');
  }

  if (String(room.currentPlayerTurn) !== String(userId)) {
    throw new Error('It is not your turn.');
  }

  const player = helpers.getPlayerByUserId(room, userId);
  if (!player || player.done || player.currentBet <= 0) {
    throw new Error('This player cannot double down right now.');
  }

  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.done) {
    throw new Error('This hand is already complete.');
  }

  if (hand.cards.length !== 2) {
    throw new Error('Double Down is only allowed on the initial two cards.');
  }

  if (!player.isBot && (!Number.isFinite(userBalance) || userBalance < hand.bet)) {
    throw new Error('Not enough KoalaCoins to double down.');
  }

  const additionalBet = hand.bet;
  hand.bet += additionalBet;
  player.currentBet += additionalBet;

  helpers.drawIntoHand(room, hand.cards);
  helpers.syncPlayerState(player);
  hand.stood = true;
  hand.done = true;
  helpers.advanceTurn(room);

  return { room, additionalBet };
}

module.exports = {
  doubleDown,
  split
};

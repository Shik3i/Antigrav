function beginDealerTurn(room, now, helpers) {
  helpers.setPhase(room, 'dealer_turn');
  room.dealerPhase = 'reveal';
  helpers.setDeadline(room, 'dealerActionAt', now + helpers.dealerActionDelayMs);
  return room;
}

function resolveDealerTurn(room, now, helpers) {
  if (room.status !== 'dealer_turn') {
    return room;
  }

  const dealerValue = helpers.calculateHandValue(room.dealerHand);

  if (room.dealerPhase === 'reveal') {
    if (dealerValue > 21) {
      room.dealerPhase = 'bust';
    } else if (dealerValue < 17) {
      room.dealerPhase = 'draw';
    } else {
      room.dealerPhase = 'stand';
    }

    helpers.setDeadline(room, 'dealerActionAt', now + helpers.dealerActionDelayMs);
    return room;
  }

  if (room.dealerPhase === 'draw') {
    helpers.drawIntoHand(room, room.dealerHand);
    const nextValue = helpers.calculateHandValue(room.dealerHand);

    if (nextValue > 21) {
      room.dealerPhase = 'bust';
    } else if (nextValue < 17) {
      room.dealerPhase = 'draw';
    } else {
      room.dealerPhase = 'stand';
    }

    helpers.setDeadline(room, 'dealerActionAt', now + helpers.dealerActionDelayMs);
    return room;
  }

  if (room.dealerPhase === 'stand' || room.dealerPhase === 'bust') {
    return helpers.settleRound(room, now);
  }

  room.dealerPhase = dealerValue >= 17 ? 'stand' : 'draw';
  helpers.setDeadline(room, 'dealerActionAt', now + helpers.dealerActionDelayMs);
  return room;
}

module.exports = {
  beginDealerTurn,
  resolveDealerTurn
};

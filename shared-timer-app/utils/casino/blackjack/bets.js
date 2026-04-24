function placeBet(room, userId, amount, userBalance, helpers) {
  if (!['waiting', 'betting'].includes(room.status)) {
    throw new Error('Bets can only be placed before the round starts.');
  }

  const player = helpers.getPlayerByUserId(room, userId);
  if (!player) {
    throw new Error('Player is not seated at this blackjack table.');
  }

  helpers.validateBetAmount(amount);

  const sideBetAmount = helpers.getTotalSideBetAmount ? helpers.getTotalSideBetAmount(player.pendingSideBets) : 0;
  if (!player.isBot && (!Number.isFinite(userBalance) || userBalance < amount + sideBetAmount)) {
    throw new Error('Not enough KoalaCoins for that bet.');
  }

  player.currentBet = amount;
  if (amount > 0) {
    helpers.setPhase(room, 'betting');
    helpers.maybeScheduleAutoStart(room, userId);
  } else {
    const bettors = room.players.filter((entry) => entry.currentBet > 0);
    if (bettors.length === 0) {
      helpers.setPhase(room, 'waiting');
      room.autoStartAt = null;
    }
  }

  return room;
}

module.exports = {
  placeBet
};

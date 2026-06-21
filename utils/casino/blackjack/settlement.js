function finishSettlementPhase(room, now, helpers) {
  helpers.discardCards(room, room.dealerHand);
  room.players.forEach((player) => {
    (player.hands || []).forEach((hand) => {
      helpers.discardCards(room, hand.cards);
    });
  });

  room.dealerHand = [];
  room.currentPlayerTurn = null;
  helpers.clearDeadline(room, 'turnDeadlineAt');
  helpers.clearDeadline(room, 'autoStartAt');
  room.autoStartQueuedByUserId = null;
  helpers.clearDeadline(room, 'settlementCompleteAt');
  helpers.clearDeadline(room, 'botActionAt');

  room.players.forEach((player) => {
    player.currentBet = 0;
    player.waitingForNextRound = false;
    helpers.clearRoundSideBets(player);
    helpers.resetPlayerRoundState(player);
  });
  room.players = room.players.filter((player) => player.connected !== false);

  helpers.advanceRound(room);
  if (room.pendingTimerConfig) {
    room.timerConfig = room.pendingTimerConfig;
    room.pendingTimerConfig = null;
  }
  room.activeTimerConfig = null;
  helpers.setPhase(room, room.players.length > 0 ? 'betting' : 'waiting');
  helpers.updateShuffleFlag(room);
  helpers.maybeScheduleAutoStart(room, null, now);
  return room;
}

function settleRound(room, now, helpers) {
  helpers.setPhase(room, 'settlement');
  const dealerValue = helpers.calculateHandValue(room.dealerHand);
  const dealerBust = dealerValue > 21;
  const dealerBlackjack = helpers.isBlackjack(room.dealerHand);

  const entries = [];
  const orderedPlayers = helpers.getOrderedPlayers(room).filter((player) => player.currentBet > 0);

  orderedPlayers.forEach((player) => {
    helpers.syncPlayerState(player);

    player.hands.forEach((hand, index) => {
      let result = 'push';
      if (hand.busted) {
        result = 'bust';
      } else if (hand.blackjack && dealerBlackjack) {
        result = 'push';
      } else if (hand.blackjack) {
        result = 'blackjack';
      } else if (dealerBust) {
        result = 'win';
      } else if (hand.value > dealerValue) {
        result = 'win';
      } else if (hand.value < dealerValue) {
        result = 'lose';
      } else {
        result = 'push';
      }

      const payout = result === 'blackjack' ? Math.floor(hand.bet * 2.5) : result === 'win' ? hand.bet * 2 : result === 'push' ? hand.bet : 0;
      const netProfit = payout - hand.bet;

      entries.push({
        userId: player.userId,
        username: player.username,
        displayName: player.displayName || player.username,
        isBot: Boolean(player.isBot),
        bet: hand.bet,
        handValue: hand.value,
        blackjack: hand.blackjack,
        busted: hand.busted,
        result,
        payout,
        netProfit,
        handIndex: index,
        totalHands: player.hands.length
      });
    });

    entries.push(...helpers.settleSideBets(room, player, helpers));
  });

  room.lastSettlement = entries;
  room.lastSettlementRoundId = room.roundId;
  room.currentPlayerTurn = null;
  helpers.clearDeadline(room, 'turnDeadlineAt');
  helpers.clearDeadline(room, 'autoStartAt');
  room.autoStartQueuedByUserId = null;
  helpers.setDeadline(room, 'settlementCompleteAt', now + helpers.settlementDisplayMs);
  helpers.clearDeadline(room, 'botActionAt');
  room.dealerPhase = null;
  helpers.clearDeadline(room, 'dealerActionAt');

  helpers.setPhase(room, room.players.length > 0 ? 'settlement' : 'waiting');
  helpers.updateShuffleFlag(room);

  return {
    room,
    settlement: entries
  };
}

module.exports = {
  finishSettlementPhase,
  settleRound
};

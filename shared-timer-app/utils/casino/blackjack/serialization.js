function serializePlayer(player, helpers) {
  return {
    userId: player.userId,
    username: player.username,
    displayName: player.displayName || player.username,
    isBot: Boolean(player.isBot),
    seat: player.seat,
    currentBet: player.currentBet,
    pendingSideBets: player.pendingSideBets || {},
    activeSideBets: player.activeSideBets || {},
    sideBetResults: player.sideBetResults || [],
    activeHandIndex: player.activeHandIndex,
    hands: (player.hands || []).map((hand) => ({
      cards: (hand.cards || []).map((card) => helpers.serializeCard(card, true)),
      value: hand.value,
      bet: hand.bet,
      stood: hand.stood,
      busted: hand.busted,
      blackjack: hand.blackjack,
      done: hand.done,
      isAcesSplit: hand.isAcesSplit
    })),
    done: player.done,
    connected: player.connected,
    waitingForNextRound: Boolean(player.waitingForNextRound),
    autoBetEnabled: Boolean(player.autoBetEnabled),
    preferences: player.preferences || {}
  };
}

function serializeSettlement(results) {
  return (results || []).map((entry) => ({
    userId: entry.userId,
    username: entry.username,
    isBot: Boolean(entry.isBot),
    bet: entry.bet,
    handValue: entry.handValue,
    blackjack: entry.blackjack,
    busted: entry.busted,
    result: entry.result,
    settlementType: entry.settlementType || 'main',
    sideBetKey: entry.sideBetKey || null,
    label: entry.label || null,
    payout: entry.payout,
    netProfit: entry.netProfit
  }));
}

function getRoomState(room, viewerUserId, helpers) {
  const revealHoleCard = room.status === 'dealer_turn' || room.status === 'settlement';

  return {
    roomId: room.roomId,
    game: room.game,
    status: room.status,
    phase: room.phase || room.status,
    maxPlayers: room.maxPlayers,
    roundId: room.roundId,
    players: helpers.getOrderedPlayers(room).map((player) => serializePlayer(player, helpers)),
    dealerHand: helpers.serializeDealerHand(room.dealerHand, revealHoleCard),
    dealerHandValue: revealHoleCard
      ? helpers.calculateHandValue(room.dealerHand)
      : helpers.calculateHandValue(room.dealerHand.slice(0, 1)),
    currentPlayerTurn: room.currentPlayerTurn,
    turnDeadlineAt: room.turnDeadlineAt,
    autoStartAt: room.autoStartAt,
    dealerPhase: helpers.getDealerPhase(room),
    dealerActionAt: room.dealerActionAt,
    shoeRemaining: room.shoe.length,
    discardCount: room.discardPile.length,
    needsShuffle: room.needsShuffle,
    reshuffleRemainingPercent: room.reshuffleRemainingPercent,
    deckCount: room.deckCount,
    burnCard: Boolean(room.burnCard),
    timerConfig: room.timerConfig || null,
    pendingTimerConfig: room.pendingTimerConfig || null,
    allowedBets: helpers.allowedBets,
    sideBetDefinitions: helpers.sideBetDefinitions || [],
    viewerUserId,
    lastSettlement: serializeSettlement(room.lastSettlement),
    lastSettlementRoundId: room.lastSettlementRoundId
  };
}

module.exports = {
  getRoomState,
  serializePlayer,
  serializeSettlement
};

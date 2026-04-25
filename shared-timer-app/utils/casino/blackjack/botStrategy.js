function processTick(room, roomId, now, helpers) {
  let changed = false;

  if (['waiting', 'betting'].includes(room.status)) {
    const idleBots = helpers.getOrderedPlayers(room).filter((player) => player.isBot && player.currentBet <= 0);
    if (idleBots.length > 0) {
      idleBots.forEach((bot) => {
        bot.currentBet = helpers.botDefaultBetCents;
      });
      helpers.maybeScheduleAutoStart(room, idleBots[0]?.userId || null, now);
      changed = true;
    }
  }

  if (room.status === 'settlement' && room.settlementCompleteAt && now >= room.settlementCompleteAt) {
    helpers.finishSettlementPhase(room, now);
    changed = true;
  }

  if (room.status === 'dealer_turn' && room.dealerActionAt && now >= room.dealerActionAt) {
    helpers.resolveDealerTurn(room, now);
    changed = true;
  }

  if (room.status === 'player_turns' && room.turnDeadlineAt && room.currentPlayerTurn) {
    const currentPlayer = helpers.getPlayerByUserId(room, room.currentPlayerTurn);
    const isDisconnected = currentPlayer && currentPlayer.connected === false;
    const effectiveTimeout = isDisconnected ? 10 * 1000 : helpers.getTurnTimeoutMs(room);

    if (isDisconnected && room.turnDeadlineAt > now + 10000) {
      room.turnDeadlineAt = now + 10000;
      changed = true;
    }

    if (now >= room.turnDeadlineAt) {
      try {
        helpers.stand(room, room.currentPlayerTurn);
        changed = true;
      } catch (err) {
        room.turnDeadlineAt = now + effectiveTimeout;
      }
    }
  }

  if (room.status === 'player_turns' && room.currentPlayerTurn) {
    const currentPlayer = helpers.getPlayerByUserId(room, room.currentPlayerTurn);
    if (currentPlayer?.isBot) {
      if (!room.botActionAt) {
        room.botActionAt = now + helpers.botActionDelayMs;
      } else if (now >= room.botActionAt) {
        try {
          const activeHand = currentPlayer.hands[currentPlayer.activeHandIndex];
          if (!activeHand) {
            helpers.stand(room, currentPlayer.userId);
            return true;
          }

          const canSplit = currentPlayer.hands.length === 1
            && activeHand.cards.length === 2
            && activeHand.cards[0].rank === activeHand.cards[1].rank;

          if (canSplit) {
            const rank = activeHand.cards[0].rank;
            if (['A', '8', '9'].includes(rank)) {
              helpers.split(roomId, currentPlayer.userId, 999999);
              return true;
            }
          }

          if (activeHand.value < 17 && !activeHand.blackjack && !activeHand.busted) {
            helpers.hit(room, currentPlayer.userId);
          } else {
            helpers.stand(room, currentPlayer.userId);
          }
          changed = true;
        } catch (err) {
          room.botActionAt = now + helpers.botActionDelayMs;
        }
      }
    }
  }

  if (['waiting', 'betting'].includes(room.status) && room.autoStartAt && now >= room.autoStartAt) {
    const starterId = room.autoStartQueuedByUserId || helpers.getOrderedPlayers(room).find((player) => player.currentBet > 0)?.userId;
    if (starterId) {
      room.pendingRoundStartByUserId = starterId;
      room.autoStartAt = null;
      room.autoStartQueuedByUserId = null;
      changed = true;
    } else {
      room.autoStartAt = null;
      room.autoStartQueuedByUserId = null;
      room.pendingRoundStartByUserId = null;
      changed = true;
    }
  }

  return changed;
}

module.exports = {
  processTick
};

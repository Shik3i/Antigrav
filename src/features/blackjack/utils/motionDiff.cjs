function collectCards(state = {}) {
  const cards = [];
  const dealerCards = state.dealerHand || state.dealer?.cards || [];

  dealerCards.forEach((card, index) => {
    cards.push({
      id: `dealer-hand-card-${index}`,
      code: card.code,
      target: 'dealer-hand',
    });
  });

  (state.players || []).forEach((player) => {
    (player.hands || []).forEach((hand, handIndex) => {
      const handCards = Array.isArray(hand) ? hand : hand.cards || [];
      handCards.forEach((card, cardIndex) => {
        const handAnchorId = `player-${player.userId}-hand-${handIndex}`;
        cards.push({
          id: `${handAnchorId}-card-${cardIndex}`,
          code: card.code,
          target: handAnchorId,
        });
      });
    });
  });

  return cards;
}

function collectSideBets(state = {}) {
  const sideBets = [];
  const viewerUserId = state.viewerUserId ? String(state.viewerUserId) : null;

  (state.players || []).forEach((player) => {
    if (viewerUserId && String(player.userId) !== viewerUserId) {
      return;
    }

    const activeSideBets = player.activeSideBets || {};
    const pendingSideBets = player.pendingSideBets || {};

    ['twins', 'bust'].forEach((key) => {
      const activeAmount = Number(activeSideBets[key] || 0);
      const pendingAmount = Number(pendingSideBets[key] || 0);
      const amount = activeAmount > 0 ? activeAmount : pendingAmount > 0 ? pendingAmount : 0;

      if (amount <= 0) {
        return;
      }

      const target = `player-${player.userId}-sidebet-${key}`;
      sideBets.push({
        id: target,
        amount,
        key,
        target,
      });
    });
  });

  return sideBets;
}

function collectSideBetSettlements(state = {}) {
  const settlements = new Map();
  const viewerUserId = state.viewerUserId ? String(state.viewerUserId) : null;

  (state.lastSettlement || []).forEach((entry) => {
    if (entry.settlementType !== 'sidebet' || !entry.sideBetKey) return;
    if (viewerUserId && String(entry.userId) !== viewerUserId) return;
    settlements.set(`player-${entry.userId}-sidebet-${entry.sideBetKey}`, entry);
  });

  return settlements;
}

function diffBlackjackMotion(prevState = {}, nextState = {}) {
  const previous = collectCards(prevState);
  const next = collectCards(nextState);
  const previousIds = new Set(previous.map((entry) => entry.id));
  const nextIds = new Set(next.map((entry) => entry.id));
  const previousSideBets = collectSideBets(prevState);
  const nextSideBets = collectSideBets(nextState);
  const previousSideBetIds = new Set(previousSideBets.map((entry) => entry.id));
  const nextSideBetIds = new Set(nextSideBets.map((entry) => entry.id));
  const sideBetSettlements = collectSideBetSettlements(nextState);

  return {
    deals: next
      .filter((entry) => !previousIds.has(entry.id))
      .map((entry) => ({ ...entry, source: 'shoe' })),
    discards: previous
      .filter((entry) => !nextIds.has(entry.id))
      .map((entry) => ({ ...entry, source: entry.target, target: 'discard' })),
    sideBetDeals: nextSideBets
      .filter((entry) => !previousSideBetIds.has(entry.id))
      .map((entry) => ({ ...entry, source: 'pending-bet' })),
    sideBetResolves: previousSideBets
      .filter((entry) => !nextSideBetIds.has(entry.id))
      .map((entry) => {
        const settlement = sideBetSettlements.get(entry.id);
        const isWin = Number(settlement?.netProfit || 0) > 0;

        return {
          ...entry,
          source: entry.target,
          target: isWin ? 'pending-bet' : 'dealer-hand',
        };
      }),
  };
}

module.exports = {
  collectCards,
  collectSideBets,
  diffBlackjackMotion,
};

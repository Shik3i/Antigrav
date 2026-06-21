const SIDE_BET_DEFINITIONS = {
  twins: {
    key: 'twins',
    label: 'Twins',
    payoutNumerator: 10,
    payoutDenominator: 1
  },
  bust: {
    key: 'bust',
    label: 'Bust',
    payoutNumerator: 5,
    payoutDenominator: 2
  }
};

function getSideBetDefinitions() {
  return Object.values(SIDE_BET_DEFINITIONS);
}

function normalizeSideBetKey(sideBetKey) {
  return String(sideBetKey || '').trim();
}

function getTotalSideBetAmount(sideBets = {}) {
  return Object.values(sideBets || {}).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
}

function cloneSideBets(sideBets = {}) {
  return Object.entries(sideBets || {}).reduce((result, [key, amount]) => {
    const normalizedAmount = Number(amount || 0);
    if (normalizedAmount > 0) {
      result[key] = normalizedAmount;
    }
    return result;
  }, {});
}

function ensureSideBetContainers(player) {
  if (!player.pendingSideBets) player.pendingSideBets = {};
  if (!player.activeSideBets) player.activeSideBets = {};
  if (!player.sideBetResults) player.sideBetResults = [];
}

function placeSideBet(room, userId, sideBetKey, amount, userBalance, helpers) {
  if (!['waiting', 'betting'].includes(room.status)) {
    throw new Error('Side bets can only be placed before the round starts.');
  }

  const player = helpers.getPlayerByUserId(room, userId);
  if (!player) {
    throw new Error('Player is not seated at this blackjack table.');
  }

  const safeKey = normalizeSideBetKey(sideBetKey);
  if (!SIDE_BET_DEFINITIONS[safeKey]) {
    throw new Error('Unknown blackjack side bet.');
  }

  helpers.validateBetAmount(amount);
  ensureSideBetContainers(player);

  const nextPending = {
    ...player.pendingSideBets,
    [safeKey]: Number(amount)
  };
  if (Number(amount) <= 0) {
    delete nextPending[safeKey];
  }

  const totalReserved = Number(player.currentBet || 0) + getTotalSideBetAmount(nextPending);
  if (!player.isBot && (!Number.isFinite(userBalance) || userBalance < totalReserved)) {
    throw new Error('Not enough KoalaCoins for those bets.');
  }

  player.pendingSideBets = nextPending;
  if (totalReserved > 0) {
    helpers.setPhase(room, 'betting');
    helpers.maybeScheduleAutoStart(room, userId);
  }

  return room;
}

function lockSideBets(player) {
  ensureSideBetContainers(player);
  player.activeSideBets = cloneSideBets(player.pendingSideBets);
  player.pendingSideBets = {};
  player.sideBetResults = [];
}

function clearRoundSideBets(player) {
  ensureSideBetContainers(player);
  player.activeSideBets = {};
  player.sideBetResults = [];
}

function isTwinsWin(player) {
  const firstHand = player?.hands?.[0];
  const cards = firstHand?.cards || [];
  return cards.length >= 2 && cards[0]?.rank && cards[0].rank === cards[1]?.rank;
}

function settleSideBets(room, player, helpers) {
  ensureSideBetContainers(player);
  const activeSideBets = player.activeSideBets || {};
  const dealerBust = helpers.calculateHandValue(room.dealerHand) > 21;

  const entries = Object.entries(activeSideBets)
    .filter(([, amount]) => Number(amount) > 0)
    .map(([sideBetKey, amount]) => {
      const definition = SIDE_BET_DEFINITIONS[sideBetKey];
      const win = sideBetKey === 'twins' ? isTwinsWin(player) : sideBetKey === 'bust' ? dealerBust : false;
      const payout = win
        ? Math.floor(Number(amount) + (Number(amount) * definition.payoutNumerator) / definition.payoutDenominator)
        : 0;

      return {
        settlementType: 'sideBet',
        userId: player.userId,
        username: player.username,
        displayName: player.displayName || player.username,
        isBot: Boolean(player.isBot),
        sideBetKey,
        label: definition.label,
        bet: Number(amount),
        result: win ? 'win' : 'lose',
        payout,
        netProfit: payout - Number(amount)
      };
    });

  player.sideBetResults = entries;
  return entries;
}

module.exports = {
  clearRoundSideBets,
  getSideBetDefinitions,
  getTotalSideBetAmount,
  lockSideBets,
  placeSideBet,
  settleSideBets
};

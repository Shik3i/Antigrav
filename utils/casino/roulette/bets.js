const { getBetCoverage } = require('./coverage');

const OUTSIDE_BET_TYPES = new Set([
  'red','black','odd','even','range_1to18','range_19to36',
  'dozen_1','dozen_2','dozen_3',
  'column_1','column_2','column_3',
]);

const OUTSIDE_LIMIT = 1000;
const INSIDE_LIMIT = 500;
const ROUND_TOTAL_LIMIT = 5000;

function getBetLimit(betType) {
  return OUTSIDE_BET_TYPES.has(betType) ? OUTSIDE_LIMIT : INSIDE_LIMIT;
}

function validateBet(room, userId, betType, amount) {
  if (room.currentPhase !== 'betting_open') {
    return { valid: false, error: 'Betting is not open' };
  }

  if (!Number.isInteger(amount) || amount < 1) {
    return { valid: false, error: 'Minimum bet is 1 KC' };
  }

  try {
    getBetCoverage(betType);
  } catch (e) {
    return { valid: false, error: `Invalid bet type: ${betType}` };
  }

  const limit = getBetLimit(betType);
  if (amount > limit) {
    return { valid: false, error: `Bet exceeds limit of ${limit} KC` };
  }

  const currentTotal = getTotalBetsForRound(room, userId);
  if (currentTotal + amount > ROUND_TOTAL_LIMIT) {
    return { valid: false, error: `Total bets cannot exceed ${ROUND_TOTAL_LIMIT} KC per round` };
  }

  const participant = room.participants.find(p => p.userId === userId);
  if (!participant || participant.balance < amount) {
    return { valid: false, error: 'Nicht genug Guthaben' };
  }

  return { valid: true };
}

function addBet(room, userId, betType, amount) {
  const bet = {
    betId: crypto.randomUUID(),
    playerId: userId,
    type: betType,
    amount,
    status: 'active',
    payout: 0,
  };

  if (!room.rounds[room.roundId].bets[userId]) {
    room.rounds[room.roundId].bets[userId] = [];
  }

  room.rounds[room.roundId].bets[userId].push(bet);
  return bet;
}

function getTotalBetsForRound(room, userId) {
  const bets = room.rounds[room.roundId]?.bets[userId] || [];
  return bets.reduce((sum, b) => sum + (b.status === 'active' ? b.amount : 0), 0);
}

function getBetsForRound(room, roundId) {
  return room.rounds[roundId]?.bets || {};
}

// Remove the last active bet of this player on this betType. Returns removed bet or null.
function removeLastBet(room, userId, betType) {
  const bets = room.rounds[room.roundId]?.bets[userId];
  if (!bets) return null;
  for (let i = bets.length - 1; i >= 0; i--) {
    if (bets[i].type === betType && bets[i].status === 'active') {
      const [removed] = bets.splice(i, 1);
      return removed;
    }
  }
  return null;
}

module.exports = { validateBet, addBet, removeLastBet, getTotalBetsForRound, getBetsForRound, getBetLimit };

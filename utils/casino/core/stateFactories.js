function createBaseTableState({ roomId, game, maxPlayers }) {
  return {
    roomId,
    game,
    // Phase-first core: supports turn-based games like blackjack and
    // simultaneous betting windows like roulette without forcing seats.
    status: 'waiting',
    phase: 'waiting',
    maxPlayers,
    roundId: 1,
    participants: []
  };
}

function createParticipantState(user, overrides = {}) {
  return {
    userId: String(user.userId || user.id),
    username: user.username || user.displayName || 'Guest',
    displayName: user.displayName || user.username || 'Guest',
    isBot: Boolean(user.isBot),
    connected: true,
    seat: null,
    preferences: user.preferences || {},
    ...overrides
  };
}

module.exports = {
  createBaseTableState,
  createParticipantState
};

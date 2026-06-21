const { validateBet, addBet, getTotalBetsForRound, getBetLimit } = require('../../../utils/casino/roulette/bets');

const makeRoom = (overrides = {}) => ({
  currentPhase: 'betting_open',
  participants: [{ userId: 'user1', balance: 1000 }],
  roundId: 'round_1',
  rounds: { 'round_1': { bets: { 'user1': [] } } },
  ...overrides,
});

describe('bets', () => {
  describe('validateBet', () => {
    it('rejects if phase not betting_open', () => {
      const room = makeRoom({ currentPhase: 'betting_closed' });
      expect(validateBet(room, 'user1', 'red', 100).valid).toBe(false);
    });

    it('rejects amount < 1', () => {
      expect(validateBet(makeRoom(), 'user1', 'red', 0).valid).toBe(false);
    });

    it('rejects outside bet > 1000', () => {
      expect(validateBet(makeRoom(), 'user1', 'red', 1001).valid).toBe(false);
    });

    it('rejects inside bet > 500', () => {
      expect(validateBet(makeRoom(), 'user1', 'straight_5', 501).valid).toBe(false);
    });

    it('rejects if round total > 5000', () => {
      const room = makeRoom();
      room.rounds['round_1'].bets['user1'] = [
        { status: 'active', amount: 3000 },
        { status: 'active', amount: 1500 },
      ];
      expect(validateBet(room, 'user1', 'red', 600).valid).toBe(false);
    });

    it('rejects if insufficient balance', () => {
      const room = makeRoom({ participants: [{ userId: 'user1', balance: 50 }] });
      expect(validateBet(room, 'user1', 'red', 100).valid).toBe(false);
    });

    it('error message for insufficient balance is "Nicht genug Guthaben"', () => {
      const room = makeRoom({ participants: [{ userId: 'user1', balance: 50 }] });
      expect(validateBet(room, 'user1', 'red', 100).error).toBe('Nicht genug Guthaben');
    });

    it('accepts valid outside bet', () => {
      expect(validateBet(makeRoom(), 'user1', 'red', 100).valid).toBe(true);
    });

    it('accepts valid inside bet', () => {
      expect(validateBet(makeRoom(), 'user1', 'straight_5', 100).valid).toBe(true);
    });
  });

  describe('addBet', () => {
    it('appends bet to room state', () => {
      const room = makeRoom();
      addBet(room, 'user1', 'red', 100);
      expect(room.rounds['round_1'].bets['user1'].length).toBe(1);
      const bet = room.rounds['round_1'].bets['user1'][0];
      expect(bet.type).toBe('red');
      expect(bet.amount).toBe(100);
      expect(bet.status).toBe('active');
      expect(bet.payout).toBe(0);
      expect(typeof bet.betId).toBe('string');
    });

    it('assigns unique betIds', () => {
      const room = makeRoom();
      addBet(room, 'user1', 'red', 100);
      addBet(room, 'user1', 'black', 50);
      const bets = room.rounds['round_1'].bets['user1'];
      expect(bets[0].betId).not.toBe(bets[1].betId);
    });
  });

  describe('getTotalBetsForRound', () => {
    it('sums active bet amounts', () => {
      const room = makeRoom();
      room.rounds['round_1'].bets['user1'] = [
        { status: 'active', amount: 100 },
        { status: 'active', amount: 200 },
      ];
      expect(getTotalBetsForRound(room, 'user1')).toBe(300);
    });

    it('returns 0 if no bets', () => {
      expect(getTotalBetsForRound(makeRoom(), 'user1')).toBe(0);
    });
  });

  describe('getBetLimit', () => {
    it('returns 1000 for outside bets', () => {
      expect(getBetLimit('red')).toBe(1000);
      expect(getBetLimit('dozen_1')).toBe(1000);
      expect(getBetLimit('column_2')).toBe(1000);
    });

    it('returns 500 for inside bets', () => {
      expect(getBetLimit('straight_5')).toBe(500);
      expect(getBetLimit('split_1_2')).toBe(500);
    });
  });
});

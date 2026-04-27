const { serializeRoom } = require('../../../utils/casino/roulette/serialization');

const makeRoom = (overrides = {}) => ({
  roomId: 'roulette_main',
  currentPhase: 'betting_open',
  participants: [
    { userId: 'user1', username: 'Alice', balance: 1000, isBot: false, left: false }
  ],
  roundId: 'round_1',
  rounds: {
    'round_1': {
      bets: { 'user1': [{ betId: 'bet1', type: 'red', amount: 100, status: 'active', payout: 0 }] },
      spinResult: null,
    }
  },
  lastSettlement: [],
  deadlineAt: Date.now() + 5000,
  ...overrides,
});

describe('serialization', () => {
  describe('serializeRoom', () => {
    it('includes room basics', () => {
      const s = serializeRoom(makeRoom());
      expect(s.roomId).toBe('roulette_main');
      expect(s.currentPhase).toBe('betting_open');
      expect(s.roundId).toBe('round_1');
    });

    it('includes participants with safe fields only', () => {
      const s = serializeRoom(makeRoom());
      expect(s.participants.length).toBe(1);
      expect(s.participants[0].userId).toBe('user1');
      expect(s.participants[0].username).toBe('Alice');
      expect(s.participants[0].balance).toBe(1000);
      expect(s.participants[0].left).toBe(false);
      expect(s.participants[0].isBot).toBeUndefined();
    });

    it('includes current round bets', () => {
      const s = serializeRoom(makeRoom());
      expect(s.currentRoundBets['user1'][0].type).toBe('red');
    });

    it('includes spinResult when present', () => {
      const room = makeRoom();
      room.rounds['round_1'].spinResult = { number: 5, color: 'red', timestamp: Date.now() };
      const s = serializeRoom(room);
      expect(s.spinResult.number).toBe(5);
    });

    it('spinResult is null when not yet spun', () => {
      const s = serializeRoom(makeRoom());
      expect(s.spinResult).toBeNull();
    });

    it('includes lastSettlement', () => {
      const room = makeRoom({ lastSettlement: [{ playerId: 'user1', displayChange: 100 }] });
      expect(serializeRoom(room).lastSettlement[0].displayChange).toBe(100);
    });

    it('includes secondsUntilPhaseEnd as positive number', () => {
      const s = serializeRoom(makeRoom());
      expect(typeof s.secondsUntilPhaseEnd).toBe('number');
      expect(s.secondsUntilPhaseEnd).toBeGreaterThan(0);
    });

    it('secondsUntilPhaseEnd is 0 when deadline passed', () => {
      const room = makeRoom({ deadlineAt: Date.now() - 1000 });
      expect(serializeRoom(room).secondsUntilPhaseEnd).toBe(0);
    });
  });
});

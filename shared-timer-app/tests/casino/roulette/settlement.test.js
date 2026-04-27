const { calculatePayouts, calculateBalanceChange, prepareSettlementUpdates } = require('../../../utils/casino/roulette/settlement');

describe('settlement', () => {
  const makeRoom = (spinNumber, bets) => ({
    roundId: 'round_1',
    rounds: {
      'round_1': {
        spinResult: { number: spinNumber, color: spinNumber === 0 ? 'green' : 'red' },
        bets,
      }
    }
  });

  describe('calculatePayouts', () => {
    it('marks red bet as won when spin is red number', () => {
      const room = makeRoom(1, { 'user1': [{ betId: 'b1', type: 'red', amount: 100, status: 'active' }] });
      const payouts = calculatePayouts(room);
      expect(payouts['user1'][0].status).toBe('won');
      expect(payouts['user1'][0].payout).toBe(100); // 100 * 1 (1:1 odds)
    });

    it('marks red bet as lost when spin is black number', () => {
      const room = makeRoom(2, { 'user1': [{ betId: 'b1', type: 'red', amount: 100, status: 'active' }] });
      const payouts = calculatePayouts(room);
      expect(payouts['user1'][0].status).toBe('lost');
      expect(payouts['user1'][0].payout).toBe(0);
    });

    it('calculates straight bet correctly (35:1)', () => {
      const room = makeRoom(5, { 'user1': [{ betId: 'b1', type: 'straight_5', amount: 50, status: 'active' }] });
      const payouts = calculatePayouts(room);
      expect(payouts['user1'][0].status).toBe('won');
      expect(payouts['user1'][0].payout).toBe(50 * 35);
    });

    it('handles multiple players', () => {
      const room = makeRoom(1, {
        'user1': [{ betId: 'b1', type: 'red', amount: 100, status: 'active' }],
        'user2': [{ betId: 'b2', type: 'black', amount: 200, status: 'active' }],
      });
      const payouts = calculatePayouts(room);
      expect(payouts['user1'][0].status).toBe('won');
      expect(payouts['user2'][0].status).toBe('lost');
    });

    it('handles mixed bets for same player', () => {
      const room = makeRoom(1, {
        'user1': [
          { betId: 'b1', type: 'red', amount: 100, status: 'active' },
          { betId: 'b2', type: 'black', amount: 100, status: 'active' },
          { betId: 'b3', type: 'straight_1', amount: 50, status: 'active' },
        ]
      });
      const payouts = calculatePayouts(room);
      expect(payouts['user1'][0].status).toBe('won');  // red wins
      expect(payouts['user1'][1].status).toBe('lost'); // black loses
      expect(payouts['user1'][2].status).toBe('won');  // straight_1 wins
    });
  });

  describe('calculateBalanceChange', () => {
    it('returns positive winnings for won bet', () => {
      expect(calculateBalanceChange({ amount: 100, status: 'won', payout: 100 })).toBe(100);
    });

    it('returns negative amount for lost bet', () => {
      expect(calculateBalanceChange({ amount: 100, status: 'lost', payout: 0 })).toBe(-100);
    });
  });

  describe('prepareSettlementUpdates', () => {
    it('calculates correct net displayChange per player', () => {
      const payouts = {
        'user1': [
          { betId: 'b1', amount: 100, status: 'won', payout: 100 },  // +100
          { betId: 'b2', amount: 50, status: 'lost', payout: 0 },    // -50
        ]
      };
      const updates = prepareSettlementUpdates(payouts);
      expect(updates.length).toBe(1);
      expect(updates[0].playerId).toBe('user1');
      expect(updates[0].displayChange).toBe(50); // +100 - 50
      expect(updates[0].payoutReturn).toBe(100 * (1 + 1)); // amount * (oddsFactor+1) for winner
    });
  });
});

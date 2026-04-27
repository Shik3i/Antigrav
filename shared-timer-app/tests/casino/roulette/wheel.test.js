const { spin, getColor } = require('../../../utils/casino/roulette/wheel');

describe('wheel', () => {
  describe('getColor', () => {
    it('returns green for 0', () => {
      expect(getColor(0)).toBe('green');
    });
    it('returns red for red numbers', () => {
      expect(getColor(1)).toBe('red');
      expect(getColor(3)).toBe('red');
      expect(getColor(32)).toBe('red');
    });
    it('returns black for black numbers', () => {
      expect(getColor(2)).toBe('black');
      expect(getColor(4)).toBe('black');
      expect(getColor(35)).toBe('black');
    });
  });

  describe('spin', () => {
    it('returns number 0-36', () => {
      const result = spin('round_123');
      expect(result.number).toBeGreaterThanOrEqual(0);
      expect(result.number).toBeLessThanOrEqual(36);
    });
    it('returns roundId, color, timestamp', () => {
      const result = spin('round_123');
      expect(result.roundId).toBe('round_123');
      expect(result.color).toMatch(/red|black|green/);
      expect(typeof result.timestamp).toBe('number');
    });
    it('color matches number', () => {
      const result = spin('round_123');
      expect(result.color).toBe(getColor(result.number));
    });
    it('generates varied results', () => {
      const results = Array.from({length: 50}, () => spin('test').number);
      expect(new Set(results).size).toBeGreaterThan(1);
    });
  });
});

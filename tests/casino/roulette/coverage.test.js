const { getBetCoverage, doesBetWin } = require('../../../utils/casino/roulette/coverage');

describe('coverage', () => {
  describe('getBetCoverage', () => {
    it('red covers 18 numbers', () => {
      const red = getBetCoverage('red');
      expect(red).toContain(1);
      expect(red).toContain(3);
      expect(red).toContain(32);
      expect(red.length).toBe(18);
    });

    it('black covers 18 numbers', () => {
      const black = getBetCoverage('black');
      expect(black).toContain(2);
      expect(black).toContain(4);
      expect(black.length).toBe(18);
    });

    it('odd covers 18 numbers', () => {
      const odd = getBetCoverage('odd');
      expect(odd).toContain(1);
      expect(odd).toContain(3);
      expect(odd.length).toBe(18);
    });

    it('even covers 18 numbers', () => {
      const even = getBetCoverage('even');
      expect(even).toContain(2);
      expect(even).toContain(4);
      expect(even.length).toBe(18);
    });

    it('range_1to18 covers exactly 1-18', () => {
      expect(getBetCoverage('range_1to18')).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]);
    });

    it('range_19to36 covers exactly 19-36', () => {
      const r = getBetCoverage('range_19to36');
      expect(r.length).toBe(18);
      expect(r[0]).toBe(19);
      expect(r[17]).toBe(36);
    });

    it('dozens cover correct 12 numbers each', () => {
      expect(getBetCoverage('dozen_1')).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
      expect(getBetCoverage('dozen_2')).toEqual([13,14,15,16,17,18,19,20,21,22,23,24]);
      expect(getBetCoverage('dozen_3')).toEqual([25,26,27,28,29,30,31,32,33,34,35,36]);
    });

    it('columns cover correct 12 numbers each', () => {
      expect(getBetCoverage('column_1')).toEqual([1,4,7,10,13,16,19,22,25,28,31,34]);
      expect(getBetCoverage('column_2')).toEqual([2,5,8,11,14,17,20,23,26,29,32,35]);
      expect(getBetCoverage('column_3')).toEqual([3,6,9,12,15,18,21,24,27,30,33,36]);
    });

    it('straight_5 covers only [5]', () => {
      expect(getBetCoverage('straight_5')).toEqual([5]);
    });

    it('straight_0 covers only [0]', () => {
      expect(getBetCoverage('straight_0')).toEqual([0]);
    });

    it('split_1_2 covers [1, 2]', () => {
      expect(getBetCoverage('split_1_2')).toEqual([1, 2]);
    });

    it('street_1_2_3 covers [1, 2, 3]', () => {
      expect(getBetCoverage('street_1_2_3')).toEqual([1, 2, 3]);
    });

    it('corner_1_2_4_5 covers [1, 2, 4, 5]', () => {
      expect(getBetCoverage('corner_1_2_4_5')).toEqual([1, 2, 4, 5]);
    });

    it('sixline_1_2_3_4_5_6 covers [1,2,3,4,5,6]', () => {
      expect(getBetCoverage('sixline_1_2_3_4_5_6')).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('throws for unknown bet type', () => {
      expect(() => getBetCoverage('unknown')).toThrow();
    });

    it('throws for null/undefined', () => {
      expect(() => getBetCoverage(null)).toThrow();
      expect(() => getBetCoverage(undefined)).toThrow();
    });
  });

  describe('doesBetWin', () => {
    it('returns true if spinNumber in coverage', () => {
      expect(doesBetWin('red', 1)).toBe(true);
      expect(doesBetWin('red', 2)).toBe(false);
      expect(doesBetWin('odd', 3)).toBe(true);
      expect(doesBetWin('dozen_1', 12)).toBe(true);
      expect(doesBetWin('straight_5', 5)).toBe(true);
      expect(doesBetWin('straight_5', 4)).toBe(false);
    });
  });
});

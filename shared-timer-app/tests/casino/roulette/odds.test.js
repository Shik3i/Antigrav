const { getOdds } = require('../../../utils/casino/roulette/odds');

describe('odds', () => {
  it('should return correct odds for outside bets', () => {
    expect(getOdds('red')).toBe(1);
    expect(getOdds('black')).toBe(1);
    expect(getOdds('odd')).toBe(1);
    expect(getOdds('even')).toBe(1);
    expect(getOdds('range_1to18')).toBe(1);
    expect(getOdds('range_19to36')).toBe(1);
  });

  it('should return correct odds for dozen/column bets', () => {
    expect(getOdds('dozen_1')).toBe(2);
    expect(getOdds('dozen_2')).toBe(2);
    expect(getOdds('column_1')).toBe(2);
  });

  it('should return correct odds for inside bets', () => {
    expect(getOdds('straight_5')).toBe(35);
    expect(getOdds('split_5')).toBe(17);
    expect(getOdds('street_5')).toBe(11);
    expect(getOdds('corner_5')).toBe(8);
    expect(getOdds('sixline_5')).toBe(5);
  });

  it('should throw for unknown bet type', () => {
    expect(() => getOdds('unknown_bet')).toThrow();
  });
});

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function getBetCoverage(betType) {
  if (typeof betType !== 'string' || !betType) {
    throw new Error(`Invalid bet type: ${betType}`);
  }

  if (betType === 'red') return RED_NUMBERS.slice();
  if (betType === 'black') return Array.from({length: 36}, (_, i) => i + 1).filter(n => !RED_NUMBERS.includes(n));
  if (betType === 'odd') return Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 1);
  if (betType === 'even') return Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 0);
  if (betType === 'range_1to18') return Array.from({length: 18}, (_, i) => i + 1);
  if (betType === 'range_19to36') return Array.from({length: 18}, (_, i) => i + 19);
  if (betType === 'dozen_1') return Array.from({length: 12}, (_, i) => i + 1);
  if (betType === 'dozen_2') return Array.from({length: 12}, (_, i) => i + 13);
  if (betType === 'dozen_3') return Array.from({length: 12}, (_, i) => i + 25);
  if (betType === 'column_1') return [1,4,7,10,13,16,19,22,25,28,31,34];
  if (betType === 'column_2') return [2,5,8,11,14,17,20,23,26,29,32,35];
  if (betType === 'column_3') return [3,6,9,12,15,18,21,24,27,30,33,36];

  if (betType.startsWith('straight_')) {
    const num = parseInt(betType.split('_')[1], 10);
    if (isNaN(num)) throw new Error(`Invalid straight bet: ${betType}`);
    return [num];
  }

  const insidePrefixes = ['split_', 'street_', 'corner_', 'sixline_'];
  for (const prefix of insidePrefixes) {
    if (betType.startsWith(prefix)) {
      const parts = betType.slice(prefix.length).split('_').map(p => parseInt(p, 10));
      if (parts.some(isNaN)) throw new Error(`Invalid ${prefix} bet: ${betType}`);
      return parts;
    }
  }

  throw new Error(`Unknown bet type: ${betType}`);
}

function doesBetWin(betType, spinNumber) {
  return getBetCoverage(betType).includes(spinNumber);
}

module.exports = { getBetCoverage, doesBetWin };

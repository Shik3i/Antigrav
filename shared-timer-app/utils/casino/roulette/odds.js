const ODDS = {
  'red': 1,
  'black': 1,
  'odd': 1,
  'even': 1,
  'range_1to18': 1,
  'range_19to36': 1,
  'dozen_1': 2,
  'dozen_2': 2,
  'dozen_3': 2,
  'column_1': 2,
  'column_2': 2,
  'column_3': 2,
  'straight': 35,
  'split': 17,
  'street': 11,
  'corner': 8,
  'sixline': 5,
};

function getOdds(betType) {
  if (typeof betType !== 'string' || !betType) {
    throw new Error(`Invalid bet type: ${betType}`);
  }

  if (betType.includes('_')) {
    const [baseType] = betType.split('_');
    if (ODDS[baseType] !== undefined) {
      return ODDS[baseType];
    }
  }

  if (ODDS[betType] === undefined) {
    throw new Error(`Unknown bet type: ${betType}`);
  }

  return ODDS[betType];
}

module.exports = {
  getOdds,
  ODDS,
};

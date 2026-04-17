const TOWER_CLIMB_CONFIG = {
  gameId: 'tower_climb',
  displayName: 'Tower Climb',
  levelCount: 8,
  minBet: 100,
  maxBet: 250000,
  allowedTilesPerLevel: [2, 3, 4, 5],
  houseEdge: 0.96,
  levelProgression: 0.035
};

const round4 = (value) => Math.round(value * 10000) / 10000;

function getTowerStepMultiplier(tilesPerLevel, levelIndex) {
  const safeTiles = tilesPerLevel - 1;
  if (safeTiles <= 0) {
    throw new Error('Tower Climb requires at least 2 tiles per level.');
  }

  // Start from the fair odds for one successful pick, then apply a small house edge
  // and a progressive level boost so later floors feel more valuable.
  const fairStep = tilesPerLevel / safeTiles;
  const progressionBoost = 1 + (levelIndex * TOWER_CLIMB_CONFIG.levelProgression);
  return round4(fairStep * TOWER_CLIMB_CONFIG.houseEdge * progressionBoost);
}

function getTowerMultiplierTable(tilesPerLevel) {
  let currentMultiplier = 1;
  const multipliers = [1];

  for (let levelIndex = 0; levelIndex < TOWER_CLIMB_CONFIG.levelCount; levelIndex++) {
    currentMultiplier *= getTowerStepMultiplier(tilesPerLevel, levelIndex);
    multipliers.push(round4(currentMultiplier));
  }

  return multipliers;
}

function getTowerPayout(betAmount, tilesPerLevel, clearedLevels) {
  const multipliers = getTowerMultiplierTable(tilesPerLevel);
  const levelIndex = Math.max(0, Math.min(clearedLevels, TOWER_CLIMB_CONFIG.levelCount));
  return Math.floor(betAmount * multipliers[levelIndex]);
}

function getTowerConfigPayload() {
  const multiplierPreviews = {};

  for (const tilesPerLevel of TOWER_CLIMB_CONFIG.allowedTilesPerLevel) {
    multiplierPreviews[tilesPerLevel] = getTowerMultiplierTable(tilesPerLevel);
  }

  return {
    ...TOWER_CLIMB_CONFIG,
    multiplierPreviews
  };
}

module.exports = {
  TOWER_CLIMB_CONFIG,
  getTowerStepMultiplier,
  getTowerMultiplierTable,
  getTowerPayout,
  getTowerConfigPayload
};

const dbLayer = require('../database');
const {
  TOWER_CLIMB_CONFIG,
  getTowerConfigPayload
} = require('../config/towerClimb');

const getUserId = (req) => req.user?.userId || req.user?.id;

const emitBalanceUpdate = (req, userId, balance) => {
  const io = req.app?.get('socketio');
  if (io && userId && Number.isFinite(balance)) {
    io.to(userId).emit('COIN_BALANCE_UPDATE', { balance });
  }
};

const parseInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : NaN;
};

exports.getConfig = async (req, res) => {
  try {
    const globalStats = await dbLayer.getGlobalGameStats('tower-climb');
    res.json({
      ...getTowerConfigPayload(),
      globalTotalPayout: globalStats.total_won,
      globalTotalWins: globalStats.total_count,
      globalTotalPlayed: globalStats.total_played
    });
  } catch (err) {
    console.error('[TowerClimb] Error fetching config:', err);
    res.status(500).json({ error: 'Failed to fetch tower config' });
  }
};

exports.getState = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const [activeRound, latestRound] = await Promise.all([
      dbLayer.getActiveTowerRound(userId),
      dbLayer.getLatestTowerRound(userId)
    ]);

    res.json({
      config: getTowerConfigPayload(),
      activeRound,
      latestRound
    });
  } catch (err) {
    console.error('[TowerClimb] Error fetching state:', err);
    res.status(500).json({ error: 'Failed to fetch tower state' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const history = await dbLayer.getTowerHistory(userId, 12);
    res.json({ history });
  } catch (err) {
    console.error('[TowerClimb] Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch tower history' });
  }
};

exports.startRound = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const bet = parseInteger(req.body.bet);
    const tilesPerLevel = parseInteger(req.body.tilesPerLevel);

    if (!Number.isFinite(bet) || bet < TOWER_CLIMB_CONFIG.minBet || bet > TOWER_CLIMB_CONFIG.maxBet) {
      return res.status(400).json({
        error: `Bet must be between ${TOWER_CLIMB_CONFIG.minBet} and ${TOWER_CLIMB_CONFIG.maxBet}.`
      });
    }

    if (!TOWER_CLIMB_CONFIG.allowedTilesPerLevel.includes(tilesPerLevel)) {
      return res.status(400).json({ error: 'Invalid tile count.' });
    }

    const result = await dbLayer.startTowerRound(userId, bet, tilesPerLevel);
    emitBalanceUpdate(req, userId, result.newBalance);

    res.status(201).json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: err.message,
        activeRound: err.activeRound || null
      });
    }
    
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      const activeRound = await dbLayer.getActiveTowerRound(getUserId(req));
      return res.status(400).json({
        error: 'You already have an active round.',
        activeRound
      });
    }

    console.error('[TowerClimb] Error starting round:', err);
    res.status(500).json({ error: 'Failed to start tower round' });
  }
};

exports.pickTile = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const tileIndex = parseInteger(req.body.tileIndex);
    const expectedLevel = parseInteger(req.body.expectedLevel);
    if (!Number.isFinite(tileIndex) || tileIndex < 0) {
      return res.status(400).json({ error: 'Valid tileIndex required.' });
    }
    if (!Number.isFinite(expectedLevel) || expectedLevel < 0) {
      return res.status(400).json({ error: 'Valid expectedLevel required.' });
    }

    const result = await dbLayer.resolveTowerPick(userId, tileIndex, expectedLevel);
    emitBalanceUpdate(req, userId, result.newBalance);

    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[TowerClimb] Error resolving pick:', err);
    res.status(500).json({ error: 'Failed to resolve tower pick' });
  }
};

exports.cashoutRound = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const result = await dbLayer.cashoutTowerRound(userId);
    emitBalanceUpdate(req, userId, result.newBalance);

    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[TowerClimb] Error cashing out:', err);
    res.status(500).json({ error: 'Failed to cash out tower round' });
  }
};

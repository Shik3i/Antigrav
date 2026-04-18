const dbLayer = require('../database');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const DEFAULT_MAX_PLAYERS = 5;
const DEFAULT_ROOM_ID = 'blackjack-main-5';

const getUserId = (req) => req.user?.userId || req.user?.id || null;

const getIo = (req) => req.app?.get('io') || req.app?.get('socketio') || null;

const emitBalanceUpdates = (req, updates = []) => {
  const io = getIo(req);
  if (!io) return;

  updates.forEach((entry) => {
    if (entry?.userId && Number.isFinite(entry?.balance)) {
      io.to(entry.userId).emit('COIN_BALANCE_UPDATE', { balance: entry.balance });
    }
  });
};

function resolveRoomRequest(req) {
  const maxPlayers = Number.parseInt(req.query.maxPlayers || req.body?.maxPlayers || DEFAULT_MAX_PLAYERS, 10);
  const safeMaxPlayers = maxPlayers === 3 ? 3 : 5;
  const roomId = req.query.roomId || req.body?.roomId || `blackjack-main-${safeMaxPlayers}`;
  return { roomId, maxPlayers: safeMaxPlayers };
}

exports.getConfig = async (req, res) => {
  res.json({
    deckCount: 6,
    reshuffleRemainingPercent: 25,
    burnCard: true,
    allowedBets: [1, 5, 10, 50, 100, 500, 1000],
    maxPlayersOptions: [3, 5],
    defaultRoomId: DEFAULT_ROOM_ID
  });
};

exports.getRooms = async (req, res) => {
  try {
    const maxPlayers = req.query.maxPlayers ? Number.parseInt(req.query.maxPlayers, 10) : null;
    const rooms = blackjackRoomManager.listRooms()
      .filter((room) => (maxPlayers ? room.maxPlayers === (maxPlayers === 3 ? 3 : 5) : true));

    res.json({ rooms });
  } catch (err) {
    console.error('[Blackjack] Error fetching rooms:', err);
    res.status(500).json({ error: 'Failed to fetch blackjack rooms' });
  }
};

exports.getState = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { roomId, maxPlayers } = resolveRoomRequest(req);
    blackjackRoomManager.getOrCreateRoom(roomId, maxPlayers);
    const state = blackjackRoomManager.getRoomState(roomId, userId);
    res.json({ roomId, state });
  } catch (err) {
    console.error('[Blackjack] Error fetching room state:', err);
    res.status(500).json({ error: 'Failed to fetch blackjack room state' });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const sortBy = req.query.sortBy || 'totalWon';
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const leaderboard = await dbLayer.getBlackjackLeaderboard(sortBy, limit);
    res.json({ sortBy, leaderboard });
  } catch (err) {
    console.error('[Blackjack] Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch blackjack leaderboard' });
  }
};

exports.joinTable = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await dbLayer.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { roomId, maxPlayers } = resolveRoomRequest(req);
    blackjackRoomManager.joinRoom(roomId, {
      userId,
      username: user.username || user.displayName,
      displayName: user.displayName || user.username
    }, maxPlayers);

    res.json({
      success: true,
      roomId,
      state: blackjackRoomManager.getRoomState(roomId, userId)
    });
  } catch (err) {
    const status = err.message?.includes('full') ? 409 : 400;
    res.status(status).json({ error: err.message || 'Failed to join blackjack table' });
  }
};

exports.leaveTable = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { roomId } = resolveRoomRequest(req);
    const room = blackjackRoomManager.leaveRoom(roomId, userId);
    res.json({
      success: true,
      roomId,
      state: room ? blackjackRoomManager.getRoomState(roomId, userId) : null
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to leave blackjack table' });
  }
};

exports.applySettlement = async (req, settlement = []) => {
  const updates = await dbLayer.applyBlackjackSettlement(settlement);
  emitBalanceUpdates(req, updates);
  return updates;
};

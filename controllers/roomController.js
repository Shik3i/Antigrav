const dbLayer = require('../database');
const roomManager = require('../roomManager');
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../jwtSecret');
const sanitize = require('../sanitize');
const EVENTS = require('../socketEvents.json');
const fs = require('fs');
const path = require('path');
const roulette = require('../utils/casino/roulette');

let _broadcastCoinUpdate = null;
function initRouletteBroadcast(fn) { _broadcastCoinUpdate = fn; }
exports.initRouletteBroadcast = initRouletteBroadcast;

// --- Room Management ---
exports.getRooms = async (req, res, next) => {
    let friendIds = new Set();
    if (req.user && req.user.userId) {
        try {
            const friendsRaw = await dbLayer.getFriends(req.user.userId);
            friendsRaw.forEach(f => {
                if (f.status === 'accepted') {
                    friendIds.add(f.id);
                }
            });
        } catch (e) {
            console.error("Failed to fetch friends for getRooms:", e);
        }
    }

    const activePublicRooms = Array.from(roomManager.rooms.values())
        .filter(r => {
            const isPublic = r.config.isPublic;
            const isFriendOfOwner = friendIds.has(r.config.ownerId);
            const isVisibleToFriends = r.config.visibleToFriends;
            const isActive = r.users.size > 0 || r.timeoutId !== null;
            if (!isActive) return false;
            return isPublic || (isVisibleToFriends && isFriendOfOwner);
        })
        .map(r => {
            const state = roomManager.getRoomState(r.id);
            return {
                id: r.id,
                name: r.config.name,
                isPublic: r.config.isPublic,
                defaultDurationMinutes: r.config.defaultDurationMinutes,
                activeUsers: state ? state.users.length : 0,
                isRunning: state ? state.state.isRunning : false
            };
        });

    res.json(activePublicRooms);
};

exports.createRoom = async (req, res, next) => {
    const { id, name, isPublic, defaultDurationMinutes, ownerId, defaultRole, visibleToFriends } = req.body;
    try {
        roomManager.createRoom(
            id,
            sanitize(name),
            defaultDurationMinutes,
            isPublic,
            visibleToFriends,
            ownerId,
            defaultRole
        );

        const readToken = jwt.sign({ roomId: id, role: 'read' }, JWT_SECRET);
        const writeToken = jwt.sign({ roomId: id, role: 'write' }, JWT_SECRET);

        res.json({ success: true, readToken, writeToken });
    } catch (err) {
        next(err);
    }
};

exports.broadcastMediaCommand = async (req, res, next) => {
    const { id } = req.params;
    const { action } = req.body;

    if (action !== 'play' && action !== 'pause') {
        return res.status(400).json({ error: 'Invalid action. Only "play" or "pause" allowed.' });
    }

    try {
        const io = req.app.get('io');
        if (io) {
            io.to(id).emit('media_command', { action });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Media broadcast error:', err);
        next(err);
    }
};

// --- Test/Debug Actions ---
exports.testDbRooms = (req, res) => {
    const roomsList = [];
    roomManager.rooms.forEach((room, roomId) => {
        roomsList.push(roomManager.getRoomState(roomId));
    });
    res.json(roomsList);
};

exports.testRoomAction = async (req, res, next) => {
    const { id } = req.params;
    const { action, payload } = req.body;

    try {
        let room = roomManager.getRoom(id);
        if (!room) {
            return res.status(404).json({ success: false, error: 'Room not found in memory' });
        }

        const result = roomManager._applyTimerAction(id, { type: action, payload }, Date.now());
        if (!result.ok) {
            return res.status(400).json({ success: false, error: result.error });
        }
        const changed = result.changed;

        if (changed) {
            const io = req.app.get('io');
            if (io) {
                io.to(id).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(id));
            }
        }

        res.json({ success: true, changed, state: roomManager.getRoomState(id) });
    } catch (err) {
        console.error('API action error:', err);
        next(err);
    }
};

// --- Countdowns ---
exports.getCountdowns = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || null;
        const countdowns = await dbLayer.getCountdowns(userId);
        res.json(countdowns);
    } catch (err) {
        console.error('[Countdowns] Error fetching:', err);
        res.status(500).json({ error: 'Failed to fetch countdowns' });
    }
};

exports.createCountdown = async (req, res) => {
    try {
        const { eventName, targetDate, isPublic, isGlobal } = req.body;
        if (!eventName || !targetDate) {
            return res.status(400).json({ error: 'eventName and targetDate are required' });
        }

        const isAdmin = req.user?.is_superadmin || false;
        const userId = req.user?.id || req.user?.userId || null;
        const displayName = req.user?.displayName || req.user?.username || 'Unknown';

        if (isGlobal && !isAdmin) {
            return res.status(403).json({ error: 'Only superadmins can create global countdowns' });
        }

        const result = await dbLayer.createCountdown(
            sanitize(eventName),
            targetDate,
            userId,
            displayName,
            isPublic || false,
            isGlobal || false
        );
        res.status(201).json({ id: result.id, message: 'Countdown created' });
    } catch (err) {
        console.error('[Countdowns] Error creating:', err);
        res.status(500).json({ error: 'Failed to create countdown' });
    }
};

exports.deleteCountdown = async (req, res) => {
    try {
        const { id } = req.params;
        const countdown = await dbLayer.getCountdownById(id);
        if (!countdown) {
            return res.status(404).json({ error: 'Countdown not found' });
        }

        const isAdmin = req.user?.is_superadmin || false;
        const currentUserId = req.user?.id || req.user?.userId;

        const isOwner = countdown.userId === currentUserId && currentUserId !== null && currentUserId !== undefined;

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        await dbLayer.deleteCountdown(id);
        res.json({ message: 'Countdown deleted' });
    } catch (err) {
        console.error('[Countdowns] Error deleting:', err);
        res.status(500).json({ error: 'Failed to delete countdown' });
    }
};

// --- Feature Requests ---
exports.getFeatureRequests = async (req, res) => {
    try {
        const features = await dbLayer.getFeatureRequests();
        res.json(features);
    } catch (err) {
        console.error('[Features] Error fetching:', err);
        res.status(500).json({ error: 'Failed to fetch feature requests' });
    }
};

exports.createFeatureRequest = async (req, res) => {
    try {
        const { title, description, type } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });

        const userId = req.user?.id || req.user?.userId;
        const userName = req.user?.displayName || req.user?.username || 'Unknown';

        const id = await dbLayer.createFeatureRequest(userId, userName, sanitize(title), sanitize(description || ''), sanitize(type || 'Feature'));
        res.status(201).json({ id, message: 'Feature request created' });
    } catch (err) {
        console.error('[Features] Error creating:', err);
        res.status(500).json({ error: 'Failed to create feature request' });
    }
};

exports.voteFeatureRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { value, guestId } = req.body;
        const userId = req.user?.id || req.user?.userId || guestId;

        if (!userId) {
            return res.status(401).json({ error: 'Login required or guest identification missing' });
        }

        if (value !== 1 && value !== -1) {
            return res.status(400).json({ error: 'Invalid vote value' });
        }

        await dbLayer.voteFeatureRequest(id, userId, value);
        res.json({ success: true });
    } catch (err) {
        console.error('[Features] Error voting:', err);
        res.status(500).json({ error: 'Failed to vote' });
    }
};

exports.updateFeatureStatus = async (req, res) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        const { status } = req.body;
        await dbLayer.updateFeatureStatus(id, status);
        res.json({ success: true });
    } catch (err) {
        console.error('[Features] Error updating status:', err);
        res.status(500).json({ error: 'Failed to update feature status' });
    }
};

exports.updateFeatureAdminComment = async (req, res) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        const { comment } = req.body;
        await dbLayer.updateFeatureAdminComment(id, sanitize(comment || ''));
        res.json({ success: true });
    } catch (err) {
        console.error('[Features] Error updating admin comment:', err);
        res.status(500).json({ error: 'Failed to update admin comment' });
    }
};

exports.deleteFeatureRequest = async (req, res) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        await dbLayer.deleteFeatureRequest(id);
        res.json({ success: true });
    } catch (err) {
        console.error('[Features] Error deleting:', err);
        res.status(500).json({ error: 'Failed to delete feature request' });
    }
};

// --- Roulette ---

const rouletteRooms = new Map();

function getRouletteRoom() {
  let room = rouletteRooms.get('roulette_main');
  if (!room) {
    room = roulette.initializeRoom();
    rouletteRooms.set('roulette_main', room);
  }
  return room;
}

function setRouletteRoom(room) {
  rouletteRooms.set(room.roomId, room);
}

async function rouletteJoinTable(userId, username, balance, skin = 'default') {
  let room = getRouletteRoom();
  room = roulette.addParticipant(room, userId, username, balance);
  if (!room.playerSkins) room.playerSkins = {};
  room.playerSkins[String(userId)] = skin;
  setRouletteRoom(room);
  return { success: true, room: roulette.serializeRoom(room) };
}

function rouletteSetSkin(userId, skin) {
  const room = getRouletteRoom();
  if (!room.playerSkins) room.playerSkins = {};
  room.playerSkins[String(userId)] = skin;
  setRouletteRoom(room);
}

async function rouletteLeaveTable(userId) {
  let room = getRouletteRoom();
  room = roulette.removeParticipant(room, userId);
  setRouletteRoom(room);
  return { success: true };
}

async function roulettePlaceBet(userId, betType, amount) {
  let room = getRouletteRoom();

  const validation = roulette.validateBet(room, userId, betType, amount);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Deduct balance upfront — amount is KC, addKoalaCoins expects cents
  const newBalanceCents = await dbLayer.addKoalaCoins(userId, -amount * 100, `roulette_bet:${room.roundId}`);
  if (_broadcastCoinUpdate) _broadcastCoinUpdate(userId, newBalanceCents);

  // Update participant balance in room state
  const participant = room.participants.find(p => String(p.userId) === String(userId));
  if (participant) participant.balance = Math.floor(newBalanceCents / 100);

  roulette.addBet(room, userId, betType, amount);
  setRouletteRoom(room);

  return { success: true, room: roulette.serializeRoom(room) };
}

async function rouletteRemoveBet(userId, betType) {
  let room = getRouletteRoom();
  if (room.currentPhase !== 'betting_open') {
    return { success: false, error: 'Betting is not open' };
  }
  const removed = roulette.removeLastBet(room, userId, betType);
  if (!removed) {
    return { success: false, error: 'No bet to remove on this field' };
  }
  const newBalanceCents = await dbLayer.addKoalaCoins(userId, removed.amount * 100, `roulette_remove_bet:${room.roundId}`);
  if (_broadcastCoinUpdate) _broadcastCoinUpdate(userId, newBalanceCents);
  const participant = room.participants.find(p => String(p.userId) === String(userId));
  if (participant) participant.balance = Math.floor(newBalanceCents / 100);
  setRouletteRoom(room);
  return { success: true };
}

function rouletteGetRoom() {
  return roulette.serializeRoom(getRouletteRoom());
}

function roulettePlayerReady(userId) {
  let room = getRouletteRoom();
  if (room.currentPhase !== 'betting_open') {
    return { success: false, error: 'Not in betting phase.' };
  }
  const isParticipant = room.participants.some(p => String(p.userId) === String(userId) && !p.left);
  if (!isParticipant) {
    return { success: false, error: 'Not at the table.' };
  }
  if (!room.readyPlayers) room.readyPlayers = new Set();
  room.readyPlayers.add(String(userId));

  const active = room.participants.filter(p => !p.left);
  if (active.length > 0 && room.readyPlayers.size >= active.length) {
    // All players ready — close betting immediately
    room.deadlineAt = Date.now();
  }
  setRouletteRoom(room);
  return { success: true, readyCount: room.readyPlayers.size, activeCount: active.length };
}

function rouletteGetParticipants() {
  return getRouletteRoom().participants.map(({ userId, username, balance, left }) => ({
    userId, username, balance, left,
  }));
}

async function _rouletteSettleRound(room) {
  const payouts = roulette.calculatePayouts(room);
  const updates = roulette.prepareSettlementUpdates(payouts);

  for (const update of updates) {
    const participant = room.participants.find(p => String(p.userId) === String(update.playerId));
    // Update sessionPnl for every player (winners and losers)
    if (participant) {
      participant.sessionPnl = (participant.sessionPnl || 0) + update.displayChange;
    }
    if (update.payoutReturn > 0) {
      // Credit principal + winnings — payoutReturn is KC, addKoalaCoins expects cents
      const newBalanceCents = await dbLayer.addKoalaCoins(update.playerId, update.payoutReturn * 100, `roulette_settlement:${room.roundId}`);
      if (_broadcastCoinUpdate) _broadcastCoinUpdate(update.playerId, newBalanceCents);
      if (participant) participant.balance = Math.floor(newBalanceCents / 100);
    }
  }

  room.lastSettlement = updates;
  room.lastPayouts = payouts; // per-player per-bet win/loss detail
}

async function _roulettePhaseTickImpl() {
  let room = getRouletteRoom();
  if (!room.deadlineAt || Date.now() < room.deadlineAt) return;

  const wasSpinPhase = room.currentPhase === 'spin';

  // Transition FIRST (synchronous) so next tick sees the new deadline — prevents double-fire
  room = roulette.transitionPhase(room);
  setRouletteRoom(room);

  // Then settle async; roundId is unchanged after spin→settlement transition
  if (wasSpinPhase) {
    await _rouletteSettleRound(room);
    setRouletteRoom(room); // persist lastSettlement
  }
}

function _roulettePhaseTick() {
  _roulettePhaseTickImpl().catch(err => {
    console.error('[roulette] phase tick error:', err);
  });
}

const _roulettePhaseTimer = setInterval(_roulettePhaseTick, 500);

exports.rouletteJoinTable = rouletteJoinTable;
exports.rouletteLeaveTable = rouletteLeaveTable;
exports.roulettePlaceBet = roulettePlaceBet;
exports.rouletteRemoveBet = rouletteRemoveBet;
exports.rouletteGetRoom = rouletteGetRoom;
exports.rouletteGetParticipants = rouletteGetParticipants;
exports.rouletteSetSkin = rouletteSetSkin;
exports.roulettePlayerReady = roulettePlayerReady;

// --- Maintenance ---
let changelogCache = null;
exports.getChangelog = async (req, res, next) => {
    try {
        if (changelogCache) return res.json(changelogCache);

        const changelogPath = path.resolve(process.cwd(), 'src/data/changelog.json');
        if (fs.existsSync(changelogPath)) {
            const fileData = fs.readFileSync(changelogPath, 'utf8');
            changelogCache = JSON.parse(fileData);
        } else {
            changelogCache = [];
        }

        res.json(changelogCache);
    } catch (err) {
        next(err);
    }
};

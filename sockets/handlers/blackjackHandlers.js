const blackjackRoomManager = require('../../utils/blackjackRoomManager');
const dbLayer = require('../../database');
const EVENTS = require('../../socketEvents.json');
const { BLACKJACK_ROOM_PREFIX } = require('../constants');

function getBlackjackSocketRoom(roomId) {
    return `${BLACKJACK_ROOM_PREFIX}${roomId}`;
}

function emitBlackjackState(io, roomId) {
    const state = blackjackRoomManager.getRoomState(roomId);
    if (state) {
        io.to(getBlackjackSocketRoom(roomId)).emit(EVENTS.BLACKJACK_STATE, state);
    }
    return state;
}

function emitBlackjackRooms(io, targetSocket = null) {
    const rooms = blackjackRoomManager.listRooms();
    if (targetSocket) {
        targetSocket.emit(EVENTS.BLACKJACK_ROOMS, rooms);
        return rooms;
    }
    io.emit(EVENTS.BLACKJACK_ROOMS, rooms);
    return rooms;
}

async function persistBlackjackSettlementIfNeeded(roomId) {
    const room = blackjackRoomManager.rooms.get(roomId);
    if (!room?.lastSettlement?.length || !room.lastSettlementRoundId) {
        return [];
    }

    if (room.lastAppliedSettlementRoundId === room.lastSettlementRoundId) {
        return [];
    }

    const balanceUpdates = await dbLayer.applyBlackjackSettlement(room.lastSettlement.filter((entry) => !entry?.isBot));
    room.lastAppliedSettlementRoundId = room.lastSettlementRoundId;

    (Array.isArray(balanceUpdates) ? balanceUpdates : []).forEach((entry) => {
        broadcastCoinUpdate(io, entry.userId, entry.balance);
    });

    return Array.isArray(balanceUpdates) ? balanceUpdates : [];
}

function getBlackjackPlayer(roomId, userId) {
    const room = blackjackRoomManager.getRoom(roomId);
    const player = room?.players?.find((entry) => String(entry.userId) === String(userId)) || null;
    return { room, player };
}

async function applyBlackjackBetDeltaAndBroadcast(userId, deltaCents, reason) {
    const newBalance = await dbLayer.applyBlackjackBetDelta(userId, deltaCents, reason);
    broadcastCoinUpdate(io, userId, newBalance);
    return newBalance;
}

async function persistBlackjackRoundBuyInIfNeeded(roomId) {
    const room = blackjackRoomManager.getRoom(roomId);
    if (!room) {
        return [];
    }

    const hasStartedRound = ['dealing', 'player_turns', 'dealer_turn', 'settlement'].includes(room.status);
    if (!hasStartedRound || room.lastAppliedBuyInRoundId === room.roundId) {
        return [];
    }

    const buyInEntries = (room.players || [])
        .filter((player) => !player?.isBot && Number(player?.currentBet || 0) > 0)
        .map((player) => ({
            userId: player.userId,
            amount: Number(player.currentBet || 0),
            sideBetAmount: Object.values(player.activeSideBets || {}).reduce((sum, amount) => sum + (Number(amount) || 0), 0)
        }));

    const balanceUpdates = await dbLayer.applyBlackjackRoundBuyIn(buyInEntries);
    room.lastAppliedBuyInRoundId = room.roundId;

    (Array.isArray(balanceUpdates) ? balanceUpdates : []).forEach((entry) => {
        broadcastCoinUpdate(io, entry.userId, entry.balance);
    });

    return Array.isArray(balanceUpdates) ? balanceUpdates : [];
}

async function startBlackjackRoundWithBuyIn(roomId, startedByUserId) {
    blackjackRoomManager.startRound(roomId, startedByUserId);
    try {
        await persistBlackjackRoundBuyInIfNeeded(roomId);
    } catch (err) {
        const room = blackjackRoomManager.getRoom(roomId);
        if (room) {
            room.lastAppliedBuyInRoundId = null;
        }
        throw err;
    }
}

function emitBlackjackStateAndRooms(roomId, viewerUserId = null) {
    const state = roomId ? blackjackRoomManager.getRoomState(roomId, viewerUserId) : null;
    if (roomId && state) {
        io.to(getBlackjackSocketRoom(roomId)).emit(EVENTS.BLACKJACK_STATE, state);
    }
    emitBlackjackRooms(io);
    return state;
}

function leaveBlackjackRoomForUser(roomId, userId) {
    if (!roomId || !userId) return null;
    blackjackRoomManager.leaveRoom(roomId, userId);
    socket.leave(getBlackjackSocketRoom(roomId));
    socket.data.blackjackRoomId = null;
    return emitBlackjackStateAndRooms(roomId, userId);
}

async function switchBlackjackRoomForUser({ userId, targetRoomId, socketOnly = false }) {
    const activeRoomId = socketOnly
        ? socket.data.blackjackRoomId || null
        : blackjackRoomManager.getPlayerRoomId(userId);

    if (activeRoomId && activeRoomId !== targetRoomId) {
        blackjackRoomManager.leaveRoom(activeRoomId, userId);
        socket.leave(getBlackjackSocketRoom(activeRoomId));
        emitBlackjackState(io, activeRoomId);
    }

    const user = await dbLayer.getUser(userId);
    if (!user) {
        throw new Error('User not found.');
    }

    // Parse preferences if they are stored as a JSON string
    let prefs = user.preferences || {};
    if (typeof prefs === 'string') {
        try {
            prefs = JSON.parse(prefs);
        } catch (e) {
            prefs = {};
        }
    }

    blackjackRoomManager.joinRoom(targetRoomId, {
        userId,
        username: user.username || user.displayName,
        displayName: user.displayName || user.username,
        preferences: prefs
    });

    socket.join(getBlackjackSocketRoom(targetRoomId));
    socket.data.blackjackRoomId = targetRoomId;
    await persistBlackjackSettlementIfNeeded(targetRoomId);
    return emitBlackjackStateAndRooms(targetRoomId, userId);
}

async function watchBlackjackRoomForUser({ userId, targetRoomId }) {
    const activeSocketRoomId = socket.data.blackjackRoomId || null;
    const activePlayerRoomId = blackjackRoomManager.getPlayerRoomId(userId);

    if (activeSocketRoomId && activeSocketRoomId !== targetRoomId) {
        socket.leave(getBlackjackSocketRoom(activeSocketRoomId));
    }

    if (activePlayerRoomId && activePlayerRoomId !== targetRoomId) {
        blackjackRoomManager.leaveRoom(activePlayerRoomId, userId);
        emitBlackjackState(io, activePlayerRoomId);
    }

    const state = blackjackRoomManager.getRoomState(targetRoomId, userId);
    if (!state) {
        throw new Error('Blackjack room not found.');
    }

    socket.join(getBlackjackSocketRoom(targetRoomId));
    socket.data.blackjackRoomId = targetRoomId;
    emitBlackjackRooms(io);
    return state;
}

function setupBlackjackHandlers(socket, io, blackjackRoomManager, dbLayer, broadcastCoinUpdate) {
    socket.on(EVENTS.BLACKJACK_CREATE_ROOM, ({ roomId, maxPlayers } = {}, ack) => {
        try {
            const userId = socket.user?.userId;
            if (!userId) {
                const payload = { success: false, error: 'Authentication required.' };
                socket.emit(EVENTS.BLACKJACK_ERROR, payload.error);
                sendSocketAck(ack, payload);
                return;
            }

            const safeMaxPlayers = Number(maxPlayers);
            if (![3, 5].includes(safeMaxPlayers)) {
                throw new Error('Invalid blackjack table size.');
            }

            const room = blackjackRoomManager.createRoom(roomId, safeMaxPlayers);
            emitBlackjackRooms(io);
            sendSocketAck(ack, { success: true, roomId: room.roomId, room });
        } catch (err) {
            socket.emit(EVENTS.BLACKJACK_ERROR, err.message || 'Failed to create blackjack room.');
            sendSocketAck(ack, { success: false, error: err.message || 'Failed to create blackjack room.' });
        }
    });

    socket.on(EVENTS.BLACKJACK_JOIN, async ({ roomId } = {}, ack) => {
        try {
            const userId = socket.user?.userId;
            if (!userId) {
                const payload = { success: false, error: 'Authentication required.' };
                socket.emit(EVENTS.BLACKJACK_ERROR, payload.error);
                sendSocketAck(ack, payload);
                return;
            }

            if (!roomId) {
                throw new Error('roomId is required.');
            }

            const state = await switchBlackjackRoomForUser({
                userId,
                targetRoomId: roomId,
                socketOnly: false
            });
            sendSocketAck(ack, { success: true, roomId, state });
        } catch (err) {
            socket.emit(EVENTS.BLACKJACK_ERROR, err.message || 'Failed to join blackjack table.');
            sendSocketAck(ack, { success: false, error: err.message || 'Failed to join blackjack table.' });
        }
    });

    socket.on(EVENTS.BLACKJACK_SET_SKIN, ({ roomId, skin } = {}, ack) => {
        try {
            const userId = socket.user?.userId;
            if (!userId || !roomId) { sendSocketAck(ack, { success: false, error: 'Missing params.' }); return; }

            const room = blackjackRoomManager.getRoom(roomId);
            if (!room) { sendSocketAck(ack, { success: false, error: 'Room not found.' }); return; }

            const player = room.players.find(p => String(p.userId) === String(userId));
            if (!player) { sendSocketAck(ack, { success: false, error: 'You are not in this room.' }); return; }

            player.skin = skin;
            emitBlackjackState(io, roomId);
            sendSocketAck(ack, { success: true });
        } catch (err) {
            sendSocketAck(ack, { success: false, error: err.message || 'Failed to set skin.' });
        }
    });

    // Additional blackjack handlers would go here...
}

module.exports = {
    setupBlackjackHandlers,
    emitBlackjackState,
    emitBlackjackRooms,
    persistBlackjackSettlementIfNeeded,
    getBlackjackPlayer,
    applyBlackjackBetDeltaAndBroadcast,
    persistBlackjackRoundBuyInIfNeeded,
    startBlackjackRoundWithBuyIn,
    emitBlackjackStateAndRooms,
    leaveBlackjackRoomForUser,
    switchBlackjackRoomForUser,
    watchBlackjackRoomForUser
};
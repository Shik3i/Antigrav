const jwt = require('jsonwebtoken'); // used for secure invite links
const dbLayer = require('../database');
const roomManager = require('../roomManager');
const blackjackRoomManager = require('../utils/blackjackRoomManager');
const roomController = require('../controllers/roomController');
const EVENTS = require('../socketEvents.json');
const sanitize = require('../sanitize');
const apiController = require('../controllers/apiController');
const apiDataService = require('../services/apiDataService');
const { safeEmit, safeStringify } = require('../utils/safeSerialization');
const { createTimerLifecycleService } = require('../services/timerLifecycleService');
const { registerTimerSocketHandlers } = require('./timerSocketHandlers');
const { BLACKJACK_ROOM_PREFIX } = require('./constants');

// Helper modules
const { broadcastFriendStatus, broadcastCoinUpdate } = require('./helpers/friendStatusHelpers');
const authMiddleware = require('./middleware/authMiddleware');
const { setupAdminHandlers, verifyAdmin } = require('./handlers/adminHandlers');
const { setupBlackjackHandlers } = require('./handlers/blackjackHandlers');
const { setupRoomHandlers } = require('./handlers/roomHandlers');
const { setupEsportsHandlers } = require('./handlers/esportsHandlers');
const { setupScratchcardHandlers } = require('./handlers/scratchcardHandlers');
const { setupTimerTickHandler, emitRouletteState } = require('./timer/timerTickHandler');

const JWT_SECRET = require('../jwtSecret');

const onlineUsers = new Map(); // userId -> Set of socket.ids
let _io = null; // set when module.exports function is called

const sendSocketAck = (ack, payload) => {
    if (typeof ack === 'function') {
        ack(payload);
    }
};

// Helper to broadcast active rooms
function broadcastActiveRooms(io, targetSocket = null) {
    // Only broadcast rooms that are public and have at least one active user or are in timeout
    const activePublicRooms = Array.from(roomManager.rooms.values())
        .filter(r => r.config.isPublic && (r.users.size > 0 || r.timeoutId !== null))
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

    if (targetSocket) {
        targetSocket.emit(EVENTS.ACTIVE_ROOMS, activePublicRooms);
    } else {
        io.emit(EVENTS.ACTIVE_ROOMS, activePublicRooms);
    }
}

module.exports = function (io) {
    _io = io;
    const timerLifecycleService = createTimerLifecycleService({
        io,
        roomManager,
        dbLayer,
        broadcastCoinUpdate
    });

    // Initialize roulette broadcast
    roomController.initRouletteBroadcast((userId, newBalanceCents) => {
        if (_io) broadcastCoinUpdate(_io, userId, newBalanceCents, onlineUsers);
    });

    // Middleware to extract and verify user token
    io.use(authMiddleware());

    io.on('connection', (socket) => {
        registerTimerSocketHandlers({ socket, io, roomManager, lifecycleService: timerLifecycleService });

        if (socket.user) {
            const userId = socket.user.userId;
             if (!onlineUsers.has(userId)) {
                 onlineUsers.set(userId, new Set());
                 // First connection -> broadcast online to friends
                 broadcastFriendStatus(io, userId, true, onlineUsers);
             }
            onlineUsers.get(userId).add(socket.id);
            socket.join(userId); // Join private room for targeted updates (e.g. balance)
        }

        // Send initial list of active rooms to this user only
        broadcastActiveRooms(io, socket);
        emitBlackjackRooms(io, socket);
        emitRouletteState(io);

        // Friends status
        socket.on(EVENTS.GET_FRIENDS_STATUS, async () => {
            if (!socket.user) return;
            try {
                const friends = await dbLayer.getFriends(socket.user.userId);
                const acceptedFriends = (Array.isArray(friends) ? friends : []).filter(f => f.status === 'accepted');

                // For each friend, find if they are currently online
                const statuses = acceptedFriends.map(f => ({
                    userId: f.id,
                    isOnline: onlineUsers.has(f.id)
                }));

                socket.emit(EVENTS.FRIENDS_STATUS, statuses);
            } catch (err) {
                console.error('Failed to get friends status:', err);
            }
        });

        // Setup all handler modules
        setupAdminHandlers(socket, io, onlineUsers, JWT_SECRET);
        setupBlackjackHandlers(socket, io, blackjackRoomManager, dbLayer, broadcastCoinUpdate);
        setupRoomHandlers(socket, io, roomManager, dbLayer, broadcastActiveRooms, JWT_SECRET);
        setupEsportsHandlers(socket, io, apiController, apiDataService);
        setupScratchcardHandlers(socket, io, dbLayer, verifyAdmin);

        socket.on('disconnect', () => {
            if (socket.user) {
                const userId = socket.user.userId;
                const userSockets = onlineUsers.get(userId);
                if (userSockets) {
                    userSockets.delete(socket.id);
                    if (userSockets.size === 0) {
                        onlineUsers.delete(userId);
                        // Last connection closed -> broadcast offline to friends
                        broadcastFriendStatus(io, userId, false, onlineUsers);
                    }
                }
            }

            // Leave any rooms the socket was in
            for (const [roomId, room] of roomManager.rooms.entries()) {
                if (room.users.has(socket.id)) {
                    roomManager.leaveRoom(socket.id);
                    io.to(roomId).emit(EVENTS.USER_LEFT, socket.id);
                    const user = roomManager.getUserBySocket(socket.id);
                    if (user) {
                        const ev = roomManager.addEvent(roomId, 'leave', `${user.displayName} left the room`);
                        if (ev) io.to(roomId).emit(EVENTS.ROOM_EVENT, ev);
                    }
                }
            }

            // Leave blackjack room if applicable
            if (socket.data?.blackjackRoomId) {
                const roomId = socket.data.blackjackRoomId;
                blackjackRoomManager.leaveRoom(roomId, socket.user?.userId);
                socket.leave(getBlackjackSocketRoom(roomId));
            }
        });
    });

    // Setup timer tick handler
    setupTimerTickHandler(io, roomManager, blackjackRoomManager, timerLifecycleService);

    return io;
};

// Helper functions that are used by multiple modules
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
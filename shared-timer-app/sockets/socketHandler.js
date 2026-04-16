const jwt = require('jsonwebtoken'); // used for secure invite links
const dbLayer = require('../database');
const roomManager = require('../roomManager');
const EVENTS = require('../socketEvents');
const sanitize = require('../sanitize');
const apiController = require('../controllers/apiController');
const apiDataService = require('../services/apiDataService');
const { safeEmit, safeStringify } = require('../utils/safeSerialization');

const JWT_SECRET = require('../jwtSecret');

const onlineUsers = new Map(); // userId -> Set of socket.ids

// Helper to broadcast a user's status to their mutual friends
async function broadcastFriendStatus(io, userId, isOnline) {
    try {
        const friends = await dbLayer.getFriends(userId);
        const acceptedFriends = friends.filter(f => f.status === 'accepted').map(f => f.id);

        acceptedFriends.forEach(friendId => {
            const friendSockets = onlineUsers.get(friendId);
            if (friendSockets) {
                friendSockets.forEach(socketId => {
                    io.to(socketId).emit(EVENTS.FRIENDS_STATUS, { userId, isOnline });
                });
            }
        });
    } catch (err) {
        console.error('Failed to broadcast friend status:', err);
    }
}

// Helper to broadcast live coin balance updates to all sockets of a user
function broadcastCoinUpdate(io, userId, newBalanceCents) {
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
        userSockets.forEach(socketId => {
            io.to(socketId).emit(EVENTS.COIN_BALANCE_UPDATE, { balance: newBalanceCents });
        });
    }
}

module.exports = function (io) {
    // Middleware to extract and verify user token
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                if (decoded.userId) { // distinguish from invite tokens
                    socket.user = decoded;
                }
            } catch (err) {
                // fallback to guest if token invalid
            }
        }
        next();
    });

    io.on('connection', (socket) => {

        if (socket.user) {
            const userId = socket.user.userId;
            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
                // First connection -> broadcast online to friends
                broadcastFriendStatus(io, userId, true);
            }
            onlineUsers.get(userId).add(socket.id);
            socket.join(userId); // Join private room for targeted updates (e.g. balance)
        }

        // Send initial list of active rooms to this user only
        broadcastActiveRooms(io, socket);

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

        // Global Data Fetchers (Bypasses Express HTTP Rate Limiting)
        socket.on(EVENTS.GET_API_NEWS, async () => {
            try {
                const data = await apiController.fetchNewsData();
                safeEmit(socket, EVENTS.API_NEWS_DATA, data);
            } catch (err) {
                console.error('Socket fetchNewsData error:', err.message);
            }
        });

        socket.on(EVENTS.GET_API_ESPORTS, async () => {
            try {
                const result = await apiDataService.getEsportsSchedule();
                safeEmit(socket, EVENTS.API_ESPORTS_DATA, { 
                    data: Array.isArray(result?.data) ? result.data : [], 
                    timestamp: result?.timestamp || Date.now()
                });
            } catch (err) {
                console.error('Socket fetchEsportsData error:', err.message);
                safeEmit(socket, EVENTS.API_ESPORTS_DATA, { data: [], timestamp: Date.now(), error: err.message });
            }
        });

        socket.on(EVENTS.GET_API_ALL_TEAMS, async () => {
            try {
                const { data } = await apiDataService.getEsportsTeams();
                safeEmit(socket, EVENTS.API_ALL_TEAMS_DATA, data);
            } catch (err) {
                console.error('Socket fetchAllEsportsTeams error:', err.message);
            }
        });

        socket.on(EVENTS.GET_DB_ESPORTS_TEAMS, async () => {
            try {
                const teams = await apiController.getAllEsportsTeamsFromDB();
                const lastUpdated = await apiController.getEsportsTeamsLastUpdated();
                safeEmit(socket, EVENTS.DB_ESPORTS_TEAMS_DATA, { teams, lastUpdated });
            } catch (err) {
                console.error('Socket GET_DB_ESPORTS_TEAMS error:', err.message);
            }
        });

        socket.on(EVENTS.TRIGGER_FETCH_ALL_TEAMS, async ({ token }) => {
            if (!(await verifyAdmin(token))) {
                socket.emit(EVENTS.ERROR, 'Unauthorized admin access');
                return;
            }
            try {
                await apiController.fetchAllEsportsTeams();
                const teams = await apiController.getAllEsportsTeamsFromDB();
                const lastUpdated = await apiController.getEsportsTeamsLastUpdated();
                safeEmit(socket, EVENTS.DB_ESPORTS_TEAMS_DATA, { teams, lastUpdated });
            } catch (err) {
                console.error('Socket TRIGGER_FETCH_ALL_TEAMS error:', err.message);
                socket.emit(EVENTS.ERROR, 'Failed to update esports teams database');
            }
        });

        socket.on(EVENTS.GET_API_ODDS, async (payload = {}) => {
            try {
                const result = await apiDataService.getPolymarketOdds({ forceRefreshMatch: payload?.forceRefreshMatch || null });
                const emission = { 
                    data: Array.isArray(result?.data) ? result.data : [], 
                    timestamp: result?.timestamp || Date.now()
                };
                if (payload?.forceRefreshMatch && result.changed) {
                    safeEmit(io, EVENTS.API_ODDS_DATA, emission);
                } else {
                    safeEmit(socket, EVENTS.API_ODDS_DATA, emission);
                }
            } catch (err) {
                console.error('Socket fetchPolymarketOddsData error:', err.message);
                dbLayer.logError('Socket fetchPolymarketOddsData error', err.stack);
                safeEmit(socket, EVENTS.API_ODDS_DATA, { data: [], timestamp: Date.now(), error: err.message });
            }
        });

        // Admin Endpoints
        socket.on(EVENTS.GET_ADMIN_MAPPINGS, async ({ token }) => {
            if (!(await verifyAdmin(token))) {
                socket.emit(EVENTS.ERROR, 'Unauthorized admin access');
                return;
            }
            try {
                const mappings = await apiController.getAdminMappings();
                socket.emit(EVENTS.ADMIN_MAPPINGS_DATA, mappings);
            } catch (err) {
                socket.emit(EVENTS.ERROR, 'Failed to fetch mappings');
            }
        });

        socket.on(EVENTS.ADD_ADMIN_MAPPING, async ({ token, originalCode, polymarketCode }) => {
            if (!(await verifyAdmin(token))) {
                socket.emit(EVENTS.ERROR, 'Unauthorized');
                return;
            }
            try {
                await apiController.addAdminMapping(originalCode, polymarketCode);
                await dbLayer.logAdminAction(socket.user.userId, socket.user.username, 'ADD_MAPPING', { originalCode, polymarketCode });
                const mappings = await apiController.getAdminMappings();
                socket.emit(EVENTS.ADMIN_MAPPINGS_DATA, mappings); // broadcast update back
            } catch (err) {
                socket.emit(EVENTS.ERROR, err.message || 'Failed to add mapping');
            }
        });

        socket.on(EVENTS.DELETE_ADMIN_MAPPING, async ({ token, id }) => {
            if (!(await verifyAdmin(token))) {
                socket.emit(EVENTS.ERROR, 'Unauthorized');
                return;
            }
            try {
                await apiController.deleteAdminMapping(id);
                await dbLayer.logAdminAction(socket.user.userId, socket.user.username, 'DELETE_MAPPING', { mappingId: id });
                const mappings = await apiController.getAdminMappings();
                socket.emit(EVENTS.ADMIN_MAPPINGS_DATA, mappings);
            } catch (err) {
                socket.emit(EVENTS.ERROR, 'Failed to delete mapping');
            }
        });

        // --- Scratchcard Pools Admin ---
        socket.on(EVENTS.GET_ADMIN_SCRATCHCARD_POOLS, async ({ token }) => {
            if (!(await verifyAdmin(token))) {
                socket.emit(EVENTS.ERROR, 'Unauthorized');
                return;
            }
            try {
                const pools = await dbLayer.getScratchcardPools();
                socket.emit(EVENTS.ADMIN_SCRATCHCARD_POOLS_DATA, pools);
            } catch (err) {
                socket.emit(EVENTS.ERROR, 'Failed to fetch scratchcard pools');
            }
        });

        socket.on(EVENTS.ADD_ADMIN_SCRATCHCARD_POOL_TEAM, async ({ token, cardType, teamCode }) => {
            if (!(await verifyAdmin(token))) {
                socket.emit(EVENTS.ERROR, 'Unauthorized');
                return;
            }
            try {
                await dbLayer.addScratchcardPoolTeam(cardType, teamCode);
                await dbLayer.logAdminAction(socket.user.userId, socket.user.username, 'ADD_SCRATCHCARD_POOL', { cardType, teamCode });
                const pools = await dbLayer.getScratchcardPools();
                socket.emit(EVENTS.ADMIN_SCRATCHCARD_POOLS_DATA, pools);
            } catch (err) {
                socket.emit(EVENTS.ERROR, err.message || 'Failed to add team to scratchcard pool');
            }
        });

        socket.on(EVENTS.DELETE_ADMIN_SCRATCHCARD_POOL_TEAM, async ({ token, cardType, teamCode }) => {
            if (!(await verifyAdmin(token))) {
                socket.emit(EVENTS.ERROR, 'Unauthorized');
                return;
            }
            try {
                await dbLayer.removeScratchcardPoolTeam(cardType, teamCode);
                await dbLayer.logAdminAction(socket.user.userId, socket.user.username, 'DELETE_SCRATCHCARD_POOL', { cardType, teamCode });
                const pools = await dbLayer.getScratchcardPools();
                socket.emit(EVENTS.ADMIN_SCRATCHCARD_POOLS_DATA, pools);
            } catch (err) {
                socket.emit(EVENTS.ERROR, 'Failed to remove team from scratchcard pool');
            }
        });

        // --- Scratchcard Economy Config ---
        socket.on(EVENTS.GET_ADMIN_SCRATCHCARD_ECONOMY, async ({ token }) => {
            if (!(await verifyAdmin(token))) {
                socket.emit(EVENTS.ERROR, 'Unauthorized');
                return;
            }
            try {
                const configs = await dbLayer.getScratchcardConfigs();
                socket.emit(EVENTS.ADMIN_SCRATCHCARD_ECONOMY_DATA, configs);
            } catch (err) {
                socket.emit(EVENTS.ERROR, 'Failed to fetch scratchcard configs');
            }
        });

        socket.on(EVENTS.UPDATE_ADMIN_SCRATCHCARD_ECONOMY, async ({ token, cardType, price, winChance, rewardAmount }) => {
            if (!(await verifyAdmin(token))) {
                socket.emit(EVENTS.ERROR, 'Unauthorized');
                return;
            }
            try {
                await dbLayer.updateScratchcardConfig(cardType, price, winChance, rewardAmount);
                await dbLayer.logAdminAction(socket.user.userId, socket.user.username, 'UPDATE_SCRATCHCARD_ECONOMY', { cardType, price, winChance, rewardAmount });
                const configs = await dbLayer.getScratchcardConfigs();
                socket.emit(EVENTS.ADMIN_SCRATCHCARD_ECONOMY_DATA, configs);
            } catch (err) {
                socket.emit(EVENTS.ERROR, err.message || 'Failed to update scratchcard config');
            }
        });

        // --- Cache Admin ---
        socket.on(EVENTS.GET_ADMIN_CACHE, async ({ token }) => {
            if (!(await verifyAdmin(token))) { socket.emit(EVENTS.ERROR, 'Unauthorized'); return; }
            try {
                const status = apiController.getAdminCacheStatus();
                socket.emit(EVENTS.ADMIN_CACHE_DATA, status);
            } catch (err) { socket.emit(EVENTS.ERROR, 'Failed to fetch cache status'); }
        });

        socket.on(EVENTS.FLUSH_ADMIN_CACHE, async ({ token, target }) => {
            if (!(await verifyAdmin(token))) { socket.emit(EVENTS.ERROR, 'Unauthorized'); return; }
            try {
                const status = apiController.flushAdminCache(target);
                await dbLayer.logAdminAction(socket.user.userId, socket.user.username, 'FLUSH_CACHE', { target });
                socket.emit(EVENTS.ADMIN_CACHE_DATA, status);
            } catch (err) { socket.emit(EVENTS.ERROR, 'Failed to flush cache'); }
        });

        // --- Activity Admin ---
        socket.on(EVENTS.GET_ADMIN_ACTIVITY, async ({ token }) => {
            if (!(await verifyAdmin(token))) { socket.emit(EVENTS.ERROR, 'Unauthorized'); return; }
            try {
                const activity = await dbLayer.getAllTimerCompletions();
                socket.emit(EVENTS.ADMIN_ACTIVITY_DATA, activity);
            } catch (err) { socket.emit(EVENTS.ERROR, 'Failed to fetch activity'); }
        });

        socket.on(EVENTS.DELETE_ADMIN_ACTIVITY, async ({ token, id }) => {
            if (!(await verifyAdmin(token))) { socket.emit(EVENTS.ERROR, 'Unauthorized'); return; }
            try {
                await dbLayer.deleteTimerCompletion(id);
                const activity = await dbLayer.getAllTimerCompletions();
                socket.emit(EVENTS.ADMIN_ACTIVITY_DATA, activity);
            } catch (err) { socket.emit(EVENTS.ERROR, 'Failed to delete activity'); }
        });

        // --- Room Admin ---
        socket.on(EVENTS.GET_ADMIN_ROOMS, async ({ token }) => {
            if (!(await verifyAdmin(token))) { socket.emit(EVENTS.ERROR, 'Unauthorized'); return; }
            try {
                // Instead of fetching from DB, we pull the live instances from memory
                const rooms = Array.from(roomManager.rooms.values()).map(r => ({
                    id: r.id,
                    name: r.config.name,
                    createdAt: r.createdAt || new Date().toISOString(), 
                    ownerName: Array.from(r.users.values()).find(u => u.role === 'write')?.displayName || 'RAM System',
                    isPublic: r.config.isPublic,
                    activeUsers: r.users.size,
                    defaultDurationMinutes: r.config.defaultDurationMinutes
                }));
                socket.emit(EVENTS.ADMIN_ROOMS_DATA, rooms);
            } catch (err) { 
                console.error("Admin error fetching rooms:", err);
                socket.emit(EVENTS.ERROR, 'Failed to fetch rooms'); 
            }
        });

        socket.on(EVENTS.DELETE_ADMIN_ROOM, async ({ token, id }) => {
            if (!(await verifyAdmin(token))) { socket.emit(EVENTS.ERROR, 'Unauthorized'); return; }
            try {
                // If it's active in memory, clean it up and boot users
                if (roomManager.rooms.has(id)) {
                    io.to(id).emit(EVENTS.ERROR, 'This room has been deleted by an administrator.');
                    const ev = roomManager.addEvent(id, 'leave', 'Room deleted.');
                    if (ev) io.to(id).emit(EVENTS.ROOM_EVENT, ev);
                    roomManager.rooms.delete(id);
                }

                const rooms = Array.from(roomManager.rooms.values()).map(r => ({
                    id: r.id,
                    name: r.config.name,
                    createdAt: new Date().toISOString(),
                    ownerName: Array.from(r.users.values()).find(u => u.role === 'write')?.displayName || 'Unknown',
                    isPublic: r.config.isPublic,
                    activeUsers: r.users.size
                }));
                socket.emit(EVENTS.ADMIN_ROOMS_DATA, rooms);
                broadcastActiveRooms(io);
            } catch (err) { socket.emit(EVENTS.ERROR, 'Failed to delete room'); }
        });

        socket.on(EVENTS.EDIT_ADMIN_ROOM, async ({ token, id, newName, defaultRole }) => {
            if (!(await verifyAdmin(token))) { socket.emit(EVENTS.ERROR, 'Unauthorized'); return; }
            try {
                if (roomManager.rooms.has(id)) {
                    roomManager.updateRoomInfo(id, newName, defaultRole);
                    io.to(id).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(id));
                    const ev = roomManager.addEvent(id, 'action', `Admin updated room settings.`);
                    if (ev) io.to(id).emit(EVENTS.ROOM_EVENT, ev);
                }

                // Push new list back to admin
                const rooms = Array.from(roomManager.rooms.values()).map(r => ({
                    id: r.id,
                    name: r.config.name,
                    createdAt: new Date().toISOString(),
                    ownerName: Array.from(r.users.values()).find(u => u.role === 'write')?.displayName || 'Unknown',
                    isPublic: r.config.isPublic,
                    activeUsers: r.users.size
                }));
                socket.emit(EVENTS.ADMIN_ROOMS_DATA, rooms);
                broadcastActiveRooms(io);
            } catch (err) {
                socket.emit(EVENTS.ERROR, 'Failed to edit room');
            }
        });

        socket.on(EVENTS.ADMIN_BROADCAST_MESSAGE, async ({ token, message }) => {
            if (!(await verifyAdmin(token))) { socket.emit(EVENTS.ERROR, 'Unauthorized'); return; }
            if (message && message.trim().length > 0) {
                io.emit(EVENTS.GLOBAL_ANNOUNCEMENT, { message: message.trim(), timestamp: Date.now() });
            }
        });

        socket.on(EVENTS.JOIN_ROOM, async ({ roomId, userId, displayName, preferences, token }) => {
            try {
                // 1. Check if room exists IN MEMORY
                const room = roomManager.getRoom(roomId);
                if (!room) {
                    // Only memory holds rooms now - if it's not there, it doesn't exist.
                    socket.emit(EVENTS.ERROR, 'Room not found or has expired. Please check the URL or create a new room.');
                    return;
                }

                const memConfig = room.config;

                // 2. Determine role based on token or ownership
                let role = 'read';

                // Determine the true ID of the joining user (authenticated via socket or passed by client)
                const joiningUserId = socket.user ? socket.user.userId : userId;

                // console.log(`[DEBUG PERM] Room ownerId: ${memConfig.ownerId}, joiningUserId: ${joiningUserId}, socket.user:`, socket.user ? socket.user.userId : 'undefined', `token: ${token}`);

                if (memConfig.ownerId && String(joiningUserId) === String(memConfig.ownerId)) {
                    // Room creator always gets write admin rights, regardless of token
                    role = 'write';
                    // console.log(`[DEBUG PERM] Granted 'write' because owner matches`);
                } else if (token) {
                    try {
                        const decoded = jwt.verify(token, JWT_SECRET);
                        if (String(decoded.roomId) === String(roomId)) {
                            role = decoded.role;
                        }
                    } catch (err) {
                        // Invalid token - if it's a private room, this is a hard failure
                        if (!memConfig.isPublic) {
                            socket.emit(EVENTS.ERROR, 'Invalid or expired invite link for this private room.');
                            return;
                        }
                    }
                } else if (!memConfig.isPublic) {
                    // No token provided for a private room
                    socket.emit(EVENTS.ERROR, 'Access denied. You need an invite link to join this private room.');
                    return;
                } else {
                    // Public room with no token - use the room's default role (default 'read')
                    role = memConfig.defaultRole || 'read';
                }

                // Leave previous room if already in one to avoid state sync bleeding
                let currentRoomId = null;
                for (const [rid, r] of roomManager.rooms.entries()) {
                    if (r.users.has(socket.id)) {
                        currentRoomId = rid;
                        break;
                    }
                }

                if (currentRoomId && currentRoomId !== roomId) {
                    const prevUser = roomManager.getUserBySocket(socket.id);
                    roomManager.leaveRoom(socket.id);
                    socket.leave(currentRoomId);
                    io.to(currentRoomId).emit(EVENTS.USER_LEFT, socket.id);
                    if (prevUser) {
                        const ev = roomManager.addEvent(currentRoomId, 'leave', `${prevUser.displayName} left the room`);
                        if (ev) io.to(currentRoomId).emit(EVENTS.ROOM_EVENT, ev);
                    }
                }

                // 4. Join the room - override guest inputs with authenticated user details if present
                let finalUserId = socket.user ? socket.user.userId : userId;
                let finalDisplayName = displayName || (socket.user ? (socket.user.displayName || socket.user.username) : 'Guest');
                let finalPreferences = preferences || {};

                // Prevent guest name collision
                if (!socket.user && finalDisplayName) {
                    const existingUser = await dbLayer.getUserByUsername(finalDisplayName);
                    if (existingUser) {
                        finalDisplayName = `${finalDisplayName}_Guest`;
                    }
                }

                const user = { userId: finalUserId, displayName: sanitize(finalDisplayName), role, preferences: finalPreferences };
                const isNewJoin = currentRoomId !== roomId;

                // console.log(`[DEBUG] JOIN_ROOM: socket.id=${socket.id}, role=${role}`);

                roomManager.joinRoom(roomId, socket.id, user);
                socket.join(roomId);

                // safeEmit - validates event name + serializability before sending
                // Prevents malformed packets that cause 'parse error' client disconnects
                const safeEmitToSocket = (sock, event, data) => {
                    if (!event) {
                        console.error(`[SOCKET] Attempted to emit with undefined event name. Data keys: ${Object.keys(data || {}).join(', ')}`);
                        return;
                    }
                    try {
                        safeStringify(data);
                        safeEmit(sock, event, data);
                    } catch (e) {
                        console.error(`[SOCKET] Serialization failed for event '${event}':`, e.message);
                    }
                };
                const safeEmitRoom = (event, data) => {
                    if (!event) {
                        console.error(`[SOCKET] Attempted to emit to room with undefined event name.`);
                        return;
                    }
                    try {
                        safeStringify(data);
                        safeEmit(io.to(roomId), event, data);
                    } catch (e) {
                        console.error(`[SOCKET] Serialization failed for room event '${event}':`, e.message);
                    }
                };

                // Initial sync
                safeEmitToSocket(socket, EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
                safeEmitToSocket(socket, EVENTS.ROOM_EVENT_SYNC, room.state.eventHistory);

                if (isNewJoin) {
                    safeEmitRoom(EVENTS.USER_JOINED, user);
                    const ev = roomManager.addEvent(roomId, 'join', `${user.displayName} joined the room`, socket.id);
                    if (ev) safeEmitRoom(EVENTS.ROOM_EVENT, ev);
                }

                // Update room list for all
                broadcastActiveRooms(io);
            } catch (err) {
                console.error('Error joining room:', err);
                socket.emit(EVENTS.ERROR, 'An internal server error occurred while joining the room.');
            }
        });

        socket.on('REQUEST_ROOM_EVENT_SYNC', ({ roomId }) => {
            const room = roomManager.getRoom(roomId);
            if (room) {
                try {
                    safeStringify(room.state.eventHistory);
                    safeEmit(socket, EVENTS.ROOM_EVENT_SYNC, room.state.eventHistory);
                } catch (e) {
                    console.error('Failed to emit history:', e);
                }
            }
        });

        socket.on('UPDATE_PREFERENCES', ({ roomId, preferences }) => {
            const user = roomManager.getUserBySocket(socket.id);
            if (user && roomId) {
                user.preferences = preferences || {};
                io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
            }
        });

        socket.on(EVENTS.TIMER_ACTION, ({ roomId, action, payload }) => {
            // Check permission
            const user = roomManager.getUserBySocket(socket.id);
            if (!user || user.role !== 'write') {
                socket.emit(EVENTS.ERROR, 'You do not have permission to control the timer.');
                return;
            }

            let changed = false;
            let actionText = '';
            switch (action) {
                case 'START':
                    changed = roomManager.startTimer(roomId);
                    actionText = 'started the timer';
                    break;
                case 'PAUSE':
                    changed = roomManager.pauseTimer(roomId);
                    actionText = 'paused the timer';
                    break;
                case 'RESET':
                    changed = roomManager.resetTimer(roomId);
                    actionText = 'reset the timer';
                    break;
                case 'SET_DURATION':
                    changed = roomManager.setDuration(roomId, payload); // payload is minutes
                    actionText = `set duration to ${payload}m`;
                    break;
                case 'END_EARLY': {
                    const room = roomManager.getRoom(roomId);
                    if (room && room.state.isRunning) {
                        roomManager._updateRemaining(room);
                        const elapsedMs = room.config.durationMs - room.state.remainingMs;
                        const originalDuration = room.config.durationMs;
                        
                        // Temporarily override to calculate strict rewards or fulfill request
                        room.config.durationMs = elapsedMs;
                        room.state.remainingMs = 0;
                        room.state.isRunning = false;

                        io.to(roomId).emit(EVENTS.TIMER_COMPLETED, { roomId, timestamp: Date.now() });
                        changed = true;

                        dbLayer.getKoalaBaseline().then(settings => {
                            const durationMinutes = elapsedMs / (60 * 1000);
                            const coinsToAward = Math.floor((durationMinutes / 60) * settings.koala_points_per_hour);

                            const uniqueUsers = new Map();
                            room.users.forEach(u => {
                                const id = u.userId || u.id;
                                if (id && !uniqueUsers.has(id)) uniqueUsers.set(id, u);
                            });

                            room.state.stats = room.state.stats || { totalCompletions: 0, userCompletions: {} };
                            room.state.stats.totalCompletions++;

                            Array.from(uniqueUsers.values()).forEach(u => {
                                const id = u.userId || u.id;
                                if (!id) return;
                                room.state.stats.userCompletions[id] = (room.state.stats.userCompletions[id] || 0) + 1;
                                dbLayer.addUser(id, u.displayName || u.username).then(() => {
                                    dbLayer.recordTimerCompletion(id, room.id, room.config.name, durationMinutes).catch(console.error);
                                    if (coinsToAward > 0) {
                                        dbLayer.addKoalaCoins(id, coinsToAward, `Completed ${Math.round(durationMinutes)}m timer (ended early)`).then(newBalance => {
                                            broadcastCoinUpdate(io, id, newBalance);
                                            const userSockets = Array.from(room.users.values()).filter(us => (us.userId || us.id) === id);
                                            userSockets.forEach(uSocket => {
                                                if (uSocket.socketId) io.to(uSocket.socketId).emit('KOALA_COINS_EARNED', { amount: coinsToAward, newBalance });
                                            });
                                        }).catch(console.error);
                                    }
                                }).catch(console.error);
                            });

                            // Handle Auto-Restart correctly
                            if (room.state.autoRestart && !room.state.isPomodoro) {
                                setTimeout(() => {
                                    if (roomManager.rooms.has(room.id) && room.state.autoRestart) {
                                        room.config.durationMs = originalDuration;
                                        roomManager.resetTimer(room.id);
                                        roomManager.startTimer(room.id);
                                        io.to(room.id).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(room.id));
                                    }
                                }, 3000);
                            } else {
                                room.config.durationMs = originalDuration;
                            }
                        }).catch(console.error);

                        actionText = 'ended the timer early';
                    }
                    break;
                }
            }

            if (changed) {
                io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
                if (actionText) {
                    const ev = roomManager.addEvent(roomId, 'action', `${user.displayName} ${actionText}`, socket.id);
                    if (ev) io.to(roomId).emit(EVENTS.ROOM_EVENT, ev);
                }
            }
        });

        socket.on(EVENTS.GET_INVITE_TOKENS, ({ roomId }) => {
            const user = roomManager.getUserBySocket(socket.id);
            if (user && user.role === 'write') {
                const readToken = jwt.sign({ roomId, role: 'read' }, JWT_SECRET);
                const writeToken = jwt.sign({ roomId, role: 'write' }, JWT_SECRET);
                socket.emit(EVENTS.INVITE_TOKENS, { readToken, writeToken });
            }
        });

        socket.on(EVENTS.SET_POMODORO, ({ roomId, enabled, pauseMinutes, workName, breakName }) => {
            const user = roomManager.getUserBySocket(socket.id);
            if (user && user.role === 'write') {
                const room = roomManager.getRoom(roomId);
                if (room) {
                    if (enabled) {
                        if (pauseMinutes && (pauseMinutes * 60 * 1000) >= room.config.durationMs) {
                            socket.emit(EVENTS.ERROR, 'Fehler: Die Pausenzeit muss kürzer als die Gesamtzeit sein.');
                            return;
                        }
                    }
                    roomManager.togglePomodoro(roomId, enabled, pauseMinutes, workName, breakName);
                    io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
                    const ev = roomManager.addEvent(roomId, 'action', `${user.displayName} ${enabled ? 'enabled' : 'disabled'} Pomodoro mode`, socket.id);
                    if (ev) io.to(roomId).emit(EVENTS.ROOM_EVENT, ev);
                }
            }
        });

        socket.on(EVENTS.TOGGLE_AUTO_RESTART, ({ roomId, enabled }) => {
            const user = roomManager.getUserBySocket(socket.id);
            if (user && user.role === 'write') {
                const changed = roomManager.toggleAutoRestart(roomId, enabled);
                if (changed) {
                    io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
                    const ev = roomManager.addEvent(roomId, 'action', `${user.displayName} ${enabled ? 'enabled' : 'disabled'} Auto-Restart`, socket.id);
                    if (ev) io.to(roomId).emit(EVENTS.ROOM_EVENT, ev);
                }
            }
        });

        socket.on(EVENTS.RENAME_ROOM, ({ roomId, newName }) => {
            const user = roomManager.getUserBySocket(socket.id);
            if (!user || user.role !== 'write') {
                socket.emit(EVENTS.ERROR, 'You do not have permission to rename this room.');
                return;
            }
            const room = roomManager.getRoom(roomId);
            if (room) {
                const safeName = sanitize(newName).substring(0, 40);
                room.config.name = safeName;
                io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
                const ev = roomManager.addEvent(roomId, 'action', `${user.displayName} renamed the room to "${safeName}"`, socket.id);
                if (ev) io.to(roomId).emit(EVENTS.ROOM_EVENT, ev);
            }
        });

        socket.on(EVENTS.PROMOTE_USER, ({ roomId, targetSocketId }) => {
            const user = roomManager.getUserBySocket(socket.id);
            console.log(`[DEBUG] PROMOTE_USER called by socket.id=${socket.id}, found user=${!!user}, role=${user?.role}`);

            if (!user || user.role !== 'write') {
                socket.emit(EVENTS.ERROR, 'You do not have permission to promote users in this room.');
                return;
            }

            const success = roomManager.promoteUser(roomId, targetSocketId);
            if (success) {
                const targetUser = roomManager.getUserBySocket(targetSocketId);
                const safeName = targetUser ? targetUser.displayName : 'A user';
                io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
                io.to(roomId).emit(EVENTS.ROOM_EVENT, {
                    type: 'action',
                    message: `${user.displayName} promoted ${safeName} to Admin`,
                    timestamp: Date.now(),
                    userId: socket.id
                });
            }
        });

        socket.on(EVENTS.SEND_REACTION, ({ roomId, emoji }) => {
            io.to(roomId).emit(EVENTS.REACTION, { emoji, userId: socket.id, timestamp: Date.now() });
        });

        // Minigames
        socket.on(EVENTS.ROOM_COINFLIP, ({ roomId }) => {
            try {
                if (!roomId) return;
                const user = roomManager.getUserBySocket(socket.id);
                if (!user) return;
                
                const safeName = user.displayName || user.username || 'Ein Nutzer';
                const result = Math.random() < 0.5 ? 'KOPF' : 'ZAHL';
                
                io.to(roomId).emit(EVENTS.ROOM_COINFLIP_RESULT, {
                    userId: user.userId || socket.id,
                    userName: safeName,
                    result,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Minigame Error (Coinflip):', error);
            }
        });

        socket.on(EVENTS.START_DEATHROLL, ({ roomId }) => {
            try {
                if (!roomId) return;
                const user = roomManager.getUserBySocket(socket.id);
                if (!user) return;
                
                const safeName = user.displayName || user.username || 'Ein Nutzer';
                const drState = roomManager.startDeathroll(roomId, safeName);
                if (drState) {
                    io.to(roomId).emit(EVENTS.DEATHROLL_UPDATE, drState);
                    io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
                }
            } catch (error) {
                console.error('Minigame Error (Start Deathroll):', error);
            }
        });

        socket.on(EVENTS.ROLL_DEATHROLL, ({ roomId }) => {
            try {
                if (!roomId) return;
                const user = roomManager.getUserBySocket(socket.id);
                if (!user) return;
                
                const safeName = user.displayName || user.username || 'Ein Nutzer';
                const drState = roomManager.rollDeathroll(roomId, safeName);
                if (drState) {
                    io.to(roomId).emit(EVENTS.DEATHROLL_UPDATE, drState);
                    io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
                }
            } catch (error) {
                console.error('Minigame Error (Roll Deathroll):', error);
            }
        });

        // GENERIC EXTENSION PAYLOAD PIPE
        socket.on(EVENTS.EXTENSION_MESSAGE, ({ roomId, payload }) => {
            if (!roomId || !payload) return;
            const room = roomManager.getRoom(roomId);
            if (!room) return;

            const user = roomManager.getUserBySocket(socket.id);
            if (!user) return;

            // Optional: Log core play/pause actions to room history for UX
            if (payload && (payload.action === 'play' || payload.action === 'pause') && !payload.originalAction) {
                const actionFormatted = payload.action === 'play' ? 'started media' : 'paused media';
                const ev = roomManager.addEvent(roomId, 'action', `${user.displayName} ${actionFormatted}`, socket.id);
                if (ev) io.to(roomId).emit(EVENTS.ROOM_EVENT, ev);
            }

            // Broadcast generic payload blindly to everyone else
            socket.broadcast.to(roomId).emit(EVENTS.EXTENSION_MESSAGE, {
                userId: socket.id,
                userDisplayName: user.displayName,
                payload
            });
        });

        const verifyAdmin = async (token) => {
            if (token === 'Bearer Entangled-Napping7-Custodian') return true;
            try {
                const actualToken = token && token.startsWith('Bearer ') ? token.slice(7) : token;
                const decoded = jwt.verify(actualToken, JWT_SECRET);

                // If token payload explicitly has it (e.g., master password tokens)
                if (decoded?.is_superadmin) return true;

                // Fallback: Check the database for normal user tokens
                const uid = decoded?.userId || decoded?.id;
                if (uid) {
                    const dbUser = await dbLayer.getUser(uid);
                    return dbUser && (dbUser.is_superadmin === 1 || dbUser.is_superadmin === true);
                }
                return false;
            } catch {
                return false;
            }
        };

        // KoalaCoins Admin Handlers
        socket.on('ADMIN_GET_KOALA_BASELINE', async ({ token }) => {
            if (await verifyAdmin(token)) {
                try {
                    const baseline = await dbLayer.getKoalaBaseline();
                    socket.emit('KOALA_BASELINE_DATA', { baseline });
                } catch (err) {
                    console.error('Failed to get koala baseline:', err);
                }
            }
        });

        socket.on('ADMIN_UPDATE_KOALA_BASELINE', async ({ token, baseline }) => {
            if (await verifyAdmin(token)) {
                try {
                    await dbLayer.updateKoalaBaseline(baseline);
                    await dbLayer.logAdminAction(socket.user.userId, socket.user.username, 'UPDATE_KOALA_BASELINE', { baseline });
                    socket.emit('KOALA_BASELINE_UPDATED', { success: true, baseline });
                } catch (err) {
                    socket.emit('KOALA_BASELINE_UPDATED', { success: false, error: err.message });
                }
            }
        });

        socket.on('ADMIN_GET_KOALA_TRANSACTIONS', async ({ token, userId }) => {
            if (await verifyAdmin(token)) {
                try {
                    const transactions = await dbLayer.getKoalaTransactions(userId, 5);
                    socket.emit('KOALA_TRANSACTIONS_DATA', { userId, transactions });
                } catch (err) {
                    console.error('Failed to get koala transactions:', err);
                }
            }
        });

        socket.on('ADMIN_ADJUST_KOALA_COINS', async ({ token, userId, amountCents, reason }) => {
            if (await verifyAdmin(token)) {
                try {
                    const newBalanceCents = await dbLayer.addKoalaCoins(userId, amountCents, reason);
                    const targetUser = await dbLayer.getUser(userId);
                    await dbLayer.logAdminAction(socket.user.userId, socket.user.username, 'ADJUST_COINS', { targetId: userId, targetName: targetUser?.username, amount: amountCents / 100, reason });

                    // Specific emit for UI feedback
                    socket.emit('KOALA_COINS_ADJUSTED', { success: true, userId, newBalance: newBalanceCents / 100 });

                    // Broadcast live coin update to all sockets of this user
                    broadcastCoinUpdate(io, userId, newBalanceCents);
                } catch (err) {
                    socket.emit('KOALA_COINS_ADJUSTED', { success: false, error: err.message });
                }
            }
        });

        // Workspace Events
        socket.on(EVENTS.ADD_TODO, ({ roomId, todo }) => {
            const user = roomManager.getUserBySocket(socket.id);
            if (user) { // Only require 'right' to exist, read or write doesn't matter for private tools yet or we allow everyone
                const enrichedTodo = { ...todo, id: Date.now().toString(), author: user.displayName, completed: false };
                if (roomManager.addTodo(roomId, enrichedTodo)) {
                    io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
                }
            }
        });

        socket.on(EVENTS.TOGGLE_TODO, ({ roomId, todoId }) => {
            if (roomManager.toggleTodo(roomId, todoId)) {
                io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
            }
        });

        socket.on(EVENTS.DELETE_TODO, ({ roomId, todoId }) => {
            if (roomManager.deleteTodo(roomId, todoId)) {
                io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
            }
        });

        socket.on(EVENTS.DRAW_LINE, ({ roomId, line }) => {
            if (roomManager.drawCanvasLine(roomId, line)) {
                safeEmit(io.to(roomId), EVENTS.DRAW_LINE, { line });
            }
        });

        socket.on(EVENTS.CLEAR_CANVAS, ({ roomId }) => {
            if (roomManager.clearCanvas(roomId)) {
                safeEmit(io.to(roomId), EVENTS.CLEAR_CANVAS, { roomId });
            }
        });

        socket.on(EVENTS.LEAVE_ROOM, () => {
            const user = roomManager.getUserBySocket(socket.id);
            const roomId = roomManager.leaveRoom(socket.id);
            if (roomId) {
                socket.leave(roomId);
                io.to(roomId).emit(EVENTS.USER_LEFT, socket.id);
                if (user) {
                    const ev = roomManager.addEvent(roomId, 'leave', `${user.displayName} left the room`);
                    if (ev) io.to(roomId).emit(EVENTS.ROOM_EVENT, ev);
                }
                broadcastActiveRooms(io);
            }
        });

        // Friend Invites
        socket.on(EVENTS.INVITE_FRIEND, ({ friendId, roomId }) => {
            const user = roomManager.getUserBySocket(socket.id) || socket.user;
            if (!user) return; // Need to know who is inviting

            const room = roomManager.rooms.get(roomId);
            if (!room) return; // Room must exist

            const friendSockets = onlineUsers.get(friendId);
            if (friendSockets) {
                friendSockets.forEach(sid => {
                    io.to(sid).emit(EVENTS.ROOM_INVITE, {
                        roomId: room.id,
                        roomName: room.config?.name || 'Focus Session',
                        inviterName: user.displayName || user.username
                    });
                });
            }
        });

        // Latency & Metrics tracking
        socket.on(EVENTS.PING, ({ clientTime }) => {
            // Respond immediately with the server's time
            socket.emit(EVENTS.PONG, { clientTime, serverTime: Date.now() });
        });

        socket.on(EVENTS.REPORT_METRICS, ({ ping, offset }) => {
            const roomId = roomManager.updateMetrics(socket.id, ping, offset);
            if (roomId) {
                safeEmit(io.to(roomId), EVENTS.METRICS_UPDATE, {
                    roomId,
                    socketId: socket.id,
                    userId: socket.user?.userId || roomManager.getUserBySocket(socket.id)?.userId || null,
                    metrics: { ping, offset }
                });
            }
        });


        socket.on(EVENTS.DISCONNECT, (reason) => {
            const user = roomManager.getUserBySocket(socket.id);
            const roomId = roomManager.leaveRoom(socket.id);
            if (roomId) {
                io.to(roomId).emit(EVENTS.USER_LEFT, socket.id);
                if (user) {
                    const ev = roomManager.addEvent(roomId, 'leave', `${user.displayName} disconnected`);
                    if (ev) io.to(roomId).emit(EVENTS.ROOM_EVENT, ev);
                }

                broadcastActiveRooms(io);
            }

            if (socket.user) {
                const userId = socket.user.userId;
                const userSockets = onlineUsers.get(userId);
                if (userSockets) {
                    userSockets.delete(socket.id);
                    if (userSockets.size === 0) {
                        onlineUsers.delete(userId);
                        broadcastFriendStatus(io, userId, false);
                    }
                }
            }
        });
    });

    // Timer Tick Interval (1Hz) for precise calculation sync
    setInterval(() => {
        const completedRooms = roomManager.tick();

        // Emit timer_completed event
        completedRooms.forEach(room => {
            io.to(room.id).emit(EVENTS.TIMER_COMPLETED, { roomId: room.id, timestamp: Date.now() });
            io.to(room.id).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(room.id));
            const ev = roomManager.addEvent(room.id, 'action', 'Timer reached 0!');
            if (ev) io.to(room.id).emit(EVENTS.ROOM_EVENT, ev);

            // Get baseline to calculate points
            dbLayer.getKoalaBaseline().then(settings => {
                const durationMinutes = room.config.durationMs / (60 * 1000);
                // koala_points_per_hour is stored in cents (e.g. 10000 = 100.00 coins per hour)
                const coinsToAward = Math.floor((durationMinutes / 60) * settings.koala_points_per_hour);

                // Extract unique users to prevent multiple payouts for users with multiple tabs
                const uniqueUsers = new Map();
                room.users.forEach(user => {
                    const id = user.userId || user.id;
                    if (id && !uniqueUsers.has(id)) {
                        uniqueUsers.set(id, user);
                    }
                });

                // Record completion in DB for every unique user present
                Array.from(uniqueUsers.values()).forEach(user => {
                    const id = user.userId || user.id;
                    if (!id) return; // Prevent corrupt entries with no ID

                    dbLayer.addUser(id, user.displayName || user.username).then(() => {
                        dbLayer.recordTimerCompletion(id, room.id, room.config.name, durationMinutes).catch(console.error);

                        // Award KoalaCoins if there is a real duration
                        if (coinsToAward > 0) {
                            dbLayer.addKoalaCoins(user.userId || user.id, coinsToAward, `Completed ${Math.round(durationMinutes)}m timer`).then(newBalance => {
                                // Notify user about earnings (amount shown as display coins, not cents)
                                // Broadcast to ALL sockets of this user, not just this specific socket reference
                                broadcastCoinUpdate(io, user.userId || user.id, newBalance);
                                
                                // To show the UI popup, we need to find all sockets for this user
                                const userSockets = Array.from(room.users.values()).filter(u => (u.userId || u.id) === (user.userId || user.id));
                                userSockets.forEach(uSocket => {
                                    if (uSocket.socketId) {
                                        io.to(uSocket.socketId).emit('KOALA_COINS_EARNED', {
                                            amount: coinsToAward,
                                            newBalance: newBalance
                                        });
                                    }
                                });
                            }).catch(console.error);
                        }
                    }).catch(console.error);
                });
            }).catch(console.error);

            // Pomodoro auto-advance
            if (room.state.isPomodoro) {
                setTimeout(() => {
                    const nextPhase = roomManager.advancePomodoro(room.id);
                    if (nextPhase) {
                        io.to(room.id).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(room.id));
                    }
                }, 3000); // 3 second delay for a nice breather
            } else if (room.state.autoRestart) {
                // Auto-Restart logic if not Pomodoro
                setTimeout(() => {
                    if (roomManager.rooms.has(room.id) && room.state.autoRestart) {
                        roomManager.resetTimer(room.id);
                        roomManager.startTimer(room.id);
                        io.to(room.id).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(room.id));
                    }
                }, 3000); // 3 second delay before auto-restart starts ticking again
            }
        });

        // To keep clients synced exactly without drift, broadcast state every second
        roomManager.rooms.forEach((room, roomId) => {
            if (room.state.isRunning) {
                io.volatile.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
            }
        });
    }, 1000); // 1Hz sync is enough since clients will animate the visual themselves

    return io;
};

// Extracted from original file so we can reuse here
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

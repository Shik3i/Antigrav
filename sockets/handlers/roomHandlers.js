const roomManager = require('../../utils/blackjackRoomManager');
const dbLayer = require('../../database');
const sanitize = require('../../sanitize');
const EVENTS = require('../../socketEvents.json');
const { safeEmit, safeStringify } = require('../../utils/safeSerialization');

function setupRoomHandlers(socket, io, roomManager, dbLayer, broadcastActiveRooms, JWT_SECRET) {
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

            if (memConfig.ownerId && String(joiningUserId) === String(memConfig.ownerId)) {
                // Room creator always gets write admin rights, regardless of token
                role = 'write';
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

            const joinResult = roomManager.joinRoom(roomId, socket.id, user);
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

            if (joinResult?.replacedSocketId) {
                io.to(roomId).emit(EVENTS.USER_LEFT, joinResult.replacedSocketId);
            }

            if (isNewJoin && !joinResult?.resumedSession) {
                safeEmitRoom(EVENTS.USER_JOINED, user);
                const ev = roomManager.addEvent(roomId, 'join', `${user.displayName} joined the room`, socket.id);
                if (ev) safeEmitRoom(EVENTS.ROOM_EVENT, ev);
            }

            safeEmitRoom(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));

            // Update room list for all
            broadcastActiveRooms(io);
        } catch (err) {
            console.error('Error joining room:', err);
            socket.emit(EVENTS.ERROR, 'An internal server error occurred while joining the room.');
        }
    });
}

module.exports = {
    setupRoomHandlers
};
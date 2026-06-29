const jwt = require('jsonwebtoken');
const dbLayer = require('../../database');
const apiController = require('../../controllers/apiController');
const apiDataService = require('../../services/apiDataService');
const EVENTS = require('../../socketEvents.json');
const JWT_SECRET = require('../../jwtSecret');
const { safeEmit } = require('../../utils/safeSerialization');

/**
 * Verify admin token
 */
async function verifyAdmin(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.userId) return false;

        const user = await dbLayer.getUser(decoded.userId);
        return user && user.is_superadmin;
    } catch (err) {
        return false;
    }
}

/**
 * Admin handlers
 */
function setupAdminHandlers(socket, io, onlineUsers, JWT_SECRET) {
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
            socket.emit(EVENTS.ADMIN_MAPPINGS_DATA, mappings);
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

    // Scratchcard Pools Admin
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

    // Scratchcard Economy Config
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

    // Cache Admin
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

    // Activity Admin
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

    // Room Admin
    socket.on(EVENTS.GET_ADMIN_ROOMS, async ({ token }) => {
        if (!(await verifyAdmin(token))) { socket.emit(EVENTS.ERROR, 'Unauthorized'); return; }
        try {
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
}

module.exports = {
    setupAdminHandlers,
    verifyAdmin
};
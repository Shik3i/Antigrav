const apiController = require('../../controllers/apiController');
const apiDataService = require('../../services/apiDataService');
const EVENTS = require('../../socketEvents.json');
const { safeEmit } = require('../../utils/safeSerialization');

function setupEsportsHandlers(socket, io, apiController, apiDataService) {
    // Global Data Fetchers (Bypasses Express HTTP Rate Limiting)
    socket.on(EVENTS.GET_API_NEWS, async () => {
        try {
            const userId = socket.user?.userId || null;
            const data = await apiController.fetchNewsData(userId);
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
}

module.exports = {
    setupEsportsHandlers
};
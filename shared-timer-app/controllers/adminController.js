const dbLayer = require('../database');
const apiDataService = require('../services/apiDataService');
const sanitize = require('../sanitize');
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../jwtSecret');

// --- Team Mappings ---
exports.getAdminMappings = async () => {
    return await dbLayer.getTeamMappings();
};

exports.addAdminMapping = async (originalCode, polymarketCode) => {
    if (!originalCode || !polymarketCode) throw new Error('Missing originalCode or polymarketCode');
    await dbLayer.addTeamMapping(originalCode, polymarketCode);
    apiDataService.invalidatePolymarketCache();
    return true;
};

exports.deleteAdminMapping = async (id) => {
    await dbLayer.deleteTeamMapping(id);
    apiDataService.invalidatePolymarketCache();
    return true;
};

// --- Cache Management ---
exports.getAdminCacheStatus = () => {
    // Note: oddsApiCache is currently in apiController. It will need to be moved or passed.
    // For now, we'll delegate the oddsApi part or move the cache.
    // Let's assume for this atomic step we focus on the functions.
    // I will move the oddsApiCache to externalController later.
    // For now, I'll return what apiDataService provides.
    return {
        ...apiDataService.getAdminCacheStatus()
    };
};

exports.flushAdminCache = (target) => {
    apiDataService.flushAdminCache(target);
    return exports.getAdminCacheStatus();
};

// --- Bet Management ---
exports.getAdminBets = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const bets = await dbLayer.getAllBetsAdmin();
        res.json(bets);
    } catch (err) {
        console.error('[Admin Bets] Fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch bets' });
    }
};

exports.updateAdminBetStatus = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['open', 'won', 'lost', 'canceled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        await dbLayer.updateBetStatusAdmin(id, status);
        res.json({ success: true, message: `Status updated to ${status}` });
    } catch (err) {
        console.error(`[Admin Bets] Error updating bet ${req.params?.id}:`, err);
        res.status(500).json({ error: 'Failed to update bet status' });
    }
};

exports.triggerAdminBetResolver = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { resolveBets } = require('../cron/betResolver');
        const stats = await resolveBets();
        res.json({ 
            success: true, 
            message: 'Resolver finished', 
            matchesProcessed: stats?.processedMatches || 0,
            betsResolved: stats?.resolvedBets || 0,
            unresolvedFound: stats?.unresolvedCount || 0
        });
    } catch (err) {
        console.error('[Admin Bets] Trigger error:', err);
        res.status(500).json({ error: 'Failed' });
    }
};

// --- Logging & Actions ---
exports.getAdminActions = async (req, res) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const actions = await dbLayer.getAdminActions(500);
        res.json(actions);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch admin actions' });
    }
};

exports.getErrorLogs = async (req, res) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const logs = await dbLayer.getErrorLogs(500);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch error logs' });
    }
};

exports.getSystemLogs = async (req, res) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const logs = await dbLayer.getSystemLogs();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch system logs' });
    }
};

exports.deleteAllSystemLogs = async (req, res) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        await dbLayer.clearSystemLogs();
        res.json({ success: true });
    } catch (err) {
        console.error('deleteAllSystemLogs error:', err);
        res.status(500).json({ error: 'Failed to clear system logs' });
    }
};

exports.deleteErrorLog = async (req, res) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;
    try {
        await dbLayer.deleteErrorLog(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete error log' });
    }
};

exports.clearErrorLogs = async (req, res) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        await dbLayer.clearErrorLogs();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clear error logs' });
    }
};

// --- Game Settings ---
exports.updateAdminGameSettings = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const user = await dbLayer.getUser(userId);

        if (!user || !user.is_superadmin) {
            return res.status(403).json({ error: 'Nur Superadmins können Spieleeinstellungen ändern' });
        }

        const { koala_coin_conversion_rate, koala_daily_mission_reward } = req.body;
        const updates = {};
        if (koala_coin_conversion_rate !== undefined) updates.koala_coin_conversion_rate = koala_coin_conversion_rate;
        if (koala_daily_mission_reward !== undefined) updates.koala_daily_mission_reward = koala_daily_mission_reward;

        await dbLayer.updateKoalaBaseline(updates);
        await dbLayer.logAdminAction(userId, user.username, 'UPDATE_GAME_SETTINGS', { updates });

        res.json({ success: true });
    } catch (err) {
        console.error('[Games] Error updating admin game settings:', err);
        if (dbLayer.logError) await dbLayer.logError(`Admin Game Settings Update Failed: ${err.message}`, err.stack, req.user?.id);
        res.status(500).json({ error: 'Spieleeinstellungen konnten nicht aktualisiert werden' });
    }
};

exports.getAdminGameScores = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const user = await dbLayer.getUser(userId);
        if (!user || !user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });

        const gameId = req.query.gameId || 'koala_flap';
        const scores = await dbLayer.getAdminGameScores(gameId);
        res.json(scores);
    } catch (err) {
        console.error('[Admin] Error fetching game scores:', err);
        res.status(500).json({ error: 'Failed to fetch game scores' });
    }
};

exports.deleteAdminGameScore = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const user = await dbLayer.getUser(userId);
        if (!user || !user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });

        const { id } = req.params;
        await dbLayer.deleteGameScore(id);
        await dbLayer.logAdminAction(userId, user.username, 'DELETE_GAME_SCORE', { scoreId: id });

        res.json({ success: true });
    } catch (err) {
        console.error('[Admin] Error deleting game score:', err);
        res.status(500).json({ error: 'Failed to delete game score' });
    }
};

// --- Navbar Settings ---
exports.getPublicNavbarSettings = async (req, res, next) => {
    try {
        const { data } = await apiDataService.getNavbarSettings(false);
        res.json(data);
    } catch (err) {
        next(err);
    }
};

exports.getAdminNavbarSettings = async (req, res, next) => {
    try {
        const { data } = await apiDataService.getNavbarSettings(true);
        res.json(data);
    } catch (err) {
        next(err);
    }
};

exports.updateNavbarSettings = async (req, res, next) => {
    try {
        const { settings } = req.body;
        if (!settings || !Array.isArray(settings)) {
            return res.status(400).json({ error: 'Settings must be an array' });
        }

        const normalizedSettings = settings.map((item, index) => ({
            ...item,
            sortOrder: index + 1
        }));

        await dbLayer.updateNavbarSettings(normalizedSettings);
        apiDataService.invalidateNavbarSettingsCache();
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

// --- RSS Admin ---
exports.getAdminRssFeeds = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const feeds = await dbLayer.getRssFeeds();
        res.json(feeds);
    } catch (err) {
        next(err);
    }
};

exports.addAdminRssFeed = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { name, url, icon } = req.body;
        if (!name || !url) return res.status(400).json({ error: 'Name and URL required' });
        
        const feed = await dbLayer.addRssFeed(name, url, icon);
        const rssService = require('../services/rssService');
        rssService.refreshFeed(feed.id, feed.url).catch(e => console.error('[Admin RSS] Initial fetch failed:', e.message));

        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'ADD_RSS_FEED', { name, url });
        res.status(201).json(feed);
    } catch (err) {
        next(err);
    }
};

exports.updateAdminRssFeed = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        const { name, url, icon } = req.body;
        await dbLayer.updateRssFeed(id, name, url, icon);
        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'UPDATE_RSS_FEED', { id, name, url });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.deleteAdminRssFeed = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        await dbLayer.deleteRssFeed(id);
        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'DELETE_RSS_FEED', { id });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.getAdminRssStats = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const stats = await dbLayer.getRssCacheStats();
        res.json(stats);
    } catch (err) {
        next(err);
    }
};

exports.getAdminRssArticles = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const articles = await dbLayer.getAdminRssArticles(limit, offset);
        res.json(articles);
    } catch (err) {
        next(err);
    }
};

exports.deleteAdminRssArticle = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        await dbLayer.deleteRssArticle(id);
        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'DELETE_RSS_ARTICLE', { id });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.purgeAdminRssArticles = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { hours } = req.body;
        const changes = await dbLayer.purgeRssArticles(hours || 24);
        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'PURGE_RSS_CACHE', { hours });
        res.json({ success: true, deleted: changes });
    } catch (err) {
        next(err);
    }
};

exports.manualRefreshAllRss = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const rssService = require('../services/rssService');
        const stats = await rssService.refreshAllFeeds();
        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'MANUAL_RSS_REFRESH', stats);
        res.json({ success: true, stats });
    } catch (err) {
        next(err);
    }
};

// --- Pokemon Admin ---
exports.getPublicPokemonConfigs = async (req, res, next) => {
    try {
        const { data } = await apiDataService.getPokemonConfigs();
        res.json(data);
    } catch (err) {
        next(err);
    }
};

exports.getPokemonConfigs = async (req, res, next) => {
    try {
        if (!req.user || !req.user.is_superadmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { data } = await apiDataService.getPokemonConfigs();
        res.json(data);
    } catch (err) {
        next(err);
    }
};

exports.updatePokemonConfigs = async (req, res, next) => {
    try {
        if (!req.user || !req.user.is_superadmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { settings, colors } = req.body;
        await dbLayer.updatePokemonConfigs(settings, colors);
        apiDataService.invalidatePokemonConfigsCache();
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

// --- RSS Admin ---
exports.getAdminRssFeeds = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const feeds = await dbLayer.getRssFeeds();
        res.json(feeds);
    } catch (err) {
        next(err);
    }
};

exports.addAdminRssFeed = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { name, url, icon } = req.body;
        if (!name || !url) return res.status(400).json({ error: 'Name and URL required' });
        
        const feed = await dbLayer.addRssFeed(name, url, icon);
        const rssService = require('../services/rssService');
        rssService.refreshFeed(feed.id, feed.url).catch(e => console.error('[Admin RSS] Initial fetch failed:', e.message));

        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'ADD_RSS_FEED', { name, url });
        res.status(201).json(feed);
    } catch (err) {
        next(err);
    }
};

exports.updateAdminRssFeed = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        const { name, url, icon } = req.body;
        await dbLayer.updateRssFeed(id, name, url, icon);
        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'UPDATE_RSS_FEED', { id, name, url });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.deleteAdminRssFeed = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        await dbLayer.deleteRssFeed(id);
        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'DELETE_RSS_FEED', { id });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.getAdminRssStats = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const stats = await dbLayer.getRssCacheStats();
        res.json(stats);
    } catch (err) {
        next(err);
    }
};

exports.getAdminRssArticles = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const articles = await dbLayer.getAdminRssArticles(limit, offset);
        res.json(articles);
    } catch (err) {
        next(err);
    }
};

exports.deleteAdminRssArticle = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        await dbLayer.deleteRssArticle(id);
        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'DELETE_RSS_ARTICLE', { id });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.purgeAdminRssArticles = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { hours } = req.body;
        const changes = await dbLayer.purgeRssArticles(hours || 24);
        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'PURGE_RSS_CACHE', { hours });
        res.json({ success: true, deleted: changes });
    } catch (err) {
        next(err);
    }
};

exports.manualRefreshAllRss = async (req, res, next) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const rssService = require('../services/rssService');
        const stats = await rssService.refreshAllFeeds();
        await dbLayer.logAdminAction(req.user.userId || req.user.id, req.user.username, 'MANUAL_RSS_REFRESH', stats);
        res.json({ success: true, stats });
    } catch (err) {
        next(err);
    }
};

// --- Scratchcard Admin ---
exports.adminCreateScratchPack = async (req, res) => {
    try {
        const { pack, teams } = req.body;
        const newPack = await dbLayer.createScratchcardPack(pack);
        if (teams && Array.isArray(teams)) {
            await dbLayer.setScratchcardPackTeams(newPack.id, teams);
        }
        res.json({ success: true, pack: newPack });
    } catch (err) {
        console.error('adminCreateScratchPack error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.adminUpdateScratchPack = async (req, res) => {
    try {
        const { id } = req.params;
        const { pack, teams } = req.body;
        await dbLayer.updateScratchcardPack(id, pack);
        if (teams && Array.isArray(teams)) {
            await dbLayer.setScratchcardPackTeams(id, teams);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('adminUpdateScratchPack error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.adminDeleteScratchPack = async (req, res) => {
    try {
        const { id } = req.params;
        await dbLayer.deleteScratchcardPack(id);
        res.json({ success: true });
    } catch (err) {
        console.error('adminDeleteScratchPack error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getScratchcardPackFull = async (req, res) => {
    try {
        const { id } = req.params;
        const pack = await dbLayer.getScratchcardPack(id);
        const teams = await dbLayer.getScratchcardPackTeams(id);
        res.json({ pack, teams });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- Other Admin ---
exports.unlockAdmin = async (req, res) => {
    const { password } = req.body;
    const adminPwd = process.env.ADMIN_PASSWORD || 'Entangled-Napping7-Custodian';

    if (password === adminPwd) {
        const token = jwt.sign({ 
            is_superadmin: true,
            username: 'admin_session',
            role: 'global_admin'
        }, JWT_SECRET, { expiresIn: '6h' });
        
        return res.json({ token });
    } else {
        return res.status(401).json({ error: 'Falsches Passwort' });
    }
};

exports.updateLeaderboardSettings = async (req, res) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { game_id, is_hidden } = req.body;
        if (!game_id) return res.status(400).json({ error: 'game_id is required' });
        
        await dbLayer.updateLeaderboardSetting(game_id, is_hidden);
        res.json({ success: true });
    } catch (err) {
        console.error('[Leaderboard Settings] Error updating:', err);
        res.status(500).json({ error: 'Failed' });
    }
};

const axios = require('axios');
const dbLayer = require('../database');
const apiDataService = require('../services/apiDataService');
const sanitize = require('../sanitize');
const { safeJson } = require('../utils/safeSerialization');

// --- News & RSS ---
exports.fetchNewsData = async (userId = null) => {
    try {
        const articles = await dbLayer.getTickerNews(userId, 50);
        return articles.map(a => ({
            title: a.title,
            link: a.link,
            imageUrl: a.imageUrl,
            snippet: a.snippet,
            pubDate: a.pubDate,
            feedId: a.feedId,
            feedName: a.feedName,
            feedIcon: a.feedIcon
        }));
    } catch (err) {
        console.error('[API Controller] fetchNewsData error:', err);
        return [];
    }
};

exports.getNews = async (req, res, next) => {
    try {
        const news = await exports.fetchNewsData();
        safeJson(res, news);
    } catch (err) {
        console.error('Failed to fetch News from DB:', err);
        res.status(500).json({ error: 'Failed to fetch news feed' });
    }
};

exports.getRssFeeds = async (req, res, next) => {
    try {
        const feeds = await dbLayer.getRssFeeds();
        res.json(feeds);
    } catch (err) {
        next(err);
    }
};

exports.getRssArticles = async (req, res, next) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        let visibleFeedIds = null;

        if (userId) {
            const prefs = await dbLayer.getUserRssPreferences(userId);
            const allFeeds = await dbLayer.getRssFeeds();
            visibleFeedIds = allFeeds
                .filter(f => {
                    const pref = prefs.find(p => p.feedId === f.id);
                    return pref ? !!pref.showOnSite : true;
                })
                .map(f => f.id);
            if (visibleFeedIds.length === 0) return res.json([]);
        }

        const articles = await dbLayer.getCachedArticles(visibleFeedIds, 100);
        res.json(articles);
    } catch (err) {
        next(err);
    }
};

exports.getUserRssPreferences = async (req, res, next) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const prefs = await dbLayer.getUserRssPreferences(userId);
        res.json(prefs);
    } catch (err) {
        next(err);
    }
};

exports.updateRssPreference = async (req, res, next) => {
    try {
        const { feedId, showOnSite, showInTicker } = req.body;
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        await dbLayer.updateUserRssPreference(userId, feedId, showOnSite, showInTicker);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

// --- Esports & Betting ---
exports.fetchEsportsData = async (forceRefresh = false) => {
    const { data } = await apiDataService.getEsportsSchedule({ forceRefresh });
    return data;
};

exports.fetchAllEsportsTeams = async () => {
    const { data } = await apiDataService.syncEsportsTeams({ forceRefresh: true });
    return data;
};

exports.initializeEsportsDb = async () => {
    try {
        await apiDataService.initializeEsportsData();
    } catch (err) {
        console.error('[API] Failed to check Esports DB sync status:', err.message);
    }
};

exports.getAllEsportsTeamsFromDB = async () => {
    const { data } = await apiDataService.getEsportsTeams();
    return data;
};

exports.getEsportsTeams = async (req, res, next) => {
    try {
        const { data } = await apiDataService.getEsportsTeams();
        safeJson(res, data);
    } catch (err) {
        console.error('Failed to fetch esports teams list:', err);
        res.status(500).json({ error: 'Failed' });
    }
};

exports.getEsportsTeamsLastUpdated = async () => {
    return await dbLayer.getEsportsTeamsLastUpdated();
};

exports.getEsports = async (req, res, next) => {
    try {
        const schedule = await exports.fetchEsportsData();
        safeJson(res, schedule);
    } catch (err) {
        console.error('Failed to fetch LoL Esports Schedule:', err);
        dbLayer.logError('Failed to fetch LoL Esports Schedule', err.message, err.stack);
        res.status(500).json({ error: 'Failed to fetch esports schedule' });
    }
};

exports.fetchPolymarketOddsData = async (forceRefreshMatch = null) => {
    const { data } = await apiDataService.getPolymarketOdds({ forceRefreshMatch });
    return data;
};

exports.getPolymarketOdds = async (req, res, next) => {
    try {
        const odds = await exports.fetchPolymarketOddsData();
        safeJson(res, odds);
    } catch (err) {
        console.error('Polymarket fetch failed:', err.message);
        dbLayer.logError('Polymarket fetch failed', err.stack);
        res.status(500).json({ error: 'Failed to fetch Polymarket odds' });
    }
};

// --- The Odds API (Backup) ---
let oddsApiCache = { data: null, timestamp: 0 };
const ODDS_CACHE_TTL = 30 * 60 * 1000;

exports.getTheOddsApi = async (req, res, next) => {
    try {
        const apiKey = process.env.THE_ODDS_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'THE_ODDS_API_KEY not configured' });

        const now = Date.now();
        if (oddsApiCache.data && (now - oddsApiCache.timestamp) < ODDS_CACHE_TTL) {
            return res.json(oddsApiCache.data);
        }

        const response = await axios.get('https://api.the-odds-api.com/v4/sports/esports_lol/odds', {
            params: { apiKey, regions: 'eu,us', markets: 'h2h', oddsFormat: 'decimal' }
        });

        const events = response.data || [];
        const odds = events.map(event => ({
            id: event.id,
            startTime: event.commence_time,
            homeTeam: event.home_team,
            awayTeam: event.away_team,
            bookmakers: (event.bookmakers || []).slice(0, 3).map(bk => ({
                name: bk.title,
                markets: (bk.markets || []).map(m => ({
                    key: m.key,
                    outcomes: m.outcomes.map(o => ({ name: o.name, price: o.price }))
                }))
            }))
        }));

        oddsApiCache = { data: odds, timestamp: now };
        res.json(odds);
    } catch (err) {
        console.error('The Odds API fetch failed:', err.message);
        res.status(500).json({ error: 'Failed to fetch odds' });
    }
};

exports.getOddsApiCacheStatus = () => {
    return {
        isCached: !!oddsApiCache.data,
        items: oddsApiCache.data ? oddsApiCache.data.length : 0,
        ageSeconds: oddsApiCache.timestamp ? Math.round((Date.now() - oddsApiCache.timestamp) / 1000) : null
    };
};

exports.flushOddsApiCache = () => {
    oddsApiCache = { data: null, timestamp: 0 };
};

exports.placeBet = async (req, res, next) => {
    try {
        const { matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate, team1Logo, team2Logo, league } = req.body;
        const userId = req.user?.id || req.user?.userId;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!stake || isNaN(stake) || stake <= 0) return res.status(400).json({ error: 'Valid stake is required' });
        if (!matchName || !chosenTeam || !odds || !polymarketUrl || !eventDate) {
            return res.status(400).json({ error: 'Missing required bet parameters' });
        }

        if (parseFloat(odds) <= 1.01 || parseFloat(odds) >= 100.0) {
            return res.status(400).json({ error: 'Odds are not valid or the market is already resolved.' });
        }

        const parsedStake = parseInt(stake, 10);
        const user = await dbLayer.getUser(userId);
        if (!user || (user.koala_balance || 0) < parsedStake) {
            return res.status(400).json({ error: 'Insufficient KoalaCoins' });
        }

        await dbLayer.addKoalaCoins(userId, -parsedStake, `Polymarket (Esports): ${matchName} (Team: ${chosenTeam})`);
        const bet = await dbLayer.createBet(userId, sanitize(matchName), sanitize(chosenTeam), sanitize(polymarketTeam || chosenTeam), parsedStake, odds, polymarketUrl, eventDate, league, team1Logo, team2Logo);

        res.status(201).json({ success: true, betId: bet.id });
    } catch (err) {
        console.error('Error placing bet:', err);
        res.status(500).json({ error: 'Failed to place bet' });
    }
};

exports.getBets = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const bets = await dbLayer.getUserBets(userId);
        res.json(bets);
    } catch (err) {
        console.error('Error fetching bets:', err);
        res.status(500).json({ error: 'Failed to fetch bets' });
    }
};

exports.getRecentBets = async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const bets = await dbLayer.getRecentBets(days);
        res.json(bets);
    } catch (err) {
        console.error('Error fetching recent bets:', err);
        res.status(500).json({ error: 'Failed to fetch recent bets' });
    }
};

exports.getBettingAccuracy = async (req, res) => {
    try {
        const leaderboard = await dbLayer.getBettingAccuracyLeaderboard();
        res.json(leaderboard);
    } catch (err) {
        console.error('[Accuracy] Error fetching leaderboard:', err);
        res.status(500).json({ error: 'Failed' });
    }
};

// --- Twitch ---
exports.getTwitchStatus = async (req, res) => {
    try {
        const { data } = await apiDataService.getTwitchStatus();
        safeJson(res, data);
    } catch (err) {
        console.error('[Twitch] Status fetch failed:', err.message);
        res.status(500).json({ error: 'Twitch API error' });
    }
};

// Test Exports
exports.testEsports = async (req, res) => {
    const cacheStatus = apiDataService.getAdminCacheStatus();
    res.json({
        schedule: cacheStatus.loleSports,
        polymarketOdds: cacheStatus.polymarketEsports,
        oddsApiOdds: oddsApiCache.data || 'not cached yet — visit /api/esports/odds/backup first',
    });
};

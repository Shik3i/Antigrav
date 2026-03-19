const jwt = require('jsonwebtoken'); // used for secure invite links
const dbLayer = require('../database');
const roomManager = require('../roomManager');
const EVENTS = require('../socketEvents');
const sanitize = require('../sanitize');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const JWT_SECRET = require('../jwtSecret');

exports.getHighscores = async (req, res, next) => {
    try {
        const scores = await dbLayer.getHighscores(20);
        res.json(scores);
    } catch (err) {
        next(err);
    }
};

exports.getHighscoresCoins = async (req, res, next) => {
    try {
        const scores = await dbLayer.getTopUsersByCoins(20);
        res.json(scores);
    } catch (err) {
        next(err);
    }
};

exports.getActivityHistory = async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const history = await dbLayer.getActivityHistory(days);
        res.json(history);
    } catch (err) {
        next(err);
    }
};

exports.fetchNewsData = async () => {
    const response = await axios.get('https://www.tagesschau.de/xml/rss2/');
    const parser = new XMLParser();
    const jObj = parser.parse(response.data);

    let items = jObj?.rss?.channel?.item || [];
    if (!Array.isArray(items)) {
        items = [items];
    }

    // Map top 10 news items
    return items.slice(0, 10).map(item => ({
        title: item.title,
        link: item.link
    }));
};

exports.getNews = async (req, res, next) => {
    try {
        const news = await exports.fetchNewsData();
        res.json(news);
    } catch (err) {
        console.error('Failed to fetch News RSS:', err);
        res.status(500).json({ error: 'Failed to fetch news feed' });
    }
};

let esportsScheduleCache = { data: null, timestamp: 0 };
const SCHEDULE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

exports.fetchEsportsData = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && esportsScheduleCache.data && (now - esportsScheduleCache.timestamp) < SCHEDULE_CACHE_TTL) {
        return esportsScheduleCache.data;
    }

    try {
        const response = await axios.get('https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=en-GB', {
            headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }
        });

        let events = response.data?.data?.schedule?.events || [];

        // We want events that haven't finished yet (state: unstarted or inProgress)
        // No strict league filtering here, so that favorites from minor leagues can be found.
        const relevantMatches = events.filter(e => e.state !== 'completed');

        // Fetch team mappings to enrich the data with polymarket codes
        let mappings = [];
        try {
            mappings = await dbLayer.getTeamMappings();
        } catch (e) { }
        const mappingDict = mappings.reduce((acc, curr) => {
            acc[curr.originalCode.toLowerCase()] = curr.polymarketCode.toLowerCase();
            return acc;
        }, {});
        const getMappedCode = (code) => mappingDict[(code || '').toLowerCase()] || code;

        // Simplify the payload for the frontend
        const schedule = relevantMatches.slice(0, 80).map(e => {
            const t1Code = e.match?.teams?.[0]?.code || 'TBD';
            const t2Code = e.match?.teams?.[1]?.code || 'TBD';
            return {
                id: e.match?.id || e.id,
                startTime: e.startTime,
                state: e.state,
                league: e.league?.name,
                blockName: e.blockName || null,
                strategy: e.match?.strategy || null,
                team1: {
                    name: e.match?.teams?.[0]?.name || 'TBD',
                    code: t1Code,
                    polymarketCode: getMappedCode(t1Code),
                    image: e.match?.teams?.[0]?.image || null
                },
                team2: {
                    name: e.match?.teams?.[1]?.name || 'TBD',
                    code: t2Code,
                    polymarketCode: getMappedCode(t2Code),
                    image: e.match?.teams?.[1]?.image || null
                }
            };
        });

        esportsScheduleCache.data = schedule;
        esportsScheduleCache.timestamp = now;
        console.log(`[API] Synced ${schedule.length} upcoming esports matches (Cache valid for 6h).`);
        return schedule;
    } catch (err) {
        if (esportsScheduleCache.data) {
            console.error('[API] Schedule fetch failed, using stale cache:', err.message);
            return esportsScheduleCache.data;
        }
        throw err;
    }
};

exports.fetchAllEsportsTeams = async () => {
    try {
        const response = await axios.get('https://esports-api.lolesports.com/persisted/gw/getTeams?hl=en-GB', {
            headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }
        });
        const teams = response.data?.data?.teams || [];

        // Filter out TBD and map to our schema
        const mappedTeams = teams
            .filter(t => t.code && t.code.toUpperCase() !== 'TBD' && t.code.toUpperCase() !== 'TBDD' && t.status !== 'archived')
            .map(t => ({
                code: t.code,
                name: t.name,
                league: t.homeLeague?.name || 'Unknown',
                image: t.image
            }));

        // Remove duplicates by code
        const uniqueTeamsMap = new Map();
        mappedTeams.forEach(t => uniqueTeamsMap.set(t.code, t));
        const teamsList = Array.from(uniqueTeamsMap.values());

        if (teamsList.length > 0) {
            await dbLayer.upsertEsportsTeams(teamsList);
            console.log(`[API] Successfully synced ${teamsList.length} esports teams to local DB.`);
        }
        return teamsList;
    } catch (err) {
        console.error('Failed to save esports teams to local DB:', err.message);
        throw err;
    }
};

exports.initializeEsportsDb = async () => {
    try {
        const lastUpdatedStr = await dbLayer.getEsportsTeamsLastUpdated();
        const needsUpdate = !lastUpdatedStr || (Date.now() - new Date(lastUpdatedStr).getTime() > 24 * 60 * 60 * 1000); // 24 hours

        if (needsUpdate) {
            console.log('[API] Local Esports Teams DB is empty or older than 24 hours. Fetching automatically in the background...');
            exports.fetchAllEsportsTeams().catch(e => console.error('[API] Auto-sync teams failed:', e.message));
        } else {
            console.log('[API] Local Esports Teams DB is up-to-date. Skipping auto-sync.');
        }

        // Proactively fetch and cache the schedule on startup, and set interval to auto-update every 6 hours
        console.log('[API] Warming up Esports Schedule cache...');
        exports.fetchEsportsData(true).catch(e => console.error('[API] Auto-sync schedule failed:', e.message));
        
        setInterval(() => {
            console.log('[API] Auto-updating Esports Schedule cache (every 6 hours)...');
            exports.fetchEsportsData(true).catch(e => console.error('[API] Background schedule sync failed:', e.message));
        }, 6 * 60 * 60 * 1000);

    } catch (err) {
        console.error('[API] Failed to check Esports DB sync status:', err.message);
    }
};


exports.getAllEsportsTeamsFromDB = async () => {
    return await dbLayer.getAllEsportsTeams();
};

exports.getEsportsTeams = async (req, res, next) => {
    try {
        const teams = await dbLayer.getAllEsportsTeams();
        res.json(teams);
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
        res.json(schedule);
    } catch (err) {
        console.error('Failed to fetch LoL Esports Schedule:', err);
        dbLayer.logError('Failed to fetch LoL Esports Schedule', err.message, err.stack);
        res.status(500).json({ error: 'Failed to fetch esports schedule' });
    }
};

// ─── Polymarket Odds (Primary) ──────────────────────────────
// Cache to avoid hammering Polymarket on every page load
let polymarketCache = { data: null, timestamp: 0, lastForceRefresh: 0 };
const POLY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

exports.fetchPolymarketOddsData = async (forceRefreshMatch = null) => {
    const now = Date.now();
    
    // If NO forceRefreshMatch, normal cache rules apply
    if (!forceRefreshMatch && polymarketCache.data && (now - polymarketCache.timestamp) < POLY_CACHE_TTL) {
        return polymarketCache.data;
    }

    // 1-minute cooldown for force refreshing
    if (forceRefreshMatch && (now - polymarketCache.lastForceRefresh) < 60 * 1000) {
        return polymarketCache.data || [];
    }

    if (forceRefreshMatch) {
        polymarketCache.lastForceRefresh = now;
    }

    // If full refresh, we need schedule. If single match, we just use the provided match data.
    let schedule = [];
    if (!forceRefreshMatch) {
        schedule = await exports.fetchEsportsData().catch(() => []);
    }

    // Fetch custom team mappings from DB
    let mappings = [];
    try {
        mappings = await dbLayer.getTeamMappings();
    } catch (e) {
        console.error("Failed to load team mappings", e);
    }
    const mappingDict = mappings.reduce((acc, curr) => {
        acc[curr.originalCode.toLowerCase()] = curr.polymarketCode.toLowerCase();
        return acc;
    }, {});

    const getMappedCode = (code) => mappingDict[code] || code;

    const slugsToTry = [];

    const generateSlugsForMatch = (t1Code, t2Code, startTime) => {
        const t1 = getMappedCode((t1Code || '').toLowerCase());
        const t2 = getMappedCode((t2Code || '').toLowerCase());
        const matchDate = new Date(startTime);
        const generated = [];
        for (let i = -2; i <= 5; i++) {
            const d = new Date(matchDate);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            generated.push(`lol-${t1}-${t2}-${dateStr}`);
            generated.push(`lol-${t2}-${t1}-${dateStr}`);
        }
        return generated;
    };

    if (forceRefreshMatch) {
        slugsToTry.push(...generateSlugsForMatch(forceRefreshMatch.team1, forceRefreshMatch.team2, forceRefreshMatch.startTime));
    } else {
        schedule.forEach(match => {
            if (!match.team1 || !match.team2 || match.team1.code === 'TBD' || match.team2.code === 'TBD') return;
            slugsToTry.push(...generateSlugsForMatch(match.team1.code, match.team2.code, match.startTime));
        });
    }

    let allLolEvents = [];

    // Query Gamma API in batches of 50 slugs
    for (let i = 0; i < slugsToTry.length; i += 50) {
        const batch = slugsToTry.slice(i, i + 50);
        try {
            const response = await axios.get('https://gamma-api.polymarket.com/events', {
                params: { slug: batch },
                paramsSerializer: { indexes: null }
            });
            if (response.data && response.data.length > 0) {
                allLolEvents.push(...response.data);
            }
        } catch (e) {
            // Ignore fetch errors for batch
        }
    }

    const fetchedOdds = allLolEvents.map(event => {
        const markets = event.markets || [];

        // Find the match-winner market: prioritize "Match Winner" or "moneyline" type
        let winnerMarket = markets.find(m => m.sportsMarketType === 'moneyline' || m.groupItemTitle === 'Match Winner');

        // Fallback if not specifically tagged: 
        // has exactly 2 non-Yes/No outcomes and is NOT a sub-market like First Blood or Map Handicap
        if (!winnerMarket) {
            winnerMarket = markets.find(m => {
                try {
                    const names = JSON.parse(m.outcomes || '[]');
                    const isTwoTeam = names.length === 2
                        && !names.includes('Yes') && !names.includes('No')
                        && !names.includes('Over') && !names.includes('Under');

                    const question = (m.question || '').toLowerCase();
                    const isSubMarket = question.includes('first blood') || question.includes('game') || question.includes('handicap') || question.includes('map');

                    return isTwoTeam && !isSubMarket;
                } catch { return false; }
            });
        }

        if (!winnerMarket) return null;

        try {
            const outcomeNames = JSON.parse(winnerMarket.outcomes);
            const outcomePrices = JSON.parse(winnerMarket.outcomePrices || '[]');

            return {
                id: event.id,
                slug: event.slug,
                title: event.title,
                outcomes: outcomeNames.map((name, i) => ({
                    name,
                    price: parseFloat(outcomePrices[i] || 0),
                    pct: Math.round(parseFloat(outcomePrices[i] || 0) * 100)
                })),
                url: `https://polymarket.com/event/${event.slug}`
            };
        } catch { return null; }
    }).filter(Boolean);

    if (forceRefreshMatch) {
        if (!polymarketCache.data) polymarketCache.data = [];
        const cacheMap = new Map(polymarketCache.data.map(o => [o.id, o]));
        fetchedOdds.forEach(o => cacheMap.set(o.id, o));
        polymarketCache.data = Array.from(cacheMap.values());
    } else {
        polymarketCache.data = fetchedOdds;
        polymarketCache.timestamp = now;
    }

    return polymarketCache.data;
};

exports.getPolymarketOdds = async (req, res, next) => {
    try {
        const odds = await exports.fetchPolymarketOddsData();
        res.json(odds);
    } catch (err) {
        console.error('Polymarket fetch failed:', err.message);
        dbLayer.logError('Polymarket fetch failed', err.stack);
        res.status(500).json({ error: 'Failed to fetch Polymarket odds' });
    }
};

// ─── The Odds API (Backup) ──────────────────────────────────
let oddsApiCache = { data: null, timestamp: 0 };
const ODDS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes (save API quota)

exports.getTheOddsApi = async (req, res, next) => {
    try {
        const apiKey = process.env.THE_ODDS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'THE_ODDS_API_KEY not configured' });
        }

        const now = Date.now();
        if (oddsApiCache.data && (now - oddsApiCache.timestamp) < ODDS_CACHE_TTL) {
            return res.json(oddsApiCache.data);
        }

        const response = await axios.get('https://api.the-odds-api.com/v4/sports/esports_lol/odds', {
            params: {
                apiKey,
                regions: 'eu,us',
                markets: 'h2h',
                oddsFormat: 'decimal'
            }
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
                    outcomes: m.outcomes.map(o => ({
                        name: o.name,
                        price: o.price
                    }))
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

exports.registerUser = async (req, res, next) => {
    const { id, displayName, preferences } = req.body;
    const safeName = sanitize(displayName);
    try {
        const existing = await dbLayer.getUser(id);
        if (!existing) {
            await dbLayer.addUser(id, safeName);
        } else if (existing.displayName !== safeName) {
            await dbLayer.updateUserName(id, safeName);
        }

        if (preferences) {
            await dbLayer.updateUserPreferences(id, preferences);
        }

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.getRooms = async (req, res, next) => {
    let friendIds = new Set();

    // If user is authenticated, fetch their friends to allow them to see "visibleToFriends" rooms
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

            // Room must be active (users inside or in timeout)
            const isActive = r.users.size > 0 || r.timeoutId !== null;

            if (!isActive) return false;

            // Include if public OR if it's protected but visible to friends AND we are a friend
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

        // Generate invite tokens
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

    // Strict KISS validation
    if (action !== 'play' && action !== 'pause') {
        return res.status(400).json({ error: 'Invalid action. Only "play" or "pause" allowed.' });
    }

    try {
        const io = req.app.get('io');
        if (io) {
            // Broadcast simple event immediately to all clients in this exact room
            io.to(id).emit('media_command', { action });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Media broadcast error:', err);
        next(err);
    }
};

// Debug/Test APIs
exports.testDbRooms = (req, res) => {
    // Returns full detailed state of all rooms in memory
    const roomsList = [];
    roomManager.rooms.forEach((room, roomId) => {
        roomsList.push(roomManager.getRoomState(roomId));
    });
    res.json(roomsList);
};

exports.testRoomAction = async (req, res, next) => {
    // Allows sending an action directly to a room without a socket
    const { id } = req.params;
    const { action, payload } = req.body;

    try {
        let room = roomManager.getRoom(id);
        if (!room) {
            return res.status(404).json({ success: false, error: 'Room not found in memory' });
        }

        let changed = false;
        switch (action) {
            case 'START':
                changed = roomManager.startTimer(id);
                break;
            case 'PAUSE':
                changed = roomManager.pauseTimer(id);
                break;
            case 'RESET':
                changed = roomManager.resetTimer(id);
                break;
            case 'SET_DURATION':
                changed = roomManager.setDuration(id, payload);
                break;
        }

        if (changed) {
            // we will pass io in req.app.get('io') to emit changes
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

// ─── Test endpoint: cached esports + odds combined ──────────
exports.testEsports = async (req, res) => {
    res.json({
        schedule: {
            cached: !!polymarketCache.data,
            cacheAge: polymarketCache.timestamp ? `${Math.round((Date.now() - polymarketCache.timestamp) / 1000)}s ago` : 'never',
        },
        polymarketOdds: polymarketCache.data || 'not cached yet — visit /api/esports/odds/polymarket first',
        oddsApiOdds: oddsApiCache.data || 'not cached yet — visit /api/esports/odds/backup first',
    });
};

// ─── Admin Controller Methods ─────────────────────────────────
exports.getAdminMappings = async () => {
    return await dbLayer.getTeamMappings();
};

exports.addAdminMapping = async (originalCode, polymarketCode) => {
    if (!originalCode || !polymarketCode) throw new Error('Missing originalCode or polymarketCode');
    await dbLayer.addTeamMapping(originalCode, polymarketCode);
    polymarketCache = { data: null, timestamp: 0 }; // Invalidate cache so it rebuilds with new mappings
    return true;
};

exports.deleteAdminMapping = async (id) => {
    await dbLayer.deleteTeamMapping(id);
    polymarketCache = { data: null, timestamp: 0 }; // Invalidate cache
    return true;
};

exports.getAdminCacheStatus = () => {
    return {
        polymarket: {
            isCached: !!polymarketCache.data,
            items: polymarketCache.data ? polymarketCache.data.length : 0,
            ageSeconds: polymarketCache.timestamp ? Math.round((Date.now() - polymarketCache.timestamp) / 1000) : null
        },
        oddsApi: {
            isCached: !!oddsApiCache.data,
            items: oddsApiCache.data ? oddsApiCache.data.length : 0,
            ageSeconds: oddsApiCache.timestamp ? Math.round((Date.now() - oddsApiCache.timestamp) / 1000) : null
        },
        loleSports: {
            isCached: !!esportsScheduleCache.data,
            items: esportsScheduleCache.data ? esportsScheduleCache.data.length : 0,
            ageSeconds: esportsScheduleCache.timestamp ? Math.round((Date.now() - esportsScheduleCache.timestamp) / 1000) : null
        }
    };
};

exports.flushAdminCache = (target) => {
    if (target === 'polymarket' || target === 'all') {
        polymarketCache = { data: null, timestamp: 0 };
    }
    if (target === 'oddsapi' || target === 'all') {
        oddsApiCache = { data: null, timestamp: 0 };
    }
    if (target === 'lolesports' || target === 'all') {
        esportsScheduleCache = { data: null, timestamp: 0 };
    }
    return exports.getAdminCacheStatus();
};

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
        
        // Execute the cron logic directly but as fire-and-forget so we don't hang the request
        resolveBets()
            .then(() => console.log('[Admin Bets] Manual trigger of resolveBets finished'))
            .catch(e => console.error('[Admin Bets] Manual trigger error:', e));

        res.json({ success: true, message: 'Bet resolver started manually in the background' });
    } catch (err) {
        console.error('[Admin Bets] Trigger error:', err);
        res.status(500).json({ error: 'Failed' });
    }
};

// ─── Countdowns ─────────────────────────────────────────────
exports.getCountdowns = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || null;
        if (req.user) {
            console.log(`[Countdowns] Fetching for user: ${userId} (${req.user.username || 'unknown'})`);
        } else {
            console.log(`[Countdowns] Fetching for guest/unauthenticated user`);
        }
        const countdowns = await dbLayer.getCountdowns(userId);
        console.log(`[Countdowns] Returning ${countdowns.length} items for user ${userId}`);
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

        // Only superadmins can create global countdowns
        if (isGlobal && !isAdmin) {
            console.warn(`[Countdowns] Non-admin ${userId} tried to create global countdown`);
            return res.status(403).json({ error: 'Only superadmins can create global countdowns' });
        }

        console.log(`[Countdowns] Creating: ${eventName} for user ${userId} (isAdmin: ${isAdmin}, isPublic: ${isPublic})`);

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

        console.log(`[Countdowns] Delete attempt: ID ${id}, Owner ${countdown.userId}, Requester ${currentUserId}, isAdmin ${isAdmin}`);

        // Only the owner or a superadmin can delete
        const isOwner = countdown.userId === currentUserId && currentUserId !== null && currentUserId !== undefined;

        if (!isOwner && !isAdmin) {
            console.warn(`[Countdowns] DELETE REJECTED: User ${currentUserId} is not owner or admin`);
            return res.status(403).json({ error: 'Permission denied' });
        }

        await dbLayer.deleteCountdown(id);
        console.log(`[Countdowns] Deleted ID ${id} by ${currentUserId}`);
        res.json({ message: 'Countdown deleted' });
    } catch (err) {
        console.error('[Countdowns] Error deleting:', err);
        res.status(500).json({ error: 'Failed to delete countdown' });
    }
};

// ─── Error Logging ──────────────────────────────────────────
exports.getAdminActions = async (req, res) => {
    if (!req.user || !req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const actions = await dbLayer.getAdminActions(500);
        res.json(actions);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch admin actions' });
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

let twitchToken = { value: null, expires: 0 };
async function getTwitchAccessToken() {
    if (twitchToken.value && Date.now() < twitchToken.expires) return twitchToken.value;
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    try {
        const res = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`);
        twitchToken = { value: res.data.access_token, expires: Date.now() + (res.data.expires_in * 1000) - 60000 };
        return twitchToken.value;
    } catch (e) {
        console.error('[Twitch] Token fetch failed:', e.message);
        return null;
    }
}

exports.getTwitchStatus = async (req, res) => {
    const channels = ['handofblood', 'eintrachtspandau', 'tolkin', 'lec', 'lck'];
    const token = await getTwitchAccessToken();
    const clientId = process.env.TWITCH_CLIENT_ID;

    if (!token || !clientId) {
        // Fallback: everyone is offline if no credentials provided
        return res.json(channels.map(c => ({
            user_login: c,
            is_live: false, 
            game_name: null,
            viewer_count: 0
        })));
    }

    try {
        const query = channels.map(c => `user_login=${c}`).join('&');
        const response = await axios.get(`https://api.twitch.tv/helix/streams?${query}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${token}`
            }
        });

        const liveStreams = response.data.data || [];
        const status = channels.map(login => {
            const stream = liveStreams.find(s => s.user_login.toLowerCase() === login.toLowerCase());
            let isLive = !!stream;
            
            // Special rule for HandOfBlood: only "Online" if category is LoL
            if (login.toLowerCase() === 'handofblood' && stream) {
                isLive = stream.game_name === 'League of Legends';
            }

            return {
                user_login: login,
                is_live: isLive,
                game_name: stream ? stream.game_name : null,
                viewer_count: stream ? stream.viewer_count : 0,
                thumbnail_url: stream ? stream.thumbnail_url : null
            };
        });

        res.json(status);
    } catch (err) {
        console.error('[Twitch] Status fetch failed:', err.message);
        res.status(500).json({ error: 'Twitch API error' });
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

// ─── Bets ───────────────────────────────────────────────────
exports.placeBet = async (req, res, next) => {
    try {
        const { matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate } = req.body;
        const userId = req.user?.id || req.user?.userId;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!stake || isNaN(stake) || stake <= 0) return res.status(400).json({ error: 'Valid stake is required' });
        if (!matchName || !chosenTeam || !odds || !polymarketUrl || !eventDate) {
            return res.status(400).json({ error: 'Missing required bet parameters' });
        }

        // Bet validation: Game relies on Polymarket resolution context now, allow live betting.

        // Bet validation: Odds must not imply 100% or 0% probability
        if (parseFloat(odds) <= 1.01 || parseFloat(odds) >= 100.0) {
            return res.status(400).json({ error: 'Odds are not valid or the market is already resolved.' });
        }

        const parsedStake = parseInt(stake, 10);

        // Check user balance
        const userCount = await dbLayer.getUser(userId); // returns user obj
        if (!userCount || (userCount.koala_balance || 0) < parsedStake) {
            return res.status(400).json({ error: 'Insufficient KoalaCoins' });
        }

        // Deduct coins
        await dbLayer.addKoalaCoins(userId, -parsedStake, `Bet placed on ${chosenTeam}`);

        // Create bet
        const bet = await dbLayer.createBet(userId, sanitize(matchName), sanitize(chosenTeam), sanitize(polymarketTeam || chosenTeam), parsedStake, odds, polymarketUrl, eventDate);

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

exports.getKoalaTransactions = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Pass 0 to fetch all transactions for historical chart mapping
        const transactions = await dbLayer.getKoalaTransactions(userId, 0);
        res.json(transactions);
    } catch (err) {
        console.error('Error fetching koala transactions:', err);
        res.status(500).json({ error: 'Failed to fetch koala transactions' });
    }
};

// ─── Feature Request Roadmap ─────────────────────────────────────
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
        const { title, description } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });

        const userId = req.user?.id || req.user?.userId;
        const userName = req.user?.displayName || req.user?.username || 'Unknown';

        const id = await dbLayer.createFeatureRequest(userId, userName, sanitize(title), sanitize(description || ''));
        res.status(201).json({ id, message: 'Feature request created' });
    } catch (err) {
        console.error('[Features] Error creating:', err);
        res.status(500).json({ error: 'Failed to create feature request' });
    }
};

exports.voteFeatureRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { value, guestId } = req.body; // 1 or -1
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

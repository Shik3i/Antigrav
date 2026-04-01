const jwt = require('jsonwebtoken'); // used for secure invite links
const fs = require('fs');
const path = require('path');
const dbLayer = require('../database');
const roomManager = require('../roomManager');
const EVENTS = require('../socketEvents');
const sanitize = require('../sanitize');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const JWT_SECRET = require('../jwtSecret');

// Performance Protection: Debounce for immediate bet resolution trigger
let lastBetResolutionTrigger = 0;
const BET_RESOLUTION_COOLDOWN = 10 * 60 * 1000; // 10 minutes between automated triggers via API calls

// News Cache (Tagesschau API)
let newsCache = null;
let lastNewsFetch = 0;
const NEWS_TTL = 15 * 60 * 1000; // 15 Minuten

// Pokémon Cache for performance (DRY/Performance Optimization)
let pokemonMemoryCache = null;

// Changelog Cache
let changelogCache = null;

// Pokémon Config Cache
let pokemonConfigsCache = null;

// Navbar Settings Cache
let navbarSettingsCache = null;

// Esports Teams Cache
let esportsTeamsCache = null;

// Scratchcard Packs Cache (Metadata + Teams)
let scratchcardPacksCache = null;

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
    const now = Date.now();
    if (newsCache && (now - lastNewsFetch < NEWS_TTL)) {
        return newsCache;
    }

    const response = await axios.get('https://www.tagesschau.de/xml/rss2/');
    const parser = new XMLParser();
    const jObj = parser.parse(response.data);

    let items = jObj?.rss?.channel?.item || [];
    if (!Array.isArray(items)) {
        items = [items];
    }

    // Map top 10 news items
    const news = items.slice(0, 10).map(item => ({
        title: item.title,
        link: item.link
    }));

    newsCache = news;
    lastNewsFetch = now;
    return news;
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
        dbLayer.logSystemEvent('info', 'API', `Synced ${schedule.length} upcoming esports matches (Cache valid for 6h).`);
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
            dbLayer.logSystemEvent('info', 'API', `Successfully synced ${teamsList.length} esports teams to local DB.`);
        }
        esportsTeamsCache = null; // Invalidate cache
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
            dbLayer.logSystemEvent('info', 'API', 'Local Esports Teams DB is empty or older than 24 hours. Fetching automatically in the background...');
            exports.fetchAllEsportsTeams().catch(e => console.error('[API] Auto-sync teams failed:', e.message));
        } else {
            console.log('[API] Local Esports Teams DB is up-to-date. Skipping auto-sync.');
            dbLayer.logSystemEvent('info', 'API', 'Local Esports Teams DB is up-to-date. Skipping auto-sync.');
        }

        // Proactively fetch and cache the schedule on startup, and set interval to auto-update every 6 hours
        console.log('[API] Warming up Esports Schedule cache...');
        dbLayer.logSystemEvent('info', 'API', 'Warming up Esports Schedule cache...');
        exports.fetchEsportsData(true).catch(e => console.error('[API] Auto-sync schedule failed:', e.message));
        
        setInterval(() => {
            console.log('[API] Auto-updating Esports Schedule cache (every 6 hours)...');
            dbLayer.logSystemEvent('info', 'API', 'Auto-updating Esports Schedule cache (every 6 hours)...');
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
        if (esportsTeamsCache) return res.json(esportsTeamsCache);

        esportsTeamsCache = await dbLayer.getAllEsportsTeams();
        res.json(esportsTeamsCache);
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

    let triggerResolution = false;
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

            // Trigger resolution if any outcome has hit 100% (price 1.0)
            if (outcomePrices.some(p => parseFloat(p) === 1)) {
                triggerResolution = true;
            }

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

    // Trigger immediate resolution if a completed match was found and cooldown allows
    if (triggerResolution) {
        if (now - lastBetResolutionTrigger >= BET_RESOLUTION_COOLDOWN) {
            lastBetResolutionTrigger = now;
            const { resolveBets } = require('../cron/betResolver');
            console.log('[API] Polymarket price 1.0 detected. Auto-triggering bet resolver...');
            dbLayer.logSystemEvent('info', 'API', 'Polymarket price 1.0 detected. Auto-triggering bet resolver...');
            resolveBets().catch(e => {
                console.error('[API] Auto-trigger bet resolver error:', e.message);
                dbLayer.logError('Auto-trigger bet resolver error', e.stack);
            });
        }
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
        
        // Execute the cron logic directly and wait for results
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

// ─── Countdowns ─────────────────────────────────────────────
exports.getCountdowns = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || null;
        /*
        if (req.user) {
            console.log(`[Countdowns] Fetching for user: ${userId} (${req.user.username || 'unknown'})`);
        } else {
            console.log(`[Countdowns] Fetching for guest/unauthenticated user`);
        }
        */
        const countdowns = await dbLayer.getCountdowns(userId);
        // console.log(`[Countdowns] Returning ${countdowns.length} items for user ${userId}`);
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

        // console.log(`[Countdowns] Creating: ${eventName} for user ${userId} (isAdmin: ${isAdmin}, isPublic: ${isPublic})`);

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
    const channels = ['handofblood', 'eintrachtspandau', 'tolkin', 'lec', 'lck', 'riotgames'];
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
            let isLive = !!stream && stream.game_name === 'League of Legends';

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

// ─── Bets ───────────────────────────────────────────────────
exports.placeBet = async (req, res, next) => {
    try {
        const { matchName, chosenTeam, polymarketTeam, stake, odds, polymarketUrl, eventDate, team1Logo, team2Logo } = req.body;
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
        const { league } = req.body;
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

exports.submitKoalaFlapScore = async (req, res, next) => {
    try {
        const { score, coinsCollected, sessionLog, critCount } = req.body;
        const userId = req.user?.id || req.user?.userId;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const safeCritCount = parseInt(critCount) || 0;

        // Fetch user upgrades and server baseline
        const [upgrades, baseline] = await Promise.all([
            dbLayer.getUserUpgrades(userId),
            dbLayer.getKoalaBaseline()
        ]);

        // Basic Backend Validation
        // Each crit adds +9 to the expected count (since it's worth 10 but counted as 1 in coinsCollected base)
        const maxExpected = (score * 2 + 20) + (safeCritCount * 10);
        if (coinsCollected > maxExpected) {
            return res.status(400).json({ error: 'Invalid game result: excessive coins' });
        }
        if (!sessionLog || !Array.isArray(sessionLog.events)) {
             return res.status(400).json({ error: 'Invalid game log' });
        }

        // Calculate Bonuses
        const coinUpgradeLevel = upgrades.find(u => u.upgrade_id === 'coin_base_value')?.current_level || 0;
        const coinMultiplier = 1 + (coinUpgradeLevel * 0.2);
        const totalMultiplier = coinMultiplier;

        // Check if payout is enabled
        const payoutEnabled = baseline.game_koalaflap_payout_enabled !== 'false'; // Default to true

        // Effective coins is now pre-calculated in frontend (incl. 10x for crits)
        const effectiveCoins = coinsCollected;

        // Calculate earnings in cents
        const conversionRate = baseline.koala_coin_conversion_rate || 1;
        let totalEarningsCents = Math.round(effectiveCoins * totalMultiplier * (conversionRate * 100));
        
        // ECONOMY SAFETY: Max 20 KoalaCoins (2000 cents) per round
        const MAX_PAYOUT_CENTS = 2000; 
        if (totalEarningsCents > MAX_PAYOUT_CENTS && payoutEnabled) {
            console.warn(`[Economy] Payout cap hit for user ${userId}: ${totalEarningsCents} cents capped to ${MAX_PAYOUT_CENTS}`);
            // Log to AdminActions for transparency
            const user = await dbLayer.getUser(userId);
            dbLayer.logAdminAction('SYSTEM', 'KoalaFlap Economy', 'PAYOUT_CAP_HIT', { 
                userId, 
                username: user?.username || 'Unknown', 
                originalEarnings: totalEarningsCents / 100, 
                score 
            }).catch(e => console.error('Failed to log economy warning:', e));
            
            totalEarningsCents = MAX_PAYOUT_CENTS;
        }

        if (!payoutEnabled) totalEarningsCents = 0;

        // ─── Session Log Removal ────────────────────────────────────────────
        // Detailed session logs (telemetry) have been removed for performance.
        // The parameter is ignored if sent by legacy clients.

        // Record the score (Safe block: Payout takes priority)
        if (score > 0) {
            try {
                await dbLayer.recordGameScore(userId, 'koala_flap', score, coinsCollected);
            } catch (scoreErr) {
                console.error('[Games] Failed to record score, proceeding with payout:', scoreErr.message);
                if (dbLayer.logError) {
                    await dbLayer.logError(`Score Recording Failed (User: ${userId}, Score: ${score}): ${scoreErr.message}`, scoreErr.stack);
                }
            }
        }

        // Credit coins
        let newBalanceCents = 0;
        if (totalEarningsCents > 0) {
            newBalanceCents = await dbLayer.addKoalaCoins(userId, totalEarningsCents, `KoalaFlap: Score ${score} (Coins: ${coinsCollected}, Crits: ${safeCritCount})`);
        } else {
            const user = await dbLayer.getUser(userId);
            newBalanceCents = user?.koala_balance || 0;
        }

        // --- Daily Mission Logic ---
        let missionAwarded = false;
        let missionRewardValue = 0;
        if (score >= 10 && payoutEnabled) {
            const isCompleted = await dbLayer.checkDailyMission(userId, 'pipes_10_run');
            if (!isCompleted) {
                // Use hourly baseline * multiplier as daily reward
                const hourlyBaseline = baseline.koala_points_per_hour || 1000;
                const multiplier = parseFloat(baseline.koala_daily_mission_multiplier || '1.0');
                missionRewardValue = Math.floor(hourlyBaseline * multiplier); 
                await dbLayer.completeDailyMission(userId, 'pipes_10_run', missionRewardValue);
                missionAwarded = true;
                // Update balance local for response
                newBalanceCents += missionRewardValue;
            }
        }

        res.json({ 
            success: true, 
            coinsEarned: totalEarningsCents / 100, 
            newBalance: newBalanceCents / 100,
            multiplier: totalMultiplier.toFixed(2),
            missionAwarded,
            missionReward: missionRewardValue / 100,
            payoutDisabled: !payoutEnabled
        });
    } catch (err) {
        console.error('[Games] Error submitting score:', err);
        if (dbLayer.logError) await dbLayer.logError(`Score Submission Failed: ${err.message}`, err.stack, req.user?.id);
        res.status(500).json({ error: 'Failed to submit score' });
    }
};

exports.getGameLeaderboards = async (req, res, next) => {
    try {
        const gameId = req.query.gameId || 'koala_flap';
        const leaderboards = await dbLayer.getGameLeaderboards(gameId);
        res.json(leaderboards);
    } catch (err) {
        console.error('[Games] Error fetching leaderboards:', err);
        res.status(500).json({ error: 'Failed to fetch leaderboards' });
    }
};

exports.getGameUpgrades = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const category = req.query.category || 'koala_flap';

        const [config, userLevels] = await Promise.all([
            dbLayer.getGameUpgradesConfig(category),
            userId ? dbLayer.getUserUpgrades(userId) : Promise.resolve([])
        ]);

        res.json({ config, userLevels });
    } catch (err) {
        console.error('[Games] Error fetching upgrades:', err);
        res.status(500).json({ error: 'Failed to fetch upgrades' });
    }
};

exports.purchaseGameUpgrade = async (req, res) => {
    try {
        const { upgradeId } = req.body;
        const userId = req.user?.id || req.user?.userId;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!upgradeId) return res.status(400).json({ error: 'Upgrade ID required' });

        const result = await dbLayer.purchaseUpgrade(userId, upgradeId);
        
        // Notify all sockets for this user to update balance (e.g. news ticker, floating panel)
        const io = req.app?.get('socketio');
        if (io) {
            io.to(userId).emit('COIN_BALANCE_UPDATE', { balance: result.newBalance });
        }

        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[Games] Error purchasing upgrade:', err);
        const status = err.message.includes('Nicht genügend') || err.message.includes('maximale Level') ? 400 : 500;
        if (dbLayer.logError) await dbLayer.logError(`Upgrade Purchase Failed (${req.body.upgradeId}): ${err.message}`, err.stack, req.user?.id);
        res.status(status).json({ error: err.message || 'Failed to purchase upgrade' });
    }
};

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

exports.getMissionStatus = async (req, res) => {
    try {
        const { missionId } = req.query;
        const userId = req.user?.id || req.user?.userId;
        
        let isCompleted = false;
        if (userId) {
            isCompleted = await dbLayer.checkDailyMission(userId, missionId);
        }
        
        const baseline = await dbLayer.getKoalaBaseline();
        const hourlyBaseline = baseline.koala_points_per_hour || 1000;
        const multiplier = parseFloat(baseline.koala_daily_mission_multiplier || '1.0');
        const reward = Math.floor(hourlyBaseline * multiplier);
        res.json({ 
            completed: isCompleted, 
            reward: reward
        });
    } catch (err) {
        console.error('[Games] Error fetching mission status:', err);
        res.status(500).json({ error: 'Failed to fetch mission status' });
    }
};

exports.getKoalaFlapConfig = async (req, res, next) => {
    try {
        const baseline = await dbLayer.getKoalaBaseline();
        const hourlyBaseline = baseline.koala_points_per_hour || 1000;
        const multiplier = parseFloat(baseline.koala_daily_mission_multiplier || '1.0');
        res.json({
            payoutEnabled: baseline.game_koalaflap_payout_enabled !== 'false',
            dailyMissionReward: Math.floor(hourlyBaseline * multiplier),
            dailyMissionMultiplier: multiplier
        });
    } catch (err) {
        next(err);
    }
};

exports.getUserProfile = async (req, res, next) => {
    try {
        const username = req.params.username;
        const dbLayer = require('../database');
        const user = await dbLayer.getUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const profileData = {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            koala_balance: user.koala_balance,
            preferences: typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences,
            joinedAt: user.createdAt,
            lastActive: user.lastActive
        };

        const { ACHIEVEMENTS_CONFIG } = require('../config/achievements');
        const [bets, transactions, achievements] = await Promise.all([
            dbLayer.getUserBets(user.id, 10),
            dbLayer.getKoalaTransactions(user.id, 10),
            dbLayer.getUserAchievements(user.id)
        ]);

        const claimedMilestones = (achievements || []).map(a => {
            const config = ACHIEVEMENTS_CONFIG.find(c => c.id === a.achievementId);
            return config ? { ...config, claimedAt: a.claimedAt } : null;
        }).filter(Boolean);

        res.json({
            user: profileData,
            recentBets: bets || [],
            recentTransactions: transactions || [],
            claimedAchievements: claimedMilestones
        });
    } catch (err) {
        console.error('[API] Error fetching user profile:', err);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
};

// ─── Scratchcard Minigame ─────────────────────────────────────
exports.getScratchcardPacks = async (req, res) => {
    try {
        const packs = await dbLayer.getScratchcardPacks();
        const enrichedPacks = await Promise.all(packs.map(async (p) => {
            const teams = await dbLayer.getScratchcardPackTeams(p.id);
            let max_win = 0;
            if (p.is_weighted) {
                // Calculation: Rank-1 config yields 20x. Sum of 8 lines yields 160. Total multiplier is 160 * 8 = 1280.
                max_win = p.price * 1280;
            } else {
                const maxWinPerLine = p.reward_amount || (p.price * 5);
                max_win = maxWinPerLine * 64; // Under new math: (reward/price) sum * 8 lines = 64 * reward
            }
            return {
                ...p,
                max_win: max_win,
                teams: teams
            };
        }));
        res.json(enrichedPacks);
    } catch (err) {
        console.error('getScratchcardPacks error:', err);
        res.status(500).json({ error: 'Failed to fetch packs' });
    }
};

exports.getScratchcardConfig = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;

        // Hybrid Caching: Cache metadata and teams, but keep user daily count live
        if (!scratchcardPacksCache) {
            const packs = await dbLayer.getScratchcardPacks();
            const activePacks = packs.filter(p => p.is_active);
            
            scratchcardPacksCache = await Promise.all(activePacks.map(async (pack) => {
                const teams = await dbLayer.getScratchcardPackTeams(pack.id);
                
                let max_win = 0;
                if (pack.is_weighted) {
                    max_win = pack.price * 1280;
                } else {
                    const maxWinPerLine = pack.reward_amount || (pack.price * 5);
                    max_win = maxWinPerLine * 64;
                }

                return {
                    ...pack,
                    max_win: max_win,
                    teams_count: teams.length,
                    teams: teams.map(t => ({ team_code: t.team_code, position: t.position }))
                };
            }));
        }

        // Add user-specific daily counts live
        const enhancedPacks = await Promise.all(scratchcardPacksCache.map(async (pack) => {
            let userDailyCount = 0;
            if (userId && pack.max_daily_limit > 0) {
                userDailyCount = await dbLayer.getUserDailyPackCount(userId, pack.id);
            }
            return {
                ...pack,
                userDailyCount
            };
        }));
        
        res.json(enhancedPacks);
    } catch (err) {
        console.error('getScratchcardConfig error:', err);
        res.status(500).json({ error: 'Failed to fetch config' });
    }
};

exports.getGlobalScratchcardStats = async (req, res) => {
    try {
        const stats = await dbLayer.getGlobalScratchcardStats();
        
        const [latestWinners, topWinners, leaderboard] = await Promise.all([
            dbLayer.getLatestScratchcardWinners(10),
            dbLayer.getTopScratchcardWinners(10),
            dbLayer.getScratchcardLeaderboard(10)
        ]);

        const formatWinners = (winners) => winners.map(w => {
            let parsedGrid = [];
            try {
                parsedGrid = (typeof w.grid === 'string') ? JSON.parse(w.grid) : (w.grid || []);
            } catch (e) { parsedGrid = []; }

            let parsedPrefs = {};
            try {
                parsedPrefs = (typeof w.preferences === 'string') ? JSON.parse(w.preferences) : (w.preferences || {});
            } catch (e) { parsedPrefs = {}; }

            return { ...w, grid: parsedGrid, preferences: parsedPrefs };
        });

        res.json({ 
            ...stats, 
            latestWinners: formatWinners(latestWinners),
            topWinners: formatWinners(topWinners),
            leaderboard: formatWinners(leaderboard) // Reuse same formatting for avatars
        });
    } catch (err) {
        console.error('getGlobalScratchcardStats error:', err);
        res.status(500).json({ error: 'Failed to fetch global stats' });
    }
};

exports.getScratchcardLeaderboardData = async (req, res) => {
    try {
        const data = await dbLayer.getScratchcardLeaderboardData();
        // Transform for chart (convert strings to numbers)
        const chartData = data.map(row => ({
            day: row.day,
            dailyWin: Number(row.dailyWin)
        }));
        res.json(chartData);
    } catch (err) {
        console.error('getScratchcardLeaderboardData error:', err);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
};

const WINNING_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

function generateScratchcardGrid(teams, shouldWin) {
    let grid = new Array(9).fill(null);
    if (!teams || teams.length < 3) return grid; // At least 3 teams for a grid

    if (shouldWin) {
        const winningTeam = teams[Math.floor(Math.random() * teams.length)];
        const line = WINNING_LINES[Math.floor(Math.random() * WINNING_LINES.length)];
        line.forEach(index => { grid[index] = winningTeam.code; });

        for (let i = 0; i < 9; i++) {
            if (grid[i] === null) {
                grid[i] = teams[Math.floor(Math.random() * teams.length)].code;
            }
        }
    } else {
        let attempts = 0;
        while (attempts < 50) {
            for (let i = 0; i < 9; i++) {
                grid[i] = teams[Math.floor(Math.random() * teams.length)].code;
            }
            const hasWin = WINNING_LINES.some(line => 
                grid[line[0]] && (grid[line[0]] === grid[line[1]]) && (grid[line[1]] === grid[line[2]])
            );
            if (!hasWin) break;
            attempts++;
        }

        // Final Fail-Safe Check: If the 50 attempts somehow failed (only possible with very small team pools),
        // we force a guaranteed, but organic-looking loser pattern.
        const finalWinCheck = WINNING_LINES.some(line => 
            grid[line[0]] && (grid[line[0]] === grid[line[1]]) && (grid[line[1]] === grid[line[2]])
        );
        if (finalWinCheck) {
            const t1 = teams[0].code;
            const t2 = teams[1].code;
            const t3 = teams[2].code;
            // Pattern (A-B-C, A-C-B, B-A-C) is mathematically guaranteed to have NO wins (rows, cols, diags).
            grid = [
                t1, t2, t3,
                t1, t3, t2,
                t2, t1, t3
            ];
        }
    }
    return grid;
}

function findAllWinningLines(grid) {
    const wins = [];
    for (const line of WINNING_LINES) {
        if (grid[line[0]] && (grid[line[0]] === grid[line[1]]) && (grid[line[1]] === grid[line[2]])) {
            wins.push({ line, code: grid[line[0]] });
        }
    }
    return wins;
}

exports.buyScratchcard = async (req, res, next) => {
    try {
        const { packId } = req.body;
        const userId = req.user?.userId || req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Authentication required' });
        if (!packId) return res.status(400).json({ error: 'Pack ID required' });

        const pack = await dbLayer.getScratchcardPack(packId);
        if (!pack || !pack.is_active) {
            return res.status(400).json({ error: 'Invalid or inactive scratchcard pack' });
        }

        // Check daily limit
        if (pack.max_daily_limit > 0) {
            const dailyCount = await dbLayer.getUserDailyPackCount(userId, packId);
            if (dailyCount >= pack.max_daily_limit) {
                return res.status(400).json({ error: 'Tägliches Kauflimit erreicht (Daily Limit Reached)' });
            }
        }

        const user = await dbLayer.getUser(userId);
        if (!user || user.koala_balance < pack.price) {
            return res.status(400).json({ error: 'Not enough KoalaCoins' });
        }

        const packTeams = await dbLayer.getScratchcardPackTeams(packId);
        if (!packTeams || packTeams.length < 3) {
            return res.status(400).json({ error: 'Dieses Los ist aktuell nicht verfügbar. Zu wenig Teams hinterlegt.' });
        }
        
        const teams = packTeams.map(pt => ({ code: pt.team_code }));

        const shouldWin = Math.random() < pack.win_chance;
        const grid = generateScratchcardGrid(teams, shouldWin);
        
        const winningLines = findAllWinningLines(grid);
        let winAmount = 0;
        let totalMultiplier = 0.0;

        for (const win of winningLines) {
            if (pack.is_weighted) {
                const teamData = packTeams.find(t => t.team_code === win.code);
                const rank = (teamData ? teamData.position : 0) + 1; // 1-based rank
                const N = packTeams.length;
                
                // Biquadratic Rank-Based Multiplier (Power 4)
                // Multiplier = 2 + 18 * ((N - r) / (N - 1))^4
                // Min 2.0x (last place), Max 20.0x (first place)
                let multiplier = 2.0;
                if (N > 1) {
                    const term = (N - rank) / (N - 1);
                    multiplier = 2 + 18 * Math.pow(term, 4);
                } else {
                    multiplier = 20.0;
                }
                
                totalMultiplier += multiplier;
            } else {
                const reward = (pack.reward_amount || (pack.price * 5));
                totalMultiplier += (reward / pack.price);
            }
        }

        if (winningLines.length > 0) {
            totalMultiplier = totalMultiplier * winningLines.length;
            winAmount = Math.floor(pack.price * totalMultiplier);
        }

        const result = await dbLayer.purchaseScratchcardTransaction(userId, packId, pack.name, pack.price, grid, winAmount);

        res.json({
            id: result.id,
            grid: result.grid,
            winAmount: result.winAmount,
            price: pack.price,
            winningLines // Include all lines for frontend highlighting
        });
    } catch (err) {
        console.error('[Scratchcard] Purchase error:', err);
        res.status(500).json({ error: 'Failed to process purchase' });
    }
};

// Admin Pack Management
exports.adminCreateScratchPack = async (req, res) => {
    try {
        const { pack, teams } = req.body; // teams as [code1, code2, ...] in order
        const newPack = await dbLayer.createScratchcardPack(pack);
        if (teams && Array.isArray(teams)) {
            await dbLayer.setScratchcardPackTeams(newPack.id, teams);
        }
        scratchcardPacksCache = null; // Invalidate cache
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
        scratchcardPacksCache = null; // Invalidate cache
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
        scratchcardPacksCache = null; // Invalidate cache
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

exports.claimScratchcard = async (req, res, next) => {
    try {
        const { id } = req.body;
        const userId = req.user?.userId || req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Authentication required' });
        if (!id) return res.status(400).json({ error: 'Card ID required' });
        
        console.log(`[Scratchcard] User ${userId} claiming card ${id}`);

        // dbLayer.claimScratchcard handles verification, status update, balance update, and transaction logging
        const result = await dbLayer.claimScratchcard(id, userId);
        
        res.json({ success: true, winAmount: result.winAmount, price: result.price });
    } catch (err) {
        console.error('[Scratchcard] Claim error:', err);
        // Map common error messages to user-friendly ones if needed
        const errorMsg = err.message === 'Scratchcard not found' || err.message === 'Scratchcard already claimed or invalid'
            ? err.message
            : 'Failed to claim reward';
        res.status(err.status || 500).json({ error: errorMsg });
    }
};

// Navbar Settings
exports.getPublicNavbarSettings = async (req, res, next) => {
    try {
        if (navbarSettingsCache) return res.json(navbarSettingsCache);

        navbarSettingsCache = await dbLayer.getNavbarSettings(false);
        res.json(navbarSettingsCache);
    } catch (err) {
        next(err);
    }
};

exports.getAdminNavbarSettings = async (req, res, next) => {
    try {
        const settings = await dbLayer.getNavbarSettings(true);
        res.json(settings);
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
        await dbLayer.updateNavbarSettings(settings);
        navbarSettingsCache = null; // Invalidate cache
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

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

exports.getPokemonData = async (req, res, next) => {
    try {
        if (pokemonMemoryCache) return res.json(pokemonMemoryCache);
        
        const filePath = path.join(__dirname, '..', 'assets_static', 'pokemon.txt');
        if (!fs.existsSync(filePath)) return res.json([]);
        
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n').filter(line => line.trim());
        
        const colorsPath = path.join(__dirname, '..', 'assets_static', 'pokemon_colors.json');
        let backgroundColors = {};
        if (fs.existsSync(colorsPath)) {
            backgroundColors = JSON.parse(fs.readFileSync(colorsPath, 'utf8'));
        }

        const result = lines.map((line, index) => {
            const parts = line.trim().split(/\s+/);
            const id = (index + 1).toString().padStart(3, '0');
            return { 
                id, name: parts[0], threshold: parseFloat(parts[1]), 
                types: parts.slice(2), backgroundColor: backgroundColors[id] || '#000000' 
            };
        });

        pokemonMemoryCache = result;
        res.json(pokemonMemoryCache);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load Pokémon data' });
    }
};

exports.getPokemonConfigs = async (req, res, next) => {
    try {
        if (!req.user || !req.user.is_superadmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (pokemonConfigsCache) return res.json(pokemonConfigsCache);

        pokemonConfigsCache = await dbLayer.getPokemonConfigs();
        res.json(pokemonConfigsCache);
    } catch (err) {
        next(err);
    }
};

exports.getPublicPokemonConfigs = async (req, res, next) => {
    try {
        if (pokemonConfigsCache) return res.json(pokemonConfigsCache);

        pokemonConfigsCache = await dbLayer.getPokemonConfigs();
        res.json(pokemonConfigsCache);
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
        pokemonConfigsCache = null; // Invalidate cache
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

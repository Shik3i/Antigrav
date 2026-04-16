const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const dbLayer = require('../database');
const { safeStringify, toSerializableValue } = require('../utils/safeSerialization');

const BET_RESOLUTION_COOLDOWN = 10 * 60 * 1000;
const FORCE_REFRESH_COOLDOWN = 60 * 1000;

const NEWS_TTL = 15 * 60 * 1000;
const SCHEDULE_TTL = 60 * 60 * 1000;
const TEAMS_TTL = 15 * 60 * 1000;
const POLY_TTL = 60 * 60 * 1000;
const TWITCH_TTL = 60 * 1000;
const CONFIG_TTL = 15 * 60 * 1000;
const ERROR_COOLDOWN = 5 * 60 * 1000;

function createCache(name, ttl) {
    return {
        name,
        ttl,
        data: null,
        timestamp: 0,
        inflight: null,
        lastErrorAt: 0,
        errorActive: false,
        lastForceRefreshAt: 0
    };
}

const caches = {
    news: createCache('news', NEWS_TTL),
    esportsSchedule: createCache('esportsSchedule', SCHEDULE_TTL),
    esportsTeams: createCache('esportsTeams', TEAMS_TTL),
    polymarket: createCache('polymarket', POLY_TTL),
    twitchStatus: createCache('twitchStatus', TWITCH_TTL),
    navbarSettings: createCache('navbarSettings', CONFIG_TTL),
    pokemonConfigs: createCache('pokemonConfigs', CONFIG_TTL),
    pokemonData: createCache('pokemonData', 24 * 60 * 60 * 1000)
};

let lastBetResolutionTrigger = 0;
let twitchToken = { value: null, expires: 0 };
let esportsWarmupStarted = false;

function isFresh(cache) {
    return cache.data !== null && (Date.now() - cache.timestamp) < cache.ttl;
}

function clearCache(cache) {
    cache.data = null;
    cache.timestamp = 0;
    cache.inflight = null;
}

function markError(cache, err) {
    const now = Date.now();
    const shouldLog = !cache.errorActive || (now - cache.lastErrorAt) >= ERROR_COOLDOWN;

    if (shouldLog) {
        console.error(`[API:${cache.name}] Upstream fetch failed:`, err.message);
        if (dbLayer.logError) {
            dbLayer.logError(`[API:${cache.name}] Upstream fetch failed`, err.stack, err.message).catch(() => {});
        }
    }

    cache.errorActive = true;
    cache.lastErrorAt = now;
}

function markSuccess(cache) {
    cache.errorActive = false;
}

function snapshotCache(cache) {
    return {
        isCached: cache.data !== null,
        items: Array.isArray(cache.data) ? cache.data.length : (cache.data ? 1 : 0),
        ageSeconds: cache.timestamp ? Math.round((Date.now() - cache.timestamp) / 1000) : null
    };
}

function arePayloadsEqual(a, b) {
    return safeStringify(toSerializableValue(a)) === safeStringify(toSerializableValue(b));
}

async function resolveCached(cache, fetcher, options = {}) {
    const {
        forceRefresh = false,
        allowStaleOnError = true,
        updateTimestamp = true
    } = options;

    if (!forceRefresh && isFresh(cache)) {
        return {
            data: cache.data,
            changed: false,
            source: 'cache',
            timestamp: cache.timestamp
        };
    }

    if (cache.inflight) {
        return cache.inflight;
    }

    cache.inflight = (async () => {
        const previousData = cache.data;

        try {
            const nextData = await fetcher(previousData);
            const changed = !arePayloadsEqual(previousData, nextData);
            cache.data = nextData;
            if (updateTimestamp) {
                cache.timestamp = Date.now();
            }
            markSuccess(cache);
            return {
                data: cache.data,
                changed,
                source: 'network',
                timestamp: cache.timestamp
            };
        } catch (err) {
            markError(cache, err);
            if (allowStaleOnError && cache.data !== null) {
                return {
                    data: cache.data,
                    changed: false,
                    source: 'stale',
                    timestamp: cache.timestamp
                };
            }
            throw err;
        } finally {
            cache.inflight = null;
        }
    })();

    return cache.inflight;
}

async function getTeamMappingsMap() {
    const mappings = await dbLayer.getTeamMappings().catch(() => []);
    return mappings.reduce((acc, current) => {
        acc[(current.originalCode || '').toLowerCase()] = (current.polymarketCode || '').toLowerCase();
        return acc;
    }, {});
}

async function getNews(options = {}) {
    return resolveCached(caches.news, async () => {
        const response = await axios.get('https://www.tagesschau.de/xml/rss2/');
        const parser = new XMLParser();
        const parsed = parser.parse(response.data);
        let items = parsed?.rss?.channel?.item || [];

        if (!Array.isArray(items)) {
            items = [items];
        }

        return items.slice(0, 10).map((item) => ({
            title: item.title,
            link: item.link
        }));
    }, options);
}

async function getEsportsSchedule(options = {}) {
    return resolveCached(caches.esportsSchedule, async () => {
        const response = await axios.get('https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=en-GB', {
            headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }
        });

        const events = response.data?.data?.schedule?.events || [];
        const relevantMatches = events.filter((event) => event.state !== 'completed');
        const mappingDict = await getTeamMappingsMap();
        const getMappedCode = (code) => mappingDict[(code || '').toLowerCase()] || code;

        return relevantMatches.slice(0, 80).map((event) => {
            const team1Code = event.match?.teams?.[0]?.code || 'TBD';
            const team2Code = event.match?.teams?.[1]?.code || 'TBD';

            return {
                id: event.match?.id || event.id,
                startTime: event.startTime,
                state: event.state,
                league: event.league?.name,
                blockName: event.blockName || null,
                strategy: event.match?.strategy || null,
                team1: {
                    name: event.match?.teams?.[0]?.name || 'TBD',
                    code: team1Code,
                    polymarketCode: getMappedCode(team1Code),
                    image: event.match?.teams?.[0]?.image || null
                },
                team2: {
                    name: event.match?.teams?.[1]?.name || 'TBD',
                    code: team2Code,
                    polymarketCode: getMappedCode(team2Code),
                    image: event.match?.teams?.[1]?.image || null
                }
            };
        });
    }, options);
}

async function syncEsportsTeams(options = {}) {
    return resolveCached(caches.esportsTeams, async () => {
        const response = await axios.get('https://esports-api.lolesports.com/persisted/gw/getTeams?hl=en-GB', {
            headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }
        });

        const teams = response.data?.data?.teams || [];
        const uniqueTeams = new Map();

        teams
            .filter((team) => team.code && team.code.toUpperCase() !== 'TBD' && team.code.toUpperCase() !== 'TBDD' && team.status !== 'archived')
            .forEach((team) => {
                uniqueTeams.set(team.code, {
                    code: team.code,
                    name: team.name,
                    league: team.homeLeague?.name || 'Unknown',
                    image: team.image
                });
            });

        const teamsList = Array.from(uniqueTeams.values());

        if (teamsList.length > 0) {
            await dbLayer.upsertEsportsTeams(teamsList);
        }

        const dbTeams = await dbLayer.getAllEsportsTeams();
        caches.esportsTeams.data = dbTeams;
        caches.esportsTeams.timestamp = Date.now();
        return dbTeams;
    }, options);
}

async function getEsportsTeams(options = {}) {
    return resolveCached(caches.esportsTeams, async () => dbLayer.getAllEsportsTeams(), options);
}

function generateSlugsForMatch(mappingDict, t1Code, t2Code, t1Name, t2Name, startTime) {
    const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Mapped codes (or raw codes)
    const normalizedCode1 = mappingDict[(t1Code || '').toLowerCase()] || (t1Code || '').toLowerCase();
    const normalizedCode2 = mappingDict[(t2Code || '').toLowerCase()] || (t2Code || '').toLowerCase();
    
    // Normalized names
    const normalizedName1 = normalize(t1Name);
    const normalizedName2 = normalize(t2Name);

    // Some Polymarket slugs use acronyms like 'g2' and 'fnc', others use full names.
    // Create an array of possible identifiers for each team.
    const t1Identifiers = Array.from(new Set([normalizedCode1, normalizedName1].filter(Boolean)));
    const t2Identifiers = Array.from(new Set([normalizedCode2, normalizedName2].filter(Boolean)));

    const matchDate = new Date(startTime);
    const generated = new Set();

    for (let index = -2; index <= 5; index += 1) {
        const date = new Date(matchDate);
        date.setDate(date.getDate() + index);
        const dateStr = date.toISOString().split('T')[0];
        
        for (const id1 of t1Identifiers) {
            for (const id2 of t2Identifiers) {
                generated.add(`lol-${id1}-${id2}-${dateStr}`);
                generated.add(`lol-${id2}-${id1}-${dateStr}`);
            }
        }
    }

    return Array.from(generated);
}

async function fetchPolymarketOddsUpstream(forceRefreshMatch = null) {
    const mappingDict = await getTeamMappingsMap();
    const schedule = forceRefreshMatch ? [] : (await getEsportsSchedule().catch(() => ({ data: [] }))).data;
    const slugsToTry = [];

    if (forceRefreshMatch) {
        if (forceRefreshMatch.slug) {
            slugsToTry.push(forceRefreshMatch.slug);
        } else {
            slugsToTry.push(...generateSlugsForMatch(mappingDict, forceRefreshMatch.team1, forceRefreshMatch.team2, forceRefreshMatch.team1Name, forceRefreshMatch.team2Name, forceRefreshMatch.startTime));
        }
    } else {
        schedule.forEach((match) => {
            if (!match.team1 || !match.team2 || match.team1.code === 'TBD' || match.team2.code === 'TBD') {
                return;
            }
            slugsToTry.push(...generateSlugsForMatch(mappingDict, match.team1.code, match.team2.code, match.team1.name, match.team2.name, match.startTime));
        });
    }

    const allLolEvents = [];

    for (let index = 0; index < slugsToTry.length; index += 50) {
        const batch = slugsToTry.slice(index, index + 50);
        try {
            const response = await axios.get('https://gamma-api.polymarket.com/events', {
                params: { slug: batch },
                paramsSerializer: { indexes: null }
            });

            if (Array.isArray(response.data) && response.data.length > 0) {
                allLolEvents.push(...response.data);
            }
        } catch (err) {
            // Ignore individual batch failures and fall back to stale cache if needed.
        }
    }

    let triggerResolution = false;
    const fetchedOdds = allLolEvents.map((event) => {
        const markets = event.markets || [];
        if (markets.length === 0) {
            return null;
        }

        const isMultiMarket = markets.length > 2 && markets.every((market) => {
            try {
                const outcomes = JSON.parse(market.outcomes || '[]');
                return outcomes.includes('Yes') || outcomes.includes('No');
            } catch (err) {
                return false;
            }
        });

        let outcomes = [];
        let url = `https://polymarket.com/event/${event.slug}`;

        if (isMultiMarket) {
            outcomes = markets.map((market) => {
                const marketOutcomes = JSON.parse(market.outcomes || '[]');
                const prices = JSON.parse(market.outcomePrices || '[]');
                const yesIndex = marketOutcomes.indexOf('Yes');
                let name = market.groupItemTitle || market.question;

                if (name && name.startsWith('Will ') && name.endsWith(' win?')) {
                    name = name.substring(5, name.length - 5);
                }

                return {
                    name: name || 'Unknown',
                    price: parseFloat(prices[yesIndex] || 0),
                    pct: Math.round(parseFloat(prices[yesIndex] || 0) * 100)
                };
            }).sort((left, right) => right.price - left.price);
        } else {
            let winnerMarket = markets.find((market) => market.sportsMarketType === 'moneyline' || market.groupItemTitle === 'Match Winner');

            if (!winnerMarket) {
                winnerMarket = markets.find((market) => {
                    try {
                        const names = JSON.parse(market.outcomes || '[]');
                        const isTwoTeam = names.length === 2
                            && !names.includes('Yes') && !names.includes('No')
                            && !names.includes('Over') && !names.includes('Under');
                        const question = (market.question || '').toLowerCase();
                        const isSubMarket = question.includes('first blood') || question.includes('game') || question.includes('handicap') || question.includes('map');
                        return isTwoTeam && !isSubMarket;
                    } catch (err) {
                        return false;
                    }
                });
            }

            if (!winnerMarket) {
                winnerMarket = markets[0];
            }

            try {
                const names = JSON.parse(winnerMarket.outcomes || '[]');
                const prices = JSON.parse(winnerMarket.outcomePrices || '[]');
                outcomes = names.map((name, outcomeIndex) => ({
                    name,
                    price: parseFloat(prices[outcomeIndex] || 0),
                    pct: Math.round(parseFloat(prices[outcomeIndex] || 0) * 100)
                }));

                if (winnerMarket.slug && !event.slug) {
                    url = `https://polymarket.com/market/${winnerMarket.slug}`;
                }
            } catch (err) {
                return null;
            }
        }

        if (outcomes.length === 0) {
            return null;
        }

        if (outcomes.some((outcome) => outcome.price === 1)) {
            triggerResolution = true;
        }

        return {
            id: event.id,
            slug: event.slug,
            title: event.title,
            outcomes,
            url
        };
    }).filter(Boolean);

    if (triggerResolution && Date.now() - lastBetResolutionTrigger >= BET_RESOLUTION_COOLDOWN) {
        lastBetResolutionTrigger = Date.now();
        const { resolveBets } = require('../cron/betResolver');
        resolveBets().catch((err) => {
            console.error('[API:polymarket] Auto-trigger bet resolver failed:', err.message);
            if (dbLayer.logError) {
                dbLayer.logError('[API:polymarket] Auto-trigger bet resolver failed', err.stack, err.message).catch(() => {});
            }
        });
    }

    return fetchedOdds;
}

async function getPolymarketOdds(options = {}) {
    const { forceRefreshMatch = null } = options;
    const forceRefresh = Boolean(forceRefreshMatch);
    const cache = caches.polymarket;
    const now = Date.now();

    if (forceRefresh && cache.lastForceRefreshAt && (now - cache.lastForceRefreshAt) < FORCE_REFRESH_COOLDOWN) {
        return {
            data: cache.data || [],
            changed: false,
            source: cache.data ? 'cache' : 'empty'
        };
    }

    if (!forceRefresh && isFresh(cache)) {
        return {
            data: cache.data,
            changed: false,
            source: 'cache',
            timestamp: cache.timestamp
        };
    }

    if (cache.inflight) {
        return cache.inflight;
    }

    cache.inflight = (async () => {
        const previousData = cache.data || [];

        try {
            const fetchedOdds = await fetchPolymarketOddsUpstream(forceRefreshMatch);
            let nextData;

            if (forceRefreshMatch) {
                const cacheMap = new Map(previousData.map((entry) => [entry.id, entry]));
                fetchedOdds.forEach((entry) => cacheMap.set(entry.id, entry));
                nextData = Array.from(cacheMap.values());
                cache.lastForceRefreshAt = now;
            } else {
                nextData = fetchedOdds;
                cache.timestamp = now;
            }

            cache.data = nextData;
            if (!forceRefresh) {
                cache.timestamp = Date.now();
            }
            const changed = !arePayloadsEqual(previousData, nextData);
            markSuccess(cache);

            return {
                data: cache.data,
                changed,
                source: 'network',
                timestamp: cache.timestamp
            };
        } catch (err) {
            markError(cache, err);
            if (cache.data !== null) {
                return {
                    data: cache.data,
                    changed: false,
                    source: 'stale',
                    timestamp: cache.timestamp
                };
            }
            throw err;
        } finally {
            cache.inflight = null;
        }
    })();

    return cache.inflight;
}

async function getTwitchAccessToken() {
    if (twitchToken.value && Date.now() < twitchToken.expires) {
        return twitchToken.value;
    }

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return null;
    }

    const response = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`);
    twitchToken = {
        value: response.data.access_token,
        expires: Date.now() + (response.data.expires_in * 1000) - 60000
    };
    return twitchToken.value;
}

async function getTwitchStatus(options = {}) {
    const channels = ['handofblood', 'eintrachtspandau', 'tolkin', 'lec', 'lck', 'riotgames', 'primeleague', 'spielestyler'];

    return resolveCached(caches.twitchStatus, async () => {
        const token = await getTwitchAccessToken().catch(() => null);
        const clientId = process.env.TWITCH_CLIENT_ID;

        if (!token || !clientId) {
            return channels.map((channel) => ({
                user_login: channel,
                is_live: false,
                game_name: null,
                viewer_count: 0
            }));
        }

        const query = channels.map((channel) => `user_login=${channel}`).join('&');
        const response = await axios.get(`https://api.twitch.tv/helix/streams?${query}`, {
            headers: {
                'Client-ID': clientId,
                Authorization: `Bearer ${token}`
            }
        });

        const liveStreams = response.data.data || [];
        return channels.map((login) => {
            const stream = liveStreams.find((entry) => entry.user_login.toLowerCase() === login.toLowerCase());
            return {
                user_login: login,
                is_live: Boolean(stream) && (login === 'spielestyler' || stream.game_name === 'League of Legends'),
                game_name: stream ? stream.game_name : null,
                viewer_count: stream ? stream.viewer_count : 0,
                thumbnail_url: stream ? stream.thumbnail_url : null
            };
        });
    }, options);
}

async function getNavbarSettings(adminOnly = false, options = {}) {
    if (adminOnly) {
        return {
            data: await dbLayer.getNavbarSettings(true),
            changed: false,
            source: 'db'
        };
    }

    return resolveCached(caches.navbarSettings, async () => dbLayer.getNavbarSettings(false), options);
}

async function getPokemonConfigs(options = {}) {
    return resolveCached(caches.pokemonConfigs, async () => dbLayer.getPokemonConfigs(), options);
}

async function getPokemonData(options = {}) {
    return resolveCached(caches.pokemonData, async () => {
        const filePath = path.join(__dirname, '..', 'assets_static', 'pokemon.txt');
        if (!fs.existsSync(filePath)) {
            return [];
        }

        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n').filter((line) => line.trim());
        const colorsPath = path.join(__dirname, '..', 'assets_static', 'pokemon_colors.json');
        let backgroundColors = {};

        if (fs.existsSync(colorsPath)) {
            backgroundColors = JSON.parse(fs.readFileSync(colorsPath, 'utf8'));
        }

        return lines.map((line, index) => {
            const parts = line.trim().split(/\s+/);
            const id = (index + 1).toString().padStart(3, '0');
            return {
                id,
                name: parts[0],
                threshold: parseFloat(parts[1]),
                types: parts.slice(2),
                backgroundColor: backgroundColors[id] || '#000000'
            };
        });
    }, options);
}

function getAdminCacheStatus() {
    const polyData = caches.polymarket.data || [];
    const esportsItems = polyData.filter((item) => item.slug && item.slug.startsWith('lol-')).length;
    const generalItems = polyData.length - esportsItems;

    return {
        polymarketEsports: {
            ...snapshotCache(caches.polymarket),
            items: esportsItems
        },
        polymarketGeneral: {
            ...snapshotCache(caches.polymarket),
            items: generalItems
        },
        loleSports: snapshotCache(caches.esportsSchedule),
        esportsTeams: snapshotCache(caches.esportsTeams),
        twitchStatus: snapshotCache(caches.twitchStatus),
        navbarSettings: snapshotCache(caches.navbarSettings),
        pokemonConfigs: snapshotCache(caches.pokemonConfigs)
    };
}

function flushAdminCache(target) {
    if (target === 'polymarket' || target === 'all') {
        clearCache(caches.polymarket);
    }
    if (target === 'lolesports' || target === 'all') {
        clearCache(caches.esportsSchedule);
    }
    if (target === 'teams' || target === 'all') {
        clearCache(caches.esportsTeams);
    }
    if (target === 'twitch' || target === 'all') {
        clearCache(caches.twitchStatus);
    }
    if (target === 'navbar' || target === 'all') {
        clearCache(caches.navbarSettings);
    }
    if (target === 'pokemon-configs' || target === 'all') {
        clearCache(caches.pokemonConfigs);
    }
    return getAdminCacheStatus();
}

function invalidatePolymarketCache() {
    clearCache(caches.polymarket);
}

function invalidateNavbarSettingsCache() {
    clearCache(caches.navbarSettings);
}

function invalidatePokemonConfigsCache() {
    clearCache(caches.pokemonConfigs);
}

async function initializeEsportsData() {
    const lastUpdatedStr = await dbLayer.getEsportsTeamsLastUpdated();
    const needsUpdate = !lastUpdatedStr || (Date.now() - new Date(lastUpdatedStr).getTime() > 24 * 60 * 60 * 1000);

    if (needsUpdate) {
        syncEsportsTeams({ forceRefresh: true }).catch((err) => {
            console.error('[API:esportsTeams] Background sync failed:', err.message);
        });
    }

    getEsportsSchedule({ forceRefresh: true }).catch((err) => {
        console.error('[API:esportsSchedule] Warmup failed:', err.message);
    });

    if (!esportsWarmupStarted) {
        esportsWarmupStarted = true;
        setInterval(() => {
            getEsportsSchedule({ forceRefresh: true }).catch((err) => {
                console.error('[API:esportsSchedule] Background refresh failed:', err.message);
            });
        }, SCHEDULE_TTL);
    }
}

module.exports = {
    caches,
    getNews,
    getEsportsSchedule,
    syncEsportsTeams,
    getEsportsTeams,
    getPolymarketOdds,
    getTwitchStatus,
    getNavbarSettings,
    getPokemonConfigs,
    getPokemonData,
    getAdminCacheStatus,
    flushAdminCache,
    invalidatePolymarketCache,
    invalidateNavbarSettingsCache,
    invalidatePokemonConfigsCache,
    initializeEsportsData
};

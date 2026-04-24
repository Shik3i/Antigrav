const dbLayer = require('../database');
const apiDataService = require('../services/apiDataService');
const sanitize = require('../sanitize');
const { safeJson } = require('../utils/safeSerialization');

// --- Highscores ---
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

// --- Koala Flap & Tetris ---
exports.submitKoalaFlapScore = async (req, res, next) => {
    try {
        const { score, coinsCollected, sessionLog, critCount } = req.body;
        const userId = req.user?.id || req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const safeCritCount = parseInt(critCount) || 0;
        const [upgrades, baseline] = await Promise.all([
            dbLayer.getUserUpgrades(userId),
            dbLayer.getKoalaBaseline()
        ]);

        const maxExpected = (score * 2 + 20) + (safeCritCount * 10);
        if (coinsCollected > maxExpected) {
            return res.status(400).json({ error: 'Invalid game result: excessive coins' });
        }
        if (!sessionLog || !Array.isArray(sessionLog.events)) {
             return res.status(400).json({ error: 'Invalid game log' });
        }

        const coinUpgradeLevel = upgrades.find(u => u.upgrade_id === 'coin_base_value')?.current_level || 0;
        const coinMultiplier = 1 + (coinUpgradeLevel * 0.2);
        const totalMultiplier = coinMultiplier;
        const payoutEnabled = baseline.game_koalaflap_payout_enabled !== 'false';
        const effectiveCoins = coinsCollected;
        const conversionRate = baseline.koala_coin_conversion_rate || 1;
        let totalEarningsCents = Math.round(effectiveCoins * totalMultiplier * (conversionRate * 100));
        
        const MAX_PAYOUT_CENTS = 2000; 
        if (totalEarningsCents > MAX_PAYOUT_CENTS && payoutEnabled) {
            console.warn(`[Economy] Payout cap hit for user ${userId}: ${totalEarningsCents} cents capped to ${MAX_PAYOUT_CENTS}`);
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

        if (score > 0) {
            try {
                await dbLayer.recordGameScore(userId, 'koala_flap', score, coinsCollected);
            } catch (scoreErr) {
                console.error('[Games] Failed to record score, proceeding with payout:', scoreErr.message);
            }
        }

        let newBalanceCents = 0;
        if (totalEarningsCents > 0) {
            newBalanceCents = await dbLayer.addKoalaCoins(userId, totalEarningsCents, `KoalaFlap: Score ${score} (Coins: ${coinsCollected}, Crits: ${safeCritCount})`);
        } else {
            const user = await dbLayer.getUser(userId);
            newBalanceCents = user?.koala_balance || 0;
        }

        let missionAwarded = false;
        let missionRewardValue = 0;
        if (score >= 10 && payoutEnabled) {
            const isCompleted = await dbLayer.checkDailyMission(userId, 'pipes_10_run');
            if (!isCompleted) {
                const hourlyBaseline = baseline.koala_points_per_hour || 1000;
                const multiplier = parseFloat(baseline.koala_daily_mission_multiplier || '1.0');
                missionRewardValue = Math.floor(hourlyBaseline * multiplier); 
                await dbLayer.completeDailyMission(userId, 'pipes_10_run', missionRewardValue);
                missionAwarded = true;
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
        res.status(500).json({ error: 'Failed to submit score' });
    }
};

exports.submitTetrisScore = async (req, res, next) => {
    try {
        const { score, lines, level, sprintTime } = req.body;
        let finalUserId = req.user?.id || req.user?.userId;
        if (!finalUserId) return res.status(401).json({ error: 'Unauthorized' });

        if (finalUserId.length < 20) {
            const user = await dbLayer.getUserByUsername(finalUserId);
            if (user) finalUserId = user.id;
        }
        
        const safeScore = parseInt(score) || 0;
        const safeLines = parseInt(lines) || 0;
        const safeLevel = parseInt(level) || 1;
        const safeSprintTime = parseInt(sprintTime) || 0;

        if (safeScore > 0 || safeLines > 0 || safeLevel > 0 || safeSprintTime > 0) {
            await dbLayer.updateUserGameStats(finalUserId, 'tetris', safeScore, safeLines, safeLevel, safeSprintTime);
        }

        res.json({ success: true, coinsEarned: 0 });
    } catch (err) {
        console.error('[Games] Error submitting Tetris score:', err);
        res.status(500).json({ error: 'Failed to submit score' });
    }
};

// --- Leaderboards ---
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

exports.getLeaderboardSettings = async (req, res) => {
    try {
        const settings = await dbLayer.getLeaderboardSettings();
        res.json(settings);
    } catch (err) {
        console.error('[Leaderboard Settings] Error fetching:', err);
        res.status(500).json({ error: 'Failed' });
    }
};

// --- Upgrades ---
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
        const io = req.app?.get('io');
        if (io) {
            io.to(userId).emit('COIN_BALANCE_UPDATE', { balance: result.newBalance });
        }
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[Games] Error purchasing upgrade:', err);
        const status = err.message.includes('Nicht genügend') || err.message.includes('maximale Level') ? 400 : 500;
        res.status(status).json({ error: err.message || 'Failed to purchase upgrade' });
    }
};

// --- Missions & Config ---
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
        res.json({ completed: isCompleted, reward: reward });
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

// --- Scratchcards ---
let scratchcardPacksCache = null;
let scratchcardPacksTimestamp = 0;

exports.getScratchcardCacheStatus = () => {
    return {
        isCached: !!scratchcardPacksCache,
        items: scratchcardPacksCache ? scratchcardPacksCache.length : 0,
        ageSeconds: scratchcardPacksTimestamp ? Math.round((Date.now() - scratchcardPacksTimestamp) / 1000) : null
    };
};

exports.flushScratchcardCache = () => {
    scratchcardPacksCache = null;
    scratchcardPacksTimestamp = 0;
};
const WINNING_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function generateScratchcardGrid(teams, shouldWin) {
    let grid = new Array(9).fill(null);
    if (!teams || teams.length < 3) return grid;
    if (shouldWin) {
        const winningTeam = teams[Math.floor(Math.random() * teams.length)];
        const line = WINNING_LINES[Math.floor(Math.random() * WINNING_LINES.length)];
        line.forEach(index => { grid[index] = winningTeam.code; });
        for (let i = 0; i < 9; i++) {
            if (grid[i] === null) grid[i] = teams[Math.floor(Math.random() * teams.length)].code;
        }
    } else {
        let attempts = 0;
        while (attempts < 50) {
            for (let i = 0; i < 9; i++) grid[i] = teams[Math.floor(Math.random() * teams.length)].code;
            const hasWin = WINNING_LINES.some(line => grid[line[0]] && (grid[line[0]] === grid[line[1]]) && (grid[line[1]] === grid[line[2]]));
            if (!hasWin) break;
            attempts++;
        }
        const finalWinCheck = WINNING_LINES.some(line => grid[line[0]] && (grid[line[0]] === grid[line[1]]) && (grid[line[1]] === grid[line[2]]));
        if (finalWinCheck) {
            const t1 = teams[0].code, t2 = teams[1].code, t3 = teams[2].code;
            grid = [t1, t2, t3, t1, t3, t2, t2, t1, t3];
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

exports.getScratchcardPacks = async (req, res) => {
    try {
        const packs = await dbLayer.getScratchcardPacks();
        const enrichedPacks = await Promise.all(packs.map(async (p) => {
            const teams = await dbLayer.getScratchcardPackTeams(p.id);
            let max_win = 0;
            if (p.is_weighted) max_win = p.price * 1280;
            else max_win = (p.reward_amount || (p.price * 5)) * 64;
            return { ...p, max_win, teams };
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
        if (!scratchcardPacksCache) {
            const packs = await dbLayer.getScratchcardPacks();
            const activePacks = packs.filter(p => p.is_active);
            scratchcardPacksCache = await Promise.all(activePacks.map(async (pack) => {
                const teams = await dbLayer.getScratchcardPackTeams(pack.id);
                let max_win = pack.is_weighted ? pack.price * 1280 : (pack.reward_amount || (pack.price * 5)) * 64;
                return { ...pack, max_win, teams_count: teams.length, teams: teams.map(t => ({ team_code: t.team_code, position: t.position })) };
            }));
            scratchcardPacksTimestamp = Date.now();
        }
        const enhancedPacks = await Promise.all(scratchcardPacksCache.map(async (pack) => {
            let userDailyCount = (userId && pack.max_daily_limit > 0) ? await dbLayer.getUserDailyPackCount(userId, pack.id) : 0;
            return { ...pack, userDailyCount };
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
        const formatWinners = (winners) => winners.map(w => ({
            ...w,
            totalWin: w.totalWon, // Map for frontend consistency
            grid: (typeof w.grid === 'string') ? JSON.parse(w.grid) : (w.grid || []),
            preferences: (typeof w.preferences === 'string') ? JSON.parse(w.preferences) : (w.preferences || {})
        }));
        
        // Map stats to frontend expected names
        const mappedStats = {
            total_sold: stats.totalPlayed || 0,
            total_wins: stats.totalWins || 0,
            total_won: stats.totalPayout || 0,
            latestWinners: formatWinners(latestWinners),
            topWinners: formatWinners(topWinners),
            leaderboard: formatWinners(leaderboard)
        };
        
        res.json(mappedStats);
    } catch (err) {
        console.error('getGlobalScratchcardStats error:', err);
        res.status(500).json({ error: 'Failed to fetch global stats' });
    }
};

exports.getScratchcardLeaderboardData = async (req, res) => {
    try {
        const data = await dbLayer.getScratchcardChartData();
        res.json(data.map(row => ({ day: row.day, dailyWin: Number(row.dailyWin) })));
    } catch (err) {
        console.error('getScratchcardLeaderboardData error:', err);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
};

exports.buyScratchcard = async (req, res, next) => {
    try {
        const { packId } = req.body;
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });
        if (!packId) return res.status(400).json({ error: 'Pack ID required' });

        const pack = await dbLayer.getScratchcardPack(packId);
        if (!pack || !pack.is_active) return res.status(400).json({ error: 'Invalid or inactive scratchcard pack' });
        if (pack.max_daily_limit > 0) {
            const dailyCount = await dbLayer.getUserDailyPackCount(userId, packId);
            if (dailyCount >= pack.max_daily_limit) return res.status(400).json({ error: 'Tägliches Kauflimit erreicht (Daily Limit Reached)' });
        }

        const user = await dbLayer.getUser(userId);
        if (!user || user.koala_balance < pack.price) return res.status(400).json({ error: 'Not enough KoalaCoins' });

        const packTeams = await dbLayer.getScratchcardPackTeams(packId);
        if (!packTeams || packTeams.length < 3) return res.status(400).json({ error: 'Dieses Los ist aktuell nicht verfügbar.' });
        
        const teams = packTeams.map(pt => ({ code: pt.team_code }));
        const shouldWin = Math.random() < pack.win_chance;
        const grid = generateScratchcardGrid(teams, shouldWin);
        const winningLines = findAllWinningLines(grid);
        let winAmount = 0, totalMultiplier = 0.0;

        for (const win of winningLines) {
            if (pack.is_weighted) {
                const teamData = packTeams.find(t => t.team_code === win.code);
                const rank = (teamData ? teamData.position : 0) + 1;
                const N = packTeams.length;
                let multiplier = (N > 1) ? (2 + 18 * Math.pow((N - rank) / (N - 1), 4)) : 20.0;
                totalMultiplier += multiplier;
            } else {
                totalMultiplier += ((pack.reward_amount || (pack.price * 5)) / pack.price);
            }
        }
        if (winningLines.length > 0) winAmount = Math.floor(pack.price * totalMultiplier);

        const result = await dbLayer.purchaseScratchcardTransaction(userId, packId, pack.name, pack.price, grid, winAmount);
        res.json({ id: result.id, grid: result.grid, winAmount: result.winAmount, price: pack.price, winningLines });
    } catch (err) {
        console.error('[Scratchcard] Purchase error:', err);
        res.status(500).json({ error: 'Failed to process purchase' });
    }
};

exports.claimScratchcard = async (req, res, next) => {
    try {
        const { id } = req.body;
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });
        if (!id) return res.status(400).json({ error: 'Card ID required' });
        const result = await dbLayer.claimScratchcard(id, userId);
        res.json({ success: true, winAmount: result.winAmount, price: result.price });
    } catch (err) {
        console.error('[Scratchcard] Claim error:', err);
        res.status(err.status || 500).json({ error: err.message || 'Failed to claim reward' });
    }
};

// --- Pokemon Data ---
exports.getPokemonData = async (req, res, next) => {
    try {
        const { data } = await apiDataService.getPokemonData();
        safeJson(res, data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load Pokémon data' });
    }
};

// --- Daily Status ---
exports.getDailyStatus = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const today = new Date().toISOString().split('T')[0];
        const result = { achievements: false, colorsync: false, 'scratch-cards': false, 'lol-idle': false };

        try {
            const hasClaimedToday = await new Promise((resolve) => {
                dbLayer.db.get(`SELECT id FROM Users WHERE id = ? AND last_daily_claim >= date('now', 'start of day')`, [userId], (err, row) => resolve(!!row));
            });
            result.achievements = !hasClaimedToday;
        } catch (e) { }

        try {
            const hasPlayedToday = await new Promise((resolve) => {
                dbLayer.db.get(`SELECT id FROM ColorSync_DailyResults WHERE userId = ? AND date = ?`, [userId, today], (err, row) => resolve(!!row));
            });
            result.colorsync = !hasPlayedToday;
        } catch (e) { }

        try {
            const hasFreePackToday = await new Promise((resolve) => {
                dbLayer.db.get(`SELECT id FROM Scratchcards WHERE userId = ? AND is_free = 1 AND date(claimed_at) = date('now')`, [userId], (err, row) => resolve(!!row));
            });
            result['scratch-cards'] = !hasFreePackToday;
        } catch (e) { }

        try {
            const hasIdleRewardToday = await new Promise((resolve) => {
                dbLayer.db.get(`SELECT userId FROM Idle_Profiles WHERE userId = ? AND last_daily_reward >= date('now', 'start of day')`, [userId], (err, row) => resolve(!!row));
            });
            result['lol-idle'] = !hasIdleRewardToday;
        } catch (e) { }

        res.json(result);
    } catch (err) {
        next(err);
    }
};

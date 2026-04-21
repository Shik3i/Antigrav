const jwt = require('jsonwebtoken'); // used for secure invite links
const fs = require('fs');
const path = require('path');
const dbLayer = require('../database');
const roomManager = require('../roomManager');
const EVENTS = require('../socketEvents.json');
const sanitize = require('../sanitize');
const axios = require('axios');
const apiDataService = require('../services/apiDataService');
const { safeJson } = require('../utils/safeSerialization');

const JWT_SECRET = require('../jwtSecret');

const adminController = require('./adminController');
const roomController = require('./roomController');
const userController = require('./userController');
const externalController = require('./externalController');






// Changelog Cache
let changelogCache = null;

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

// ─── Test endpoint: cached esports + odds combined ──────────


// ─── Admin Controller Methods ─────────────────────────────────


// ─── Countdowns ─────────────────────────────────────────────


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







// ─── Feature Request Roadmap ─────────────────────────────────────


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

exports.submitTetrisScore = async (req, res, next) => {
    try {
        const { score, lines, level, sprintTime } = req.body;
        let finalUserId = req.user?.id || req.user?.userId;
        if (!finalUserId) return res.status(401).json({ error: 'Unauthorized' });

        // Robustness: If the ID looks like a short name/username, try to resolve it to a UUID
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

        res.json({ success: true, coinsEarned: 0 }); // No coins for Tetris
    } catch (err) {
        console.error('[Games] Error submitting Tetris score:', err);
        if (dbLayer.logError) await dbLayer.logError(`Tetris Score Submission Failed: ${err.message}`, err.stack, req.user?.id);
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

exports.getLeaderboardSettings = async (req, res) => {
    try {
        const settings = await dbLayer.getLeaderboardSettings();
        res.json(settings);
    } catch (err) {
        console.error('[Leaderboard Settings] Error fetching:', err);
        res.status(500).json({ error: 'Failed' });
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







exports.getPokemonData = async (req, res, next) => {
    try {
        const { data } = await apiDataService.getPokemonData();
        safeJson(res, data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load Pokémon data' });
    }
};



// ─── Daily Status Aggregation ────────────────────────────────
exports.getDailyStatus = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const today = new Date().toISOString().split('T')[0];

        // Keys MUST match the item.key in Sidebar.jsx / NavbarSettings
        const result = { 
            achievements: false, 
            colorsync: false,
            'scratch-cards': false,
            'lol-idle': false
        };

        // 1. Check Achievements daily login bonus
        try {
            const hasClaimedToday = await new Promise((resolve) => {
                dbLayer.db.get(
                    `SELECT id FROM Users WHERE id = ? AND last_daily_claim >= date('now', 'start of day')`,
                    [userId],
                    (err, row) => {
                        resolve(!!row);
                    }
                );
            });
            result.achievements = !hasClaimedToday;
        } catch (e) {
            console.error('[DailyStatus] Achievement check error:', e);
        }

        // 2. Check ColorSync daily challenge
        try {
            const hasPlayedToday = await new Promise((resolve) => {
                dbLayer.db.get(
                    `SELECT id FROM ColorSync_DailyResults WHERE userId = ? AND date = ?`,
                    [userId, today],
                    (err, row) => resolve(!!row)
                );
            });
            result.colorsync = !hasPlayedToday;
        } catch (e) { }

        // 3. Check Scratchcards (Free Pack)
        try {
            const hasFreePackToday = await new Promise((resolve) => {
                dbLayer.db.get(
                    `SELECT id FROM Scratchcards WHERE userId = ? AND is_free = 1 AND date(claimed_at) = date('now')`,
                    [userId],
                    (err, row) => resolve(!!row)
                );
            });
            result['scratch-cards'] = !hasFreePackToday;
        } catch (e) { }

        // 4. Check LoL Idle (Daily Reward)
        try {
            const hasIdleRewardToday = await new Promise((resolve) => {
                dbLayer.db.get(
                    `SELECT userId FROM Idle_Profiles WHERE userId = ? AND last_daily_reward >= date('now', 'start of day')`,
                    [userId],
                    (err, row) => resolve(!!row)
                );
            });
            result['lol-idle'] = !hasIdleRewardToday;
        } catch (e) { }

        res.json(result);
    } catch (err) {
        next(err);
    }
};





module.exports = {
    ...adminController,
    ...roomController,
    ...userController,
    ...externalController,
    ...exports
};

const dbLayer = require('../database');
const { ACHIEVEMENTS_CONFIG } = require('../config/achievements');

const emitBalanceUpdate = (req, userId, balance) => {
    const io = req.app?.get('socketio') || req.app?.get('io');
    if (io && userId && Number.isFinite(balance)) {
        io.to(userId).emit('COIN_BALANCE_UPDATE', { balance });
    }
};

// Strict checks for achievement admin (Superadmin + special users)
const isSuperAdminRoot = (user) => {
    const username = user?.username?.toLowerCase();
    return user?.is_superadmin && (username === 'koala' || username === '123');
};

// Map statKey -> DB function
const STAT_FETCHERS = {
    timers: (userId) => dbLayer.getUserTimerCount(userId),
    esports_wins: (userId) => dbLayer.getUserWonMatchCount(userId),
    game_rounds: (userId) => dbLayer.getUserGameRoundCount(userId),
    early_bird: (userId) => dbLayer.hasEarlyBirdTimer(userId),
    night_owl: (userId) => dbLayer.hasNightOwlTimer(userId),
    weekend_warrior: (userId) => dbLayer.hasWeekendWarrior(userId),
    dagobert: (userId) => dbLayer.getUserBalance(userId),
    underdog_win: (userId) => dbLayer.hasUnderdogWin(userId),
    loyal_fan: (userId) => dbLayer.hasLoyalFanWin(userId),
    vote_count: (userId) => dbLayer.getUserVoteCount(userId),
    feature_suggests: (userId) => dbLayer.getUserFeatureRequestCount(userId),
    zero_streak: (userId) => dbLayer.getUserZeroScoreStreak(userId),
    wordle_wins: (userId) => dbLayer.getUserWordleWins(userId),
    fortunes_count: (userId) => dbLayer.getUserFortunesCount(userId),
    blackjack_played: (userId) => dbLayer.getUserBlackjackGames(userId),
    total_spent: (userId) => dbLayer.getUserTotalSpent(userId),
    friends: (userId) => dbLayer.getUserFriendCount(userId),
    tower_count: (userId) => dbLayer.getUserTowerClimbCount(userId),
    lotto_count: (userId) => dbLayer.getUserLifetimeLottoTicketCount(userId),
};

exports.getStatus = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // 1. Fetch all stats in parallel
        const uniqueStatKeys = [...new Set(ACHIEVEMENTS_CONFIG.map(c => c.statKey))];
        const statPromises = uniqueStatKeys.map(key => STAT_FETCHERS[key](userId));
        const [claimedAchievements, lastDailyClaim, baseline, settings, ...statResults] = await Promise.all([
            dbLayer.getUserAchievements(userId),
            dbLayer.getUserDailyClaim(userId),
            dbLayer.getKoalaBaseline(),
            dbLayer.getAchievementSettings(),
            ...statPromises
        ]);

        const statValues = {};
        uniqueStatKeys.forEach((key, i) => { statValues[key] = statResults[i]; });

        const multiplierMap = {};
        settings.forEach(s => { multiplierMap[s.achievementId] = s.multiplier; });

        // 2. Base rate = koala_points_per_hour
        const baseRate = baseline.koala_points_per_hour || 1000;
        const dailyReward = baseRate;

        // 3. Daily bonus status
        const today = new Date().toISOString().split('T')[0];
        const lastDailyDate = lastDailyClaim ? lastDailyClaim.split(' ')[0] : null;
        const dailyAvailable = lastDailyDate !== today;

        // 4. Build milestones with chain logic
        const claimedIds = claimedAchievements.map(a => a.achievementId);

        const milestones = ACHIEVEMENTS_CONFIG.map(config => {
            const currentProgress = statValues[config.statKey] || 0;
            const isCompleted = currentProgress >= config.requiredCount;
            const isClaimed = claimedIds.includes(config.id);

            const indMultiplier = multiplierMap[config.id] || baseline.achievement_reward_multiplier || 2.5;

            return {
                ...config,
                currentProgress,
                isCompleted,
                isClaimed,
                rewardCoins: Math.round(baseRate * indMultiplier)
            };
        });

        // 5. Sequential chain filter: per chain, only include claimed milestones + the first unclaimed one
        const chains = [...new Set(ACHIEVEMENTS_CONFIG.map(c => c.chain))];
        const visibleMilestones = [];

        for (const chain of chains) {
            const chainMilestones = milestones.filter(m => m.chain === chain);
            let foundNextGoal = false;
            for (const m of chainMilestones) {
                if (m.isClaimed) {
                    visibleMilestones.push(m);
                } else if (!foundNextGoal) {
                    visibleMilestones.push(m);
                    foundNextGoal = true;
                }
                // skip further unclaimed milestones in this chain
            }
        }

        res.json({
            daily: {
                available: dailyAvailable,
                rewardCoins: dailyReward,
                lastClaim: lastDailyClaim
            },
            milestones: visibleMilestones
        });

    } catch (err) {
        // Skip log for unauthorized fetches (redundant since middleware handles most)
        if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        console.error('Error fetching achievement status:', err);
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
};

exports.claimAchievement = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;

        // Daily bonus claim
        if (id === 'daily') {
            const lastDailyClaim = await dbLayer.getUserDailyClaim(userId);
            const today = new Date().toISOString().split('T')[0];
            const lastDailyDate = lastDailyClaim ? lastDailyClaim.split(' ')[0] : null;

            if (lastDailyDate === today) {
                return res.status(400).json({ error: 'Daily bonus already claimed today' });
            }

            const baseline = await dbLayer.getKoalaBaseline();
            const dailyReward = baseline.koala_points_per_hour || 1000;

            await dbLayer.updateDailyClaimTime(userId);
            const newBalance = await dbLayer.addKoalaCoins(userId, dailyReward, 'Daily Login Bonus');
            emitBalanceUpdate(req, userId, newBalance);

            return res.json({ success: true, reward: dailyReward, newBalance });
        }

        // Milestone claim
        const config = ACHIEVEMENTS_CONFIG.find(c => c.id === id);
        if (!config) {
            return res.status(404).json({ error: 'Achievement not found' });
        }

        // Check not already claimed
        const claimedAchievements = await dbLayer.getUserAchievements(userId);
        if (claimedAchievements.some(a => a.achievementId === id)) {
            return res.status(400).json({ error: 'Achievement already claimed' });
        }

        // Verify requirement is met using the correct stat
        const fetcher = STAT_FETCHERS[config.statKey];
        if (!fetcher) return res.status(500).json({ error: 'Unknown stat key' });
        const currentProgress = await fetcher(userId);
        if (currentProgress < config.requiredCount) {
            return res.status(400).json({ error: 'Achievement requirements not met' });
        }

        // Compute dynamic reward at claim time
        const baseline = await dbLayer.getKoalaBaseline();
        const settings = await dbLayer.getAchievementSettings();
        const indMultiplierSetting = settings.find(s => s.achievementId === id);
        const indMultiplier = indMultiplierSetting ? indMultiplierSetting.multiplier : (baseline.achievement_reward_multiplier || 2.5);
        
        const dynamicReward = Math.round((baseline.koala_points_per_hour || 1000) * indMultiplier);

        await dbLayer.claimAchievement(userId, id);
        const newBalance = await dbLayer.addKoalaCoins(userId, dynamicReward, `Achievement: ${config.title}`);
        emitBalanceUpdate(req, userId, newBalance);

        res.json({ success: true, reward: dynamicReward, newBalance });

    } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Achievement already claimed concurrently' });
        }
        console.error('Error claiming achievement:', err);
        res.status(500).json({ error: 'Internal Server Error during claim' });
    }
};

exports.getAdminSettings = async (req, res) => {
    try {
        if (!isSuperAdminRoot(req.user)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }

        const settings = await dbLayer.getAchievementSettings();
        const multiplierMap = {};
        settings.forEach(s => { multiplierMap[s.achievementId] = s.multiplier; });

        const baseline = await dbLayer.getKoalaBaseline();
        const globalMultiplier = baseline.achievement_reward_multiplier || 2.5;

        const milestones = ACHIEVEMENTS_CONFIG.map(config => ({
            ...config,
            multiplier: multiplierMap[config.id] || globalMultiplier
        }));

        res.json({ milestones, globalMultiplier });
    } catch (err) {
        console.error('Error fetching admin achievement settings:', err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

exports.updateAdminSettings = async (req, res) => {
    try {
        if (!isSuperAdminRoot(req.user)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }

        const { multipliers } = req.body; // Array of { id, multiplier }
        if (!Array.isArray(multipliers)) {
            return res.status(400).json({ error: 'Invalid payload: multipliers array required' });
        }

        for (const item of multipliers) {
            await dbLayer.updateAchievementSetting(item.id, item.multiplier);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating admin achievement settings:', err);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

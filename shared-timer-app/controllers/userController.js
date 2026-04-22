const dbLayer = require('../database');
const sanitize = require('../sanitize');

// --- User Registration & Auth Support ---
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

// --- Profiles ---
exports.getUserProfile = async (req, res, next) => {
    try {
        const username = req.params.username;
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

// --- Activity & Economy ---
exports.getActivityHistory = async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const history = await dbLayer.getActivityHistory(days);
        res.json(history);
    } catch (err) {
        next(err);
    }
};

exports.getKoalaTransactions = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const transactions = await dbLayer.getKoalaTransactions(userId, 1000);
        res.json(transactions);
    } catch (err) {
        console.error('Error fetching koala transactions:', err);
        res.status(500).json({ error: 'Failed to fetch koala transactions' });
    }
};

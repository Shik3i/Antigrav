const dbLayer = require('../database');

const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
};

exports.getStatus = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const date = getTodayDate();
        const status = await dbLayer.getFortuneStatus(userId, date);

        res.json({
            opened: !!status,
            text: status ? (status.text || "Wow, du hast das Universum durchgespielt! Wir haben aktuell keine neuen Kekse mehr für dich. Sag dem Admin Bescheid!") : null
        });
    } catch (err) {
        next(err);
    }
};

exports.openFortune = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const date = getTodayDate();
        
        // 1. Check if fortune already opened today (DB handles this too, but we need consistency for rewards)
        const existingStatus = await dbLayer.getFortuneStatus(userId, date);
        if (existingStatus) {
            return res.status(400).json({ error: 'Du hast heute bereits einen Glückskeks geöffnet!' });
        }

        // 2. Determine if daily reward should be granted
        const lastDailyClaim = await dbLayer.getUserDailyClaim(userId);
        const lastDailyDate = lastDailyClaim ? lastDailyClaim.split(' ')[0] : null;
        const dailyAvailable = lastDailyDate !== date;
        
        let reward = 0;
        let newBalance = null;

        if (dailyAvailable) {
            const baseline = await dbLayer.getKoalaBaseline();
            reward = baseline.koala_points_per_hour || 1000;
            await dbLayer.updateDailyClaimTime(userId);
            newBalance = await dbLayer.addKoalaCoins(userId, reward, 'Glückskeks Daily Reward');
        }

        // 3. Open the cookie
        const result = await dbLayer.openDailyFortune(userId, date);
        
        // 4. Return combined result
        res.json({
            ...result,
            reward,
            newBalance
        });

    } catch (err) {
        if (err.message.includes('bereits')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

exports.bulkImport = async (req, res, next) => {
    try {
        if (!req.user?.is_superadmin) {
            return res.status(403).json({ error: 'Nur Superadmins können Glückskekse importieren.' });
        }

        const fortunes = req.body;
        if (!Array.isArray(fortunes)) {
            return res.status(400).json({ error: 'Ungültiges Format. Erwartet wird ein Array von Strings.' });
        }

        const count = await dbLayer.addFortunesBulk(fortunes);

        res.json({ success: true, importedCount: count });
    } catch (err) {
        next(err);
    }
};

exports.adminGetDictionary = async (req, res, next) => {
    try {
        if (!req.user?.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
        const list = await dbLayer.getFortunesDictionary();
        res.json(list);
    } catch (err) {
        next(err);
    }
};

exports.deleteFortune = async (req, res, next) => {
    try {
        if (!req.user?.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'ID fehlt.' });

        await dbLayer.deleteFortune(id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

const dbLayer = require('../database');

const emitBalanceUpdate = (req, userId, balance) => {
    const io = req.app?.get('socketio') || req.app?.get('io');
    if (io && userId && Number.isFinite(balance)) {
        io.to(userId).emit('COIN_BALANCE_UPDATE', { balance });
    }
};

const GACHA_CAPSULE_PRICE = 1000;
const LEC_POOL = ['FNC', 'G2', 'GX', 'KC', 'KCB', 'LR', 'MKOI', 'NAVI', 'SHFT', 'SK', 'TH', 'VIT'];
const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
const RARITY_MULTIPLIERS = { 'Common': 2, 'Rare': 5, 'Epic': 10, 'Legendary': 20 };

const getNextLevelXP = (level) => Math.floor(100 * Math.pow(level, 1.5));

const calculateStats = (unit, slotId = null) => {
    const base = unit.base_stats || 10;
    const level = unit.level || 1;
    const multiplier = RARITY_MULTIPLIERS[unit.rarity] || 2;
    let total = base + (level * multiplier);

    // Position Malus (Slots 1-5 correspond to ROLES indices 0-4)
    if (slotId && slotId <= 5) {
        const expectedRole = ROLES[slotId - 1];
        if (unit.role !== expectedRole) total = Math.floor(total / 2);
    }
    return total;
};

exports.syncIdleProgress = async (userId) => {
    const profile = await dbLayer.getIdleProfile(userId);
    const roster = await dbLayer.getIdleRoster(userId);
    const now = new Date();
    const lastSync = profile.last_sync_at ? new Date(profile.last_sync_at) : now;
    const diffS = Math.floor((now - lastSync) / 1000);

    if (diffS < 10) return; // Sync every 10s min

    let totalHype = 0;
    let totalDollars = 0;

    for (const slot of roster) {
        if (!slot.inventory_id) continue;

        if (slot.current_mode === 'Trainieren') {
            const xpGain = Math.floor(diffS / 60) * 10; // 10 XP per minute
            if (xpGain > 0) {
                let newXP = (slot.experience || 0) + xpGain;
                let newLevel = slot.level || 1;
                
                while (newXP >= getNextLevelXP(newLevel)) {
                    newXP -= getNextLevelXP(newLevel);
                    newLevel++;
                }
                
                await dbLayer.updateInventoryUnit(slot.inventory_id, { 
                    experience: newXP, 
                    level: newLevel 
                });
            }
        } else if (slot.current_mode === 'Streamen') {
            // Streaming grants Dollars ($) and Hype
            // Base: 5 $ and 2 Hype per minute per Tier
            let factor = (slot.tier || 1);
            if (slot.slot_id === 7) factor *= 3; // Streamer Slot is 3x more effective

            const dollarsGain = Math.floor(diffS / 60) * 5 * factor;
            const hypeGain = Math.floor(diffS / 60) * 2 * factor;
            
            totalDollars += dollarsGain;
            totalHype += hypeGain;
        }
    }

    await dbLayer.updateIdleProfile(userId, {
        hype: (profile.hype || 0) + totalHype,
        dollars: (profile.dollars || 0) + totalDollars,
        last_sync_at: now.toISOString().replace('T', ' ').substring(0, 19)
    });
};

exports.getGameStatus = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        await this.syncIdleProgress(userId);

        const [profile, roster, inventory] = await Promise.all([
            dbLayer.getIdleProfile(userId),
            dbLayer.getIdleRoster(userId),
            dbLayer.getIdleInventory(userId)
        ]);

        const rosterWithStats = roster.map(slot => ({
            ...slot,
            display_stats: slot.inventory_id ? calculateStats(slot, slot.slot_id) : 0
        }));

        res.json({ success: true, profile, roster: rosterWithStats, inventory });
    } catch (err) {
        console.error('[IdleGame] Error fetching status:', err);
        res.status(500).json({ error: 'Failed' });
    }
};

const TEAM_STRENGTH = {
    'G2': 'S', 'FNC': 'S',
    'VIT': 'A', 'KC': 'A', 'TH': 'A', 'SK': 'A',
    'LR': 'B', 'NAVI': 'B', 'GX': 'B', 'SHFT': 'B', 'MKOI': 'B', 'KCB': 'B'
};

exports.performGachaPull = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { useKC, amount = 1 } = req.body; 
        const pullAmount = parseInt(amount) || 1;

        if (useKC) {
            const cost = 10 * pullAmount;
            const user = await dbLayer.getUser(userId);
            if (!user || user.koala_balance < cost) return res.status(400).json({ error: `Zu wenig KoalaCoins (${cost} KC benötigt)` });
            const newBalanceValue = await dbLayer.addKoalaCoins(userId, -cost, `LoL Idle Pull x${pullAmount} (KC)`);
            emitBalanceUpdate(req, userId, newBalanceValue);
        } else {
            const cost = 10000 * pullAmount;
            const profile = await dbLayer.getIdleProfile(userId);
            if (!profile || (profile.dollars || 0) < cost) return res.status(400).json({ error: `Zu wenig Dollar ($${cost.toLocaleString()} benötigt)` });
            await dbLayer.updateIdleProfile(userId, { dollars: profile.dollars - cost });
        }
        
        const pulledResults = [];
        for (let i = 0; i < pullAmount; i++) {
            const teamCode = LEC_POOL[Math.floor(Math.random() * LEC_POOL.length)];
            const strength = TEAM_STRENGTH[teamCode] || 'B';
            const rand = Math.random() * 100;
            let rarity = 'Common';
            let baseStats = Math.floor(Math.random() * 15) + 10;

            if (strength === 'S') {
                if (rand < 10) { rarity = 'Legendary'; baseStats = 50; }
                else if (rand < 25) { rarity = 'Epic'; baseStats = 30; }
                else if (rand < 50) { rarity = 'Rare'; baseStats = 20; }
            } else if (strength === 'A') {
                if (rand < 5) { rarity = 'Legendary'; baseStats = 50; }
                else if (rand < 15) { rarity = 'Epic'; baseStats = 30; }
                else if (rand < 35) { rarity = 'Rare'; baseStats = 20; }
            } else {
                if (rand < 1) { rarity = 'Legendary'; baseStats = 50; }
                else if (rand < 5) { rarity = 'Epic'; baseStats = 30; }
                else if (rand < 20) { rarity = 'Rare'; baseStats = 20; }
            }
            const role = ROLES[Math.floor(Math.random() * ROLES.length)];
            await dbLayer.addInventoryUnit(userId, teamCode, rarity, baseStats, role);
            pulledResults.push({ team: teamCode, rarity, stats: baseStats, role });
        }
        
        const [inventory, profile] = await Promise.all([
            dbLayer.getIdleInventory(userId),
            dbLayer.getIdleProfile(userId)
        ]);

        res.json({ 
            success: true, 
            inventory, 
            profile,
            results: pulledResults // Array of all pulls
        });

    } catch (err) {
        console.error('[IdleGame] Gacha error:', err);
        res.status(500).json({ error: 'Failed' });
    }
};

exports.sellUnit = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { unitId } = req.body;
        if (!unitId) return res.status(400).json({ error: 'Missing unitId' });

        const inventory = await dbLayer.getIdleInventory(userId);
        const unit = inventory.find(i => i.id === unitId);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });
        if (unit.is_equipped) return res.status(400).json({ error: 'Unit is equipped' });

        // Pricing in Dollars ($): Common: 100, Rare: 250, Epic: 1000, Legendary: 5000
        const prices = { 'Common': 100, 'Rare': 250, 'Epic': 1000, 'Legendary': 5000 };
        const price = prices[unit.rarity] || 100;

        await dbLayer.deleteInventoryUnit(unitId);
        
        // Update dollars in profile
        const profile = await dbLayer.getIdleProfile(userId);
        await dbLayer.updateIdleProfile(userId, {
            dollars: (profile.dollars || 0) + price
        });

        const newInv = await dbLayer.getIdleInventory(userId);
        const newProfile = await dbLayer.getIdleProfile(userId);

        res.json({ success: true, inventory: newInv, profile: newProfile, message: `Sold for $${price}!` });
    } catch (err) {
        console.error('[IdleGame] Sell error:', err);
        res.status(500).json({ error: 'Failed' });
    }
};

exports.mergeUnits = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { teamCode, tier, role } = req.body;

        if (!role) return res.status(400).json({ error: 'Missing role for merge' });

        const result = await dbLayer.mergeInventoryUnits(userId, teamCode, tier, role);
        const inventory = await dbLayer.getIdleInventory(userId);
        
        res.json({ success: true, inventory, newUnit: result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.mergeAllUnits = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const result = await dbLayer.mergeAllInventoryUnits(userId);
        const inventory = await dbLayer.getIdleInventory(userId);
        res.json({ success: true, inventory, changes: result.changes });
    } catch (err) {
        console.error('[IdleGame] MergeAll error:', err);
        res.status(500).json({ error: 'Merge All failed' });
    }
};

exports.equipUnit = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { slotId, inventoryId } = req.body; 

        await dbLayer.assignInventoryToRoster(userId, slotId, inventoryId);
        const inventory = await dbLayer.getIdleInventory(userId);
        const roster = await dbLayer.getIdleRoster(userId);

        res.json({ success: true, inventory, roster });
    } catch (err) {
        res.status(500).json({ error: 'Equip failed' });
    }
};

exports.updateRosterMode = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { slotId, mode } = req.body;
        await dbLayer.updateRosterMode(userId, slotId, mode);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Update mode failed' });
    }
};

exports.validateTournament = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { result, durationS } = req.body;
        if (durationS < 55) return res.status(400).json({ error: 'Anti-cheat' });

        if (result === 'victory') {
            const profile = await dbLayer.getIdleProfile(userId);
            // Victory grants $500 and 100 Hype
            await dbLayer.updateIdleProfile(userId, { 
                level: profile.level + 1,
                dollars: (profile.dollars || 0) + 500,
                hype: (profile.hype || 0) + 100
            });
            res.json({ success: true, newLevel: profile.level + 1 });
        } else {
            res.json({ success: true });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
};

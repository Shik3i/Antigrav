const dbLayer = require('../database');

const CAPSULE_PRICE = 1000; // 10 KC (1000 cents)

exports.getShopConfig = async (req, res) => {
    try {
        const packs = await dbLayer.getScratchcardPacks();
        const weightedPacks = packs.filter(p => p.is_weighted && p.is_active);
        res.json({ success: true, packs: weightedPacks });
    } catch (err) {
        console.error('[RiftDefense] Error fetching shop config:', err);
        res.status(500).json({ error: 'Failed to fetch shop config' });
    }
};

exports.buyCapsule = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const { packId } = req.body;
        if (!packId) return res.status(400).json({ error: 'Pack ID required' });

        const user = await dbLayer.getUser(userId);
        if (!user || user.koala_balance < CAPSULE_PRICE) {
            return res.status(400).json({ error: 'Not enough KoalaCoins' });
        }

        // Validate Pack
        const pack = await dbLayer.getScratchcardPack(packId);
        if (!pack || !pack.is_weighted || !pack.is_active) {
            return res.status(400).json({ error: 'Invalid or inactive pack' });
        }

        // Deduct 10 KC (1000 cents)
        await dbLayer.addKoalaCoins(userId, -CAPSULE_PRICE, `Purchased Rift Defense Capsule (${pack.name})`);

        const teams = await dbLayer.getScratchcardPackTeams(pack.id);
        if (!teams || teams.length === 0) {
            return res.status(400).json({ error: 'No teams available for Gacha' });
        }

        // Gacha probability calculation
        // Position 0 = Strongest team (lowest drop chance)
        // Position N-1 = Weakest team (highest drop chance)
        const N = teams.length;
        
        const weights = teams.map(t => {
            const rank = t.position + 1;
            return Math.pow(rank, 4);
        });

        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let randomNum = Math.random() * totalWeight;
        
        let selectedTeamCode = teams[N - 1].team_code; // Default to weakest
        for (let i = 0; i < N; i++) {
            randomNum -= weights[i];
            if (randomNum <= 0) {
                selectedTeamCode = teams[i].team_code;
                break;
            }
        }

        // Add to inventory
        // rarityTier: 0 is common, higher is rarer. 
        // Based on weighted logic: Position 0 is rare, Position N-1 is common.
        // Let's invert it: rarityTier = (N - 1) - position
        const selectedTeam = teams.find(t => t.team_code === selectedTeamCode);
        const rarityTier = (N - 1) - (selectedTeam ? selectedTeam.position : (N-1));
        
        const tower = await dbLayer.addRiftDefenseTower(userId, selectedTeamCode, 1, rarityTier);
        
        // Fetch new balance
        const updatedUser = await dbLayer.getUser(userId);

        res.json({
            success: true,
            tower,
            newBalance: updatedUser.koala_balance
        });
    } catch (err) {
        console.error('[RiftDefense] Error buying capsule:', err);
        res.status(500).json({ error: 'Failed to purchase capsule' });
    }
};

exports.getInventory = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const towers = await dbLayer.getUserRiftDefenseTowers(userId);
        res.json({ success: true, towers });
    } catch (err) {
        console.error('[RiftDefense] Error fetching inventory:', err);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
};

exports.combineTowers = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const { teamCode, starLevel } = req.body;
        if (!teamCode || !starLevel || starLevel >= 3) {
            return res.status(400).json({ error: 'Invalid combine parameters' });
        }

        const towers = await dbLayer.getUserRiftDefenseTowers(userId);
        const matchingTowers = towers.filter(t => t.teamCode === teamCode && t.starLevel === starLevel);

        if (matchingTowers.length < 3) {
            return res.status(400).json({ error: 'Not enough towers to combine. Need 3.' });
        }

        const rarityTier = matchingTowers[0].rarityTier;

        // Delete 3 towers of this star level
        const deletedRows = await dbLayer.deleteRiftDefenseTowers(userId, teamCode, starLevel, 3);
        if (deletedRows !== 3) {
            return res.status(500).json({ error: 'Database error during combine' });
        }

        // Add 1 upgraded tower
        const newTower = await dbLayer.addRiftDefenseTower(userId, teamCode, starLevel + 1, rarityTier);

        res.json({ success: true, newTower });
    } catch (err) {
        console.error('[RiftDefense] Error combining towers:', err);
        res.status(500).json({ error: 'Failed to combine towers' });
    }
};

exports.combineAllTowers = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const towers = await dbLayer.getUserRiftDefenseTowers(userId);
        
        let combinedCount = 0;
        let inventoryMap = {};

        // Group by teamCode and starLevel
        towers.forEach(t => {
            if (!inventoryMap[t.teamCode]) inventoryMap[t.teamCode] = { 1: [], 2: [], 3: [] };
            inventoryMap[t.teamCode][t.starLevel].push(t);
        });

        // Combine logic (bottom up 1 -> 2, then 2 -> 3)
        for (const teamCode in inventoryMap) {
            for (let star = 1; star < 3; star++) {
                const count = inventoryMap[teamCode][star].length;
                const combines = Math.floor(count / 3);
                
                if (combines > 0) {
                    const rarityTier = inventoryMap[teamCode][star][0].rarityTier;
                    
                    // Delete 3 * combines
                    await dbLayer.deleteRiftDefenseTowers(userId, teamCode, star, combines * 3);
                    
                    // Add combines of next star
                    for (let c = 0; c < combines; c++) {
                        const newT = await dbLayer.addRiftDefenseTower(userId, teamCode, star + 1, rarityTier);
                        inventoryMap[teamCode][star + 1].push(newT); // Add to map in case it cascades
                        combinedCount++;
                    }
                }
            }
        }

        res.json({ success: true, combinedCount });
    } catch (err) {
        console.error('[RiftDefense] Error combine all:', err);
        res.status(500).json({ error: 'Failed to combine all towers' });
    }
};

exports.scrapTower = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const { towerId } = req.body;
        if (!towerId) return res.status(400).json({ error: 'Tower ID required' });

        const scrapReward = Math.floor(CAPSULE_PRICE * 0.2); // 20% refund

        const deletedRows = await dbLayer.scrapRiftDefenseTower(towerId, userId);
        if (deletedRows === 0) {
            return res.status(400).json({ error: 'Tower not found or already deleted' });
        }

        await dbLayer.addKoalaCoins(userId, scrapReward, 'Scrapped Rift Defense Tower');
        
        const updatedUser = await dbLayer.getUser(userId);

        res.json({ success: true, refund: scrapReward, newBalance: updatedUser.koala_balance });
    } catch (err) {
        console.error('[RiftDefense] Error scraping tower:', err);
        res.status(500).json({ error: 'Failed to scrap tower' });
    }
};

exports.saveStats = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const { highestWave, minionsKilled, bossesKilled } = req.body;
        
        // WICHTIG: Keine KC Generation aus Gameplay!

        await dbLayer.updateRiftDefenseStats(userId, highestWave || 0, minionsKilled || 0, bossesKilled || 0);

        res.json({ success: true });
    } catch (err) {
        console.error('[RiftDefense] Error saving stats:', err);
        res.status(500).json({ error: 'Failed to save stats' });
    }
};

exports.getLeaderboards = async (req, res) => {
    try {
        const stats = await dbLayer.getRiftDefenseLeaderboards();
        res.json({ success: true, leaderboards: stats });
    } catch (err) {
        console.error('[RiftDefense] Error fetching leaderboards:', err);
        res.status(500).json({ error: 'Failed to fetch leaderboards' });
    }
};

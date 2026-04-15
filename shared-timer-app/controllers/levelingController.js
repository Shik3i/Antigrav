const db = require('../database');

/**
 * Check if a level qualifies as a milestone.
 * Rules:
 *   Lvl 1-59:  every 15 levels (15, 30, 45)
 *   Lvl 60-99: every 5 levels  (60, 65, 70, 75, 80, 85, 90, 95)
 *   Lvl 100+:  every level      (100, 101, 102, ...)
 */
const isMilestone = (level) => {
    if (level >= 100) return true;
    if (level >= 60 && level % 5 === 0) return true;
    if (level >= 15 && level < 60 && level % 15 === 0) return true;
    return false;
};

exports.saveMilestone = (req, res) => {
    const userId = req.user.userId;
    const { level } = req.body;

    if (!level || typeof level !== 'number' || level < 1) {
        return res.status(400).json({ error: 'Invalid level' });
    }

    const milestonesToSave = [];
    for (let l = 1; l <= Math.min(level, 200); l++) { // Cap at 200 for safety, can be adjusted
        if (isMilestone(l)) {
            milestonesToSave.push(l);
        }
    }

    if (milestonesToSave.length === 0) {
        return res.json({ saved: false, reason: 'Level below first milestone (15)' });
    }

    db.db.serialize(() => {
        db.db.run("BEGIN TRANSACTION");
        const stmt = db.db.prepare(`INSERT OR IGNORE INTO LevelingMilestones (userId, level) VALUES (?, ?)`);
        
        milestonesToSave.forEach(lvl => {
            stmt.run(userId, lvl);
        });

        stmt.finalize();
        db.db.run("COMMIT", (err) => {
            if (err) {
                console.error('[Leveling] Error committing milestones:', err);
                return res.status(500).json({ error: 'Failed to save milestones' });
            }
            res.json({ saved: true, milestonesChecked: milestonesToSave.length, lastLevel: level });
        });
    });
};

/**
 * GET /api/leveling/milestones
 * Returns all milestones for the authenticated user, ordered by level.
 */
exports.getMilestones = (req, res) => {
    const userId = req.user.userId;
    const query = `SELECT level, reachedAt FROM LevelingMilestones WHERE userId = ? ORDER BY level ASC`;
    
    db.db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error('[Leveling] Error fetching milestones:', err);
            return res.status(500).json({ error: 'Failed to fetch milestones' });
        }
        res.json(rows || []);
    });
};

// Export for testing
exports.isMilestone = isMilestone;

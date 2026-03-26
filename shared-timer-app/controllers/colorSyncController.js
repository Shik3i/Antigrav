const db = require('../database');
const crypto = require('crypto');

/**
 * Deterministic color generation for the daily mode.
 * Uses the date string as a seed.
 */
const getSeedFromDate = (dateStr) => {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        const char = dateStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

const generateColorFromSeed = (seed) => {
    const r = Math.floor(seededRandom(seed) * 256);
    const g = Math.floor(seededRandom(seed + 1) * 256);
    const b = Math.floor(seededRandom(seed + 2) * 256);
    return { r, g, b, hex: `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}` };
};

/**
 * Calculates the score (0-10.0) based on RGB distance.
 */
exports.calculateScore = (target, guessed) => {
    const distance = Math.sqrt(
        Math.pow(target.r - guessed.r, 2) +
        Math.pow(target.g - guessed.g, 2) +
        Math.pow(target.b - guessed.b, 2)
    );
    
    // Max distance in RGB space is sqrt(255^2 + 255^2 + 255^2) ≈ 441.67
    const maxDistance = Math.sqrt(3 * Math.pow(255, 2));
    const score = Math.max(0, 10 * (1 - distance / maxDistance));
    return parseFloat(score.toFixed(1));
};

exports.getDailyColor = (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const seed = getSeedFromDate(today);
    const color = generateColorFromSeed(seed);
    res.json({ date: today, ...color });
};

exports.getRandomColor = (req, res) => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    res.json({ r, g, b, hex });
};

exports.submitScore = (req, res) => {
    const { score, target_color, guessed_color, mode } = req.body;
    const userId = req.user.userId;

    const query = `INSERT INTO ColorSync_Scores (userId, score, target_color, guessed_color, mode) VALUES (?, ?, ?, ?, ?)`;
    db.db.run(query, [userId, score, target_color, guessed_color, mode], function(err) {
        if (err) {
            console.error('Error saving ColorSync score:', err);
            return res.status(500).json({ error: 'Failed to save score' });
        }
        res.json({ success: true, id: this.lastID });
    });
};

exports.createLobby = (req, res) => {
    const lobbyId = crypto.randomUUID();
    const creatorId = req.user.userId;
    
    // Random color for the lobby
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const targetColor = JSON.stringify({ r, g, b });

    const query = `INSERT INTO ColorSync_Lobbies (id, creatorId, target_color) VALUES (?, ?, ?)`;
    db.db.run(query, [lobbyId, creatorId, targetColor], (err) => {
        if (err) {
            console.error('Error creating ColorSync lobby:', err);
            return res.status(500).json({ error: 'Failed to create lobby' });
        }
        res.json({ lobbyId });
    });
};

exports.getLobbyData = (req, res) => {
    const { uuid } = req.params;

    const lobbyQuery = `SELECT * FROM ColorSync_Lobbies WHERE id = ?`;
    const participantsQuery = `
        SELECT p.*, u.displayName 
        FROM ColorSync_LobbyParticipants p
        JOIN Users u ON p.userId = u.id
        WHERE p.lobby_id = ?
    `;

    db.db.get(lobbyQuery, [uuid], (err, lobby) => {
        if (err || !lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }

        db.db.all(participantsQuery, [uuid], (err, participants) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch participants' });
            }

            res.json({
                ...lobby,
                target_color: JSON.parse(lobby.target_color),
                participants
            });
        });
    });
};

exports.submitLobbyScore = (req, res) => {
    const { uuid } = req.params;
    const { score, guessed_color } = req.body;
    const userId = req.user.userId;

    const checkLobby = `SELECT status FROM ColorSync_Lobbies WHERE id = ?`;
    db.db.get(checkLobby, [uuid], (err, lobby) => {
        if (err || !lobby) return res.status(404).json({ error: 'Lobby not found' });

        const query = `
            INSERT INTO ColorSync_LobbyParticipants (lobby_id, userId, score, guessed_color, submitted_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(lobby_id, userId) DO UPDATE SET
                score = excluded.score,
                guessed_color = excluded.guessed_color,
                submitted_at = CURRENT_TIMESTAMP
        `;
        
        db.db.run(query, [uuid, userId, score, guessed_color], (err) => {
            if (err) {
                console.error('Error submitting lobby score:', err);
                return res.status(500).json({ error: 'Failed to submit score' });
            }
            res.json({ success: true });
        });
    });
};

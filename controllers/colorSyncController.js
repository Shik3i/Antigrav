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
    const score = Math.max(0, 10 * Math.pow(1 - distance / maxDistance, 2.5));
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

exports.submitScore = async (req, res) => {
    const { score, target_color, guessed_color, mode } = req.body;
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    let earnedCoins = 0;
    try {
        if (mode === 'DAILY') {
            const existing = db.db.prepare('SELECT id FROM ColorSync_DailyResults WHERE userId = ? AND date = ?').get(userId, today);
            if (existing) return res.status(403).json({ error: 'You have already played today\'s challenge.' });
            db.db.prepare('INSERT INTO ColorSync_DailyResults (userId, score, guessed_color, date) VALUES (?, ?, ?, ?)')
                .run(userId, score, guessed_color, today);
            await db.addKoalaCoins(userId, 1000, 'Color Sync Daily Completion');
            earnedCoins = 10;
        }
        const result = db.db.prepare('INSERT INTO ColorSync_Scores (userId, score, target_color, guessed_color, mode) VALUES (?, ?, ?, ?, ?)')
            .run(userId, score, target_color, guessed_color, mode);
        res.json({ success: true, id: Number(result.lastInsertRowid), earnedCoins });
    } catch (error) {
        console.error('Error saving ColorSync score:', error);
        res.status(500).json({ error: 'Failed to save score' });
    }
};

exports.checkDailyStatus = (req, res) => {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];
    const query = `SELECT * FROM ColorSync_DailyResults WHERE userId = ? AND date = ?`;
    
    try { const result=db.db.prepare(query).get(userId,today); res.json({played:!!result,result}); }
    catch { res.status(500).json({error:'Database error'}); }
};

exports.getDailyStats = (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    const statsQuery = `
        SELECT 
            AVG(score) as avgScore,
            COUNT(*) as participantCount
        FROM ColorSync_DailyResults 
        WHERE date = ?
    `;

    const leaderboardQuery = `
        SELECT r.score, r.guessed_color, u.displayName
        FROM ColorSync_DailyResults r
        JOIN Users u ON r.userId = u.id
        WHERE r.date = ?
        ORDER BY r.score DESC
        LIMIT 3
    `;

    try { const stats=db.db.prepare(statsQuery).get(today); const topPerformers=db.db.prepare(leaderboardQuery).all(today); res.json({avgScore:stats.avgScore?parseFloat(stats.avgScore.toFixed(1)):0,participantCount:stats.participantCount||0,topPerformers}); }
    catch { res.status(500).json({error:'Failed to fetch stats'}); }
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
    try { db.db.prepare(query).run(lobbyId,creatorId,targetColor); res.json({lobbyId}); }
    catch(error){console.error('Error creating ColorSync lobby:',error);res.status(500).json({error:'Failed to create lobby'});}
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

    try { const lobby=db.db.prepare(lobbyQuery).get(uuid); if(!lobby)return res.status(404).json({error:'Lobby not found'}); const participants=db.db.prepare(participantsQuery).all(uuid); res.json({...lobby,target_color:JSON.parse(lobby.target_color),participants}); }
    catch { res.status(500).json({error:'Failed to fetch participants'}); }
};

exports.submitLobbyScore = (req, res) => {
    const { uuid } = req.params;
    const { score, guessed_color } = req.body;
    const userId = req.user.userId;

    const checkLobby = `SELECT status FROM ColorSync_Lobbies WHERE id = ?`;
    try {
        const lobby = db.db.prepare(checkLobby).get(uuid);
        if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
        const query = `
            INSERT INTO ColorSync_LobbyParticipants (lobby_id, userId, score, guessed_color, submitted_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(lobby_id, userId) DO UPDATE SET
                score = excluded.score,
                guessed_color = excluded.guessed_color,
                submitted_at = CURRENT_TIMESTAMP
        `;
        
        db.db.prepare(query).run(uuid,userId,score,guessed_color);
        const colorRow=db.db.prepare('SELECT target_color FROM ColorSync_Lobbies WHERE id=?').get(uuid);
        if(colorRow){const target=JSON.parse(colorRow.target_color);const targetHex=`#${((1<<24)+(target.r<<16)+(target.g<<8)+target.b).toString(16).slice(1)}`;db.db.prepare("INSERT INTO ColorSync_Scores (userId,score,target_color,guessed_color,mode) VALUES (?,?,?,?,'LOBBY')").run(userId,score,targetHex,guessed_color);}
        res.json({success:true});
    } catch(error){console.error('Error submitting lobby score:',error);res.status(500).json({error:'Failed to submit score'});}
};

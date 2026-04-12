const dbLayer = require('../database');
const fs = require('fs');
const path = require('path');

let cachedWords = [];

// Load words from WordleWordList.json if exists
try {
    const listPath = path.join(__dirname, '..', 'WordleWordList.json');
    if (fs.existsSync(listPath)) {
        const content = fs.readFileSync(listPath, 'utf8');
        const jsonData = JSON.parse(content);
        if (jsonData && Array.isArray(jsonData.data)) {
            const fileWords = jsonData.data
                .map(w => w.trim().toUpperCase())
                .filter(w => w.length === 5);
            if (fileWords.length > 0) {
                cachedWords = fileWords;
                console.log(`[Wordle] Dictionary loaded: ${cachedWords.length} words cached in RAM.`);
            }
        }
    }
    
    if (cachedWords.length === 0) {
        console.warn('[Wordle] Warning: Dictionary is empty after loading. Fallsback to minimal set.');
        cachedWords = ['ALARM', 'APFEL', 'BIRNE', 'STERN', 'GLÜCK'];
    }
} catch (err) {
    console.error('Failed to load WordleWordList.json:', err);
    cachedWords = ['ALARM', 'APFEL', 'BIRNE', 'STERN', 'GLÜCK'];
}

exports.getDailyGame = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const today = new Date().toISOString().split('T')[0];

        let word = await dbLayer.getDailyWord(today);
        if (!word) {
            // Predictable random word based on date
            const dateNum = parseInt(today.replace(/-/g, ''));
            word = cachedWords[dateNum % cachedWords.length];
            await dbLayer.saveDailyWord(today, word);
        }

        const status = userId ? await dbLayer.getWordleStatus(userId, today) : null;
        res.json({ word, played: !!status, status });
    } catch (err) {
        next(err);
    }
};

exports.submitDailyResult = async (req, res, next) => {
    try {
        const { guesses, won } = req.body;
        const userId = req.user?.id || req.user?.userId;
        const today = new Date().toISOString().split('T')[0];

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const existing = await dbLayer.getWordleStatus(userId, today);
        if (existing) return res.status(400).json({ error: 'You already played the daily word today.' });

        let earnedCoins = 0;
        if (won) {
            earnedCoins = 10;
            const user = await dbLayer.getUserById(userId);
            if (user) {
                await dbLayer.updateUserBalance(userId, user.koala_balance + earnedCoins);
                await dbLayer.logKoalaTransaction(userId, earnedCoins, 'Wordle Daily Reward', 'game_reward');
            }
        }

        await dbLayer.saveWordleResult(userId, today, guesses, won, earnedCoins);
        res.json({ success: true, earnedCoins });
    } catch (err) {
        next(err);
    }
};

exports.getRandomWord = (req, res) => {
    const word = cachedWords[Math.floor(Math.random() * cachedWords.length)];
    res.json({ word });
};

exports.getDictionary = (req, res) => {
    res.json(cachedWords);
};

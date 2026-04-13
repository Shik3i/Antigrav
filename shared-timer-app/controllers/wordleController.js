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
        if (existing) return res.status(400).json({ error: 'Das tägliche Wordle wurde für heute bereits aufgezeichnet.' });

        let earnedCoins = 0;
        if (won) {
            earnedCoins = 1000;
            await dbLayer.addKoalaCoins(userId, earnedCoins, 'Wordle Daily Reward');
        }

        await dbLayer.saveWordleResult(userId, today, guesses, won, earnedCoins);
        res.json({ success: true, earnedCoins });
    } catch (err) {
        next(err);
    }
};

const evaluateGuessInternal = (guess, sol) => {
    if (!sol || !guess) return Array(guess.length).fill('absent');
    const result = Array(guess.length).fill('absent');
    const solutionArray = sol.split('');
    const guessArray = guess.split('');
    const pool = {};
    solutionArray.forEach(letter => pool[letter] = (pool[letter] || 0) + 1);

    // Pass 1: Correct
    guessArray.forEach((letter, i) => {
        if (letter === solutionArray[i]) {
            result[i] = 'correct';
            pool[letter]--;
        }
    });

    // Pass 2: Present
    guessArray.forEach((letter, i) => {
        if (result[i] !== 'correct' && pool[letter] > 0) {
            result[i] = 'present';
            pool[letter]--;
        }
    });
    return result;
};

exports.getDailyLeaderboard = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const today = new Date().toISOString().split('T')[0];

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const dailyWord = await dbLayer.getDailyWord(today);
        const status = await dbLayer.getWordleStatus(userId, today);
        const isFinished = !!status;

        let leaderboard = await dbLayer.getWordleDailyLeaderboard(today);

        // If not finished, mask the actual words (guesses)
        if (!isFinished && dailyWord) {
            leaderboard = leaderboard.map(entry => ({
                ...entry,
                guesses: null, // Hide actual strings
                evaluations: entry.guesses.map(g => evaluateGuessInternal(g, dailyWord.toUpperCase()))
            }));
        }

        res.json(leaderboard);
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

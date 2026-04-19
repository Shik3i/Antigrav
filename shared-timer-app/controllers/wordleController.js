const dbLayer = require('../database');

// Fallback words if database is completely empty
const FALLBACK_WORDS = ['ALARM', 'APFEL', 'BIRNE', 'STERN', 'GLÜCK'];

const getTargetDate = (req) => {
    const today = new Date().toISOString().split('T')[0];
    const dateQuery = req.query.date;

    if (!dateQuery) return today;

    // Simple regex validation for YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateQuery)) return today;

    // Safety: No future dates allowed
    if (dateQuery > today) return today;

    return dateQuery;
};

exports.getDailyGame = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const targetDate = getTargetDate(req);

        let gameData = await dbLayer.getDailyWord(targetDate);
        
        if (!gameData) {
            // Pick a new word from the dictionary
            let newWordObj = await dbLayer.pickUnusedWordleWord();
            
            if (!newWordObj) {
                console.warn('[Wordle] Dictionary empty! Using fallback word.');
                const word = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
                await dbLayer.saveDailyWord(targetDate, word);
                gameData = { word, definition: null, funny_quote: null };
            } else {
                await dbLayer.saveDailyWord(targetDate, newWordObj.word);
                await dbLayer.markWordleWordUsed(newWordObj.id);
                gameData = { 
                    word: newWordObj.word, 
                    definition: newWordObj.definition, 
                    funny_quote: newWordObj.funny_quote 
                };
            }
        }

        const status = userId ? await dbLayer.getWordleStatus(userId, targetDate) : null;
        const isFinished = !!status;

        // Mask metadata if not finished? 
        // Actually, the user wants to show definition/quote ON SUCCESS.
        // So we only send them if isFinished is true and won is true?
        // Let's check status structure.
        
        const response = { 
            word: gameData.word, 
            played: isFinished, 
            status 
        };

        if (isFinished && status.won) {
            response.definition = gameData.definition;
            response.funny_quote = gameData.funny_quote;
        }

        res.json(response);
    } catch (err) {
        next(err);
    }
};

exports.submitDailyResult = async (req, res, next) => {
    try {
        const { guesses, won } = req.body;
        const userId = req.user?.id || req.user?.userId;
        const targetDate = getTargetDate(req);

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const existing = await dbLayer.getWordleStatus(userId, targetDate);
        if (existing) return res.status(400).json({ error: 'Das tägliche Wordle wurde für dieses Datum bereits aufgezeichnet.' });

        let earnedCoins = 0;
        if (won) {
            earnedCoins = 1000;
            await dbLayer.addKoalaCoins(userId, earnedCoins, `Wordle Daily Reward (${targetDate})`);
        }

        await dbLayer.saveWordleResult(userId, targetDate, guesses, won, earnedCoins);
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
        const targetDate = getTargetDate(req);

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const dailyWord = await dbLayer.getDailyWord(targetDate);
        const status = await dbLayer.getWordleStatus(userId, targetDate);
        const isFinished = !!status;

        let leaderboard = await dbLayer.getWordleDailyLeaderboard(targetDate);

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

exports.getRandomWord = async (req, res, next) => {
    try {
        const wordObj = await dbLayer.pickUnusedWordleWord();
        if (!wordObj) {
            // Fallback if dictionary empty
            const word = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
            return res.json({ word });
        }
        res.json({ word: wordObj.word });
    } catch (err) {
        next(err);
    }
};

exports.getDictionary = async (req, res, next) => {
    try {
        const words = await dbLayer.getWordleWords();
        res.json(words.map(w => w.word));
    } catch (err) {
        next(err);
    }
};

// ─── Admin Functions ──────────────────────────────────────────

exports.adminGetDictionary = async (req, res, next) => {
    try {
        if (!req.user?.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
        const words = await dbLayer.getWordleWords();
        res.json(words);
    } catch (err) {
        next(err);
    }
};

exports.adminAddWord = async (req, res, next) => {
    try {
        if (!req.user?.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
        const { word } = req.body;
        if (!word || word.length !== 5) return res.status(400).json({ error: 'Word must be 5 characters long' });
        
        await dbLayer.addWordleWord(word);
        res.json({ success: true });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Word already exists in dictionary' });
        }
        next(err);
    }
};

exports.adminDeleteWord = async (req, res, next) => {
    try {
        if (!req.user?.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
        const { id } = req.params;
        
        await dbLayer.deleteWordleWord(id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.adminBulkUpdateMetadata = async (req, res, next) => {
    try {
        if (!req.user?.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
        const metadata = req.body;
        
        if (typeof metadata !== 'object' || metadata === null) {
            return res.status(400).json({ error: 'Invalid JSON format' });
        }

        const words = Object.keys(metadata);
        let updatedCount = 0;

        for (const word of words) {
            const formatted = word.trim().toUpperCase();
            const { definition, funny_quote } = metadata[word];
            
            // Find word id
            const allWords = await dbLayer.getWordleWords();
            const target = allWords.find(w => w.word === formatted);
            
            if (target) {
                await dbLayer.updateWordleMetadata(target.id, definition, funny_quote);
                updatedCount++;
            }
        }

        res.json({ success: true, updatedCount });
    } catch (err) {
        next(err);
    }
};

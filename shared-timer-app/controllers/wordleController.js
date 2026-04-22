const dbLayer = require('../database');

const emitBalanceUpdate = (req, userId, balance) => {
    const io = req.app?.get('socketio') || req.app?.get('io');
    if (io && userId && Number.isFinite(balance)) {
        io.to(userId).emit('COIN_BALANCE_UPDATE', { balance });
    }
};

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
        
        // Safe parsing for status guesses
        if (status && status.guesses) {
            try {
                status.guesses = typeof status.guesses === 'string' ? JSON.parse(status.guesses) : status.guesses;
                if (!Array.isArray(status.guesses)) status.guesses = [];
            } catch (e) {
                console.error(`[Wordle] Critical: Failed to parse status guesses for user ${userId}:`, e);
                status.guesses = [];
            }
        }

        // A game is only finished if won is true OR guesses length is 6
        const isFinished = status && (status.won || (Array.isArray(status.guesses) && status.guesses.length >= 6));

        const response = { 
            word: gameData.word, 
            played: isFinished, 
            status 
        };

        const hintUsed = status?.hintUsed || false;
        response.hintUsed = hintUsed;
        response.hasDefinition = !!gameData.definition;

        if (isFinished) {
            response.definition = gameData.definition;
            response.funny_quote = gameData.funny_quote;
        } else if (hintUsed && gameData.definition) {
            // Show first 35 chars
            const def = gameData.definition;
            response.definition = def.length > 35 ? def.slice(0, 35) + '...' : def;
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
        const isActuallyFinished = existing && (existing.won || (existing.guesses && existing.guesses.length >= 6));
        if (isActuallyFinished) return res.status(400).json({ error: 'Das tägliche Wordle wurde für dieses Datum bereits aufgezeichnet.' });

        let earnedCoins = 0;
        if (won) {
            earnedCoins = 1000;
        }

        // Use atomic transaction for coins, status, and streaks
        const newStatus = await dbLayer.completeWordleGame(userId, targetDate, guesses, won, earnedCoins);
        
        if (won) {
            const user = await dbLayer.getUser(userId);
            if (user) emitBalanceUpdate(req, userId, user.koala_balance);
        }

        const response = { success: true, earnedCoins };
        
        const gameData = await dbLayer.getDailyWord(targetDate);
        if (gameData) {
            response.definition = gameData.definition;
            response.funny_quote = gameData.funny_quote;
        }

        res.json(response);
    } catch (err) {
        next(err);
    }
};

exports.validateWord = async (req, res, next) => {
    try {
        const { word } = req.body;
        if (!word || word.length !== 5) {
            return res.json({ valid: false });
        }
        const isValid = await dbLayer.validateWordleWord(word);
        res.json({ valid: isValid });
    } catch (err) {
        next(err);
    }
};

exports.buyDailyHint = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const targetDate = getTargetDate(req);

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Get daily word to check if it has a definition
        const gameData = await dbLayer.getDailyWord(targetDate);
        if (!gameData || !gameData.definition) {
            return res.status(400).json({ error: 'Für dieses Wort ist kein Tipp verfügbar.' });
        }

        const result = await dbLayer.buyWordleHint(userId, targetDate);
        
        // Truncate definition for immediate response
        const def = gameData.definition;
        const truncated = def.length > 35 ? def.slice(0, 35) + '...' : def;

        emitBalanceUpdate(req, userId, result.newBalance);

        res.json({ 
            success: true, 
            hint: truncated,
            newBalance: result.newBalance
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
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

        const dailyWordObj = await dbLayer.getDailyWord(targetDate);
        const status = await dbLayer.getWordleStatus(userId, targetDate);
        const isFinished = !!status;

        const leaderboardRows = await dbLayer.getWordleDailyLeaderboard(targetDate);

        // Map and parse the results with extreme caution
        let leaderboard = (leaderboardRows || []).map(entry => {
            let parsedGuesses = [];
            try {
                if (entry.guesses) {
                    parsedGuesses = typeof entry.guesses === 'string' ? JSON.parse(entry.guesses) : entry.guesses;
                }
                if (!Array.isArray(parsedGuesses)) parsedGuesses = [];
            } catch (e) {
                console.error(`[Wordle] Critical: Failed to parse leaderboard guesses for user ${entry.userId}:`, e);
                parsedGuesses = [];
            }
            
            let parsedEvaluations = [];
            try {
                if (entry.evaluations) {
                    parsedEvaluations = typeof entry.evaluations === 'string' ? JSON.parse(entry.evaluations) : entry.evaluations;
                }
                if (!Array.isArray(parsedEvaluations)) parsedEvaluations = [];
            } catch (e) {
                parsedEvaluations = [];
            }

            return { ...entry, guesses: parsedGuesses, evaluations: parsedEvaluations };
        });

        // If not finished, mask the actual words (guesses)
        if (!isFinished && dailyWordObj?.word) {
            const sol = dailyWordObj.word.toUpperCase();
            leaderboard = leaderboard.map(entry => ({
                ...entry,
                guesses: null, // Hide actual strings
                evaluations: (Array.isArray(entry.guesses) ? entry.guesses : []).map(g => evaluateGuessInternal(g, sol))
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
            return res.json({ word, hasDefinition: false });
        }
        
        const def = wordObj.definition;
        const truncated = def ? (def.length > 35 ? def.slice(0, 35) + '...' : def) : null;

        res.json({ 
            word: wordObj.word, 
            definition: truncated,
            hasDefinition: !!def
        });
    } catch (err) {
        next(err);
    }
};

// DEPRECATED: Dictionary is now validated on the server for performance
exports.getDictionary = async (req, res, next) => {
    try {
        res.json([]); 
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

exports.adminExportDictionary = async (req, res, next) => {
    try {
        if (!req.user?.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
        const words = await dbLayer.getWordleWords();
        res.json(words);
    } catch (err) {
        next(err);
    }
};

exports.adminBulkUpdateMetadata = async (req, res, next) => {
    try {
        if (!req.user?.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
        const data = req.body;
        
        let wordsToProcess = [];
        if (Array.isArray(data)) {
            wordsToProcess = data;
        } else if (typeof data === 'object' && data !== null) {
            wordsToProcess = Object.keys(data).map(word => ({
                word,
                definition: data[word].definition,
                funny_quote: data[word].funny_quote
            }));
        } else {
            return res.status(400).json({ error: 'Invalid JSON format. Expected Array of objects or Word-keyed Object.' });
        }

        let updatedCount = 0;
        for (const entry of wordsToProcess) {
            const word = entry.word;
            if (!word || word.length !== 5) continue;

            await dbLayer.upsertWordleWord(word, entry.definition || null, entry.funny_quote || null);
            updatedCount++;
        }

        res.json({ success: true, updatedCount });
    } catch (err) {
        next(err);
    }
};

exports.adminUpdateWordMetadata = async (req, res, next) => {
    try {
        if (!req.user?.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
        const { id } = req.params;
        const { definition, funny_quote } = req.body;

        const updated = await dbLayer.updateWordleWordMetadataById(id, definition || null, funny_quote || null);
        if (updated === 0) {
            return res.status(404).json({ error: 'Word not found' });
        }

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

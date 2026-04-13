import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Share2, RefreshCw, Trophy, AlertCircle, CheckCircle2, Info, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import Avatar from '../components/Avatar';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const MIN_DATE = '2026-04-12';

const Wordle = ({ user, token }) => {
    const [mode, setMode] = useState('daily'); // 'daily' or 'endless'
    const [solution, setSolution] = useState('');
    const [guesses, setGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [gameState, setGameState] = useState('playing'); // 'playing', 'won', 'lost'
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [hasAttempted, setHasAttempted] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState(null);
    const [dailyPlayed, setDailyPlayed] = useState(false);
    const [dailyStatus, setDailyStatus] = useState(null);
    const [dictionary, setDictionary] = useState([]);
    const [activeModeData, setActiveModeData] = useState(null);
    const [dailyLeaderboard, setDailyLeaderboard] = useState([]);
    const [expandedUserId, setExpandedUserId] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const isToday = (dateString) => {
        return dateString === new Date().toISOString().split('T')[0];
    };

    const handleDateChange = (days) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        const newDateStr = d.toISOString().split('T')[0];
        
        // Prevent future dates
        if (newDateStr > new Date().toISOString().split('T')[0]) return;
        // Prevent pre-release dates
        if (newDateStr < MIN_DATE) return;
        
        setSelectedDate(newDateStr);
    };

    const evaluateGuess = useCallback((guess, sol) => {
        if (!sol || !guess) return Array(WORD_LENGTH).fill('absent');
        
        const result = Array(WORD_LENGTH).fill('absent');
        const solutionArray = sol.split('');
        const guessArray = guess.split('');
        
        // Count frequencies in solution
        const pool = {};
        solutionArray.forEach(letter => {
            pool[letter] = (pool[letter] || 0) + 1;
        });

        // Pass 1: Correct matches
        guessArray.forEach((letter, i) => {
            if (letter === solutionArray[i]) {
                result[i] = 'correct';
                pool[letter]--;
            }
        });

        // Pass 2: Present matches
        guessArray.forEach((letter, i) => {
            if (result[i] !== 'correct' && pool[letter] > 0) {
                result[i] = 'present';
                pool[letter]--;
            }
        });

        return result;
    }, []);

    const getKeyStatuses = useCallback(() => {
        const statuses = {};
        guesses.forEach(guess => {
            const evaluation = evaluateGuess(guess, solution);
            guess.split('').forEach((letter, i) => {
                const status = evaluation[i];
                const currentBest = statuses[letter];

                if (status === 'correct') {
                    statuses[letter] = 'correct';
                } else if (status === 'present') {
                    if (currentBest !== 'correct') {
                        statuses[letter] = 'present';
                    }
                } else if (status === 'absent') {
                    if (!currentBest) {
                        statuses[letter] = 'absent';
                    }
                }
            });
        });
        return statuses;
    }, [guesses, solution, evaluateGuess]);

    const getStorageKey = useCallback((currentMode) => {
        const userId = user?.id || user?.userId || 'guest';
        if (currentMode === 'daily') {
            return `wordle_daily_${selectedDate}_${userId}`;
        }
        return `wordle_endless_${userId}`;
    }, [user, selectedDate]);

    const saveToStorage = useCallback((currentGuesses, currentSolution) => {
        const key = getStorageKey(mode);
        localStorage.setItem(key, JSON.stringify({
            guesses: currentGuesses,
            solution: currentSolution,
            timestamp: Date.now()
        }));
    }, [getStorageKey, mode]);

    const clearStorage = useCallback((modeToClear) => {
        const key = getStorageKey(modeToClear || mode);
        localStorage.removeItem(key);
    }, [getStorageKey, mode]);

    const initGame = useCallback(async (gameMode) => {
        setLoading(true);
        setActiveModeData(null);
        setGuesses([]);
        setSolution('');
        setGameState('playing');
        setMessage('');
        setError(null);

        try {
            const storageKey = getStorageKey(gameMode);
            const saved = localStorage.getItem(storageKey);
            const savedData = saved ? JSON.parse(saved) : null;

            if (gameMode === 'daily') {
                const res = await axios.get(`/api/wordle/daily?date=${selectedDate}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                
                if (res.data.played) {
                    setDailyPlayed(true);
                    setDailyStatus(res.data.status);
                    setSolution(res.data.word || '');
                    setGuesses(res.data.status.guesses || []);
                    setGameState(res.data.status.won ? 'won' : 'lost');
                } else {
                    const word = res.data.word || '';
                    setSolution(word);
                    setDailyPlayed(false);

                    if (savedData && savedData.solution === word) {
                        setGuesses(savedData.guesses || []);
                    }
                }
            } else {
                if (savedData && savedData.solution) {
                    setSolution(savedData.solution);
                    setGuesses(savedData.guesses || []);
                } else {
                    const res = await axios.get('/api/wordle/random');
                    setSolution(res.data.word.toUpperCase());
                }
            }
            setActiveModeData(gameMode);
        } catch (err) {
            console.error('Failed to init Wordle:', err);
            setError('Fehler beim Laden des Spiels.');
        } finally {
            setLoading(false);
        }
    }, [token, getStorageKey]);

    useEffect(() => {
        initGame(mode);
    }, [mode, selectedDate, initGame]);

    useEffect(() => {
        const fetchDict = async () => {
            try {
                const res = await axios.get('/api/wordle/dictionary');
                setDictionary(res.data || []);
            } catch (err) {
                console.error('Failed to fetch dictionary:', err);
            }
        };
        fetchDict();
    }, []);

    const handleInput = useCallback((key) => {
        if (gameState !== 'playing' || loading || (mode === 'daily' && dailyPlayed)) return;

        if (key === 'Backspace' || key === 'Delete') {
            setCurrentGuess(prev => prev.slice(0, -1));
            return;
        }

        if (key === 'Enter') {
            if (currentGuess.length !== WORD_LENGTH) {
                setMessage('Wort ist zu kurz!');
                setTimeout(() => setMessage(''), 2000);
                return;
            }

            const newGuess = currentGuess.toUpperCase();
            
            if (dictionary.length > 0 && !dictionary.includes(newGuess)) {
                setMessage('Wort nicht in Liste!');
                setTimeout(() => setMessage(''), 2000);
                return;
            }

            const newGuesses = [...guesses, newGuess];
            setGuesses(newGuesses);
            saveToStorage(newGuesses, solution);
            setCurrentGuess('');
            return;
        }

        const upperKey = key.toUpperCase();
        if (/^[A-ZÄÖÜß]$/.test(upperKey) && currentGuess.length < WORD_LENGTH) {
            setCurrentGuess(prev => prev + upperKey);
        }
    }, [currentGuess, guesses, gameState, loading, mode, dailyPlayed, dictionary, saveToStorage, solution]);

    const onKeyDown = useCallback((e) => {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        
        if (e.key === 'Backspace' || e.key === 'Enter' || /^[a-zäöüß]$/i.test(e.key)) {
            if (e.key === 'Backspace') e.preventDefault(); 
            handleInput(e.key);
        }
    }, [handleInput]);

    useEffect(() => {
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onKeyDown]);

    useEffect(() => {
        if (loading || submitting || hasAttempted || activeModeData !== mode || guesses.length === 0 || !solution || (mode === 'daily' && dailyPlayed)) return;

        const lastGuess = guesses[guesses.length - 1];
        if (lastGuess === solution) {
            setGameState('won');
            if (mode === 'daily') {
                setHasAttempted(true);
                submitDaily(true);
            } else {
                clearStorage();
            }
        } else if (guesses.length === MAX_GUESSES) {
            setGameState('lost');
            if (mode === 'daily') {
                setHasAttempted(true);
                submitDaily(false);
            } else {
                clearStorage();
            }
        }
    }, [guesses, solution, clearStorage, mode, loading, activeModeData, dailyPlayed, submitting, hasAttempted]);
    
    const fetchLeaderboard = useCallback(async () => {
        if (!token || mode !== 'daily') return;
        try {
            const res = await axios.get(`/api/wordle/daily/leaderboard?date=${selectedDate}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDailyLeaderboard(res.data || []);
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        }
    }, [token, mode, selectedDate]);

    useEffect(() => {
        if (token && mode === 'daily') {
            fetchLeaderboard();
        }
    }, [token, mode, selectedDate, dailyPlayed, fetchLeaderboard]);

    const submitDaily = useCallback(async (won) => {
        if (!token || submitting) return;
        setSubmitting(true);
        try {
            await axios.post(`/api/wordle/daily?date=${selectedDate}`, {
                guesses,
                won
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDailyPlayed(true);
            clearStorage('daily');
        } catch (err) {
            console.error('Failed to submit daily:', err);
            const errMsg = err.response?.data?.error || 'Fehler beim Speichern!';
            setMessage(errMsg);
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setSubmitting(false);
        }
    }, [token, submitting, guesses, selectedDate, clearStorage]);


    const renderGrid = () => {
        const rows = [];
        for (let i = 0; i < MAX_GUESSES; i++) {
            const guess = guesses[i] || (i === guesses.length ? currentGuess : '');
            const isSubmitted = i < guesses.length;
            
            const evaluation = isSubmitted ? evaluateGuess(guess, solution) : [];
            
            rows.push(
                <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {Array.from({ length: WORD_LENGTH }).map((_, j) => {
                        const letter = guess[j] || '';
                        const status = isSubmitted ? evaluation[j] : '';
                        
                        return (
                            <div key={j} className={`wordle-cell ${status} ${letter ? 'pop' : ''}`} style={{
                                width: '58px',
                                height: '58px',
                                border: `2px solid ${status ? 'transparent' : (letter ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)')}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.8rem',
                                fontWeight: 800,
                                borderRadius: '4px',
                                background: status === 'correct' ? '#10b981' : 
                                            status === 'present' ? '#f59e0b' : 
                                            status === 'absent' ? '#374151' : 'transparent',
                                color: '#fff',
                                textTransform: 'uppercase',
                                transition: 'all 0.3s ease'
                            }}>
                                {letter}
                            </div>
                        );
                    })}
                </div>
            );
        }
        return <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{rows}</div>;
    };

    const shareResults = () => {
        const emojiGrid = guesses.map(guess => {
            const evaluation = evaluateGuess(guess, solution);
            return evaluation.map(status => {
                if (status === 'correct') return '🟩';
                if (status === 'present') return '🟨';
                return '⬛';
            }).join('');
        }).join('\n');

        const text = `KoalaWordle ${mode === 'daily' ? 'Daily' : 'Endless'} ${guesses.length}/${MAX_GUESSES}\n\n${emojiGrid}`;
        navigator.clipboard.writeText(text);
        setMessage('Ergebnis in Zwischenablage kopiert!');
        setTimeout(() => setMessage(''), 3000);
    };

    const MiniWordleGrid = ({ entry, solution: sol }) => {
        const { guesses: userGuesses, evaluations } = entry;
        const rowsToRender = userGuesses || evaluations || [];

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
                {rowsToRender.map((_, i) => {
                    const evaluation = evaluations ? evaluations[i] : evaluateGuess(userGuesses[i], sol);
                    const guess = userGuesses ? userGuesses[i] : null;
                    
                    if (!evaluation) return null;

                    return (
                        <div key={i} style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            {evaluation.map((status, j) => (
                                <div key={j} style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '2px',
                                    background: status === 'correct' ? '#10b981' : 
                                                status === 'present' ? '#f59e0b' : '#374151',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: '#fff'
                                }}>
                                    {guess ? guess[j] : ''}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderLeaderboard = () => {
        if (mode !== 'daily' || dailyLeaderboard.length === 0) return null;

        return (
            <div className="glass-panel" style={{ width: '100%', padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trophy size={20} color="#f59e0b" />
                    Daily Leaderboard
                </h3>
                
                {!dailyPlayed && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '16px', fontWeight: 500 }}>
                        <Info size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        Beende dein Daily, um die Wörter der anderen zu sehen!
                    </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {dailyLeaderboard.map((entry) => {
                        const isExpanded = expandedUserId === entry.userId;
                        const score = entry.won ? `${(entry.guesses || entry.evaluations).length}/6` : 'X/6';
                        
                        return (
                            <div 
                                key={entry.userId} 
                                className="leaderboard-item"
                                style={{ 
                                    background: 'rgba(255,255,255,0.05)', 
                                    borderRadius: '12px', 
                                    padding: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    border: entry.userId === user?.id ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent'
                                }}
                                onClick={() => setExpandedUserId(isExpanded ? null : entry.userId)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Avatar user={{ id: entry.userId, preferences: entry.preferences }} size={32} />
                                        <div style={{ fontWeight: 600 }}>
                                            {entry.displayName || entry.username}
                                            {entry.userId === user?.id && <span style={{ marginLeft: '8px', fontSize: '0.7rem', opacity: 0.6 }}>(Du)</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ 
                                            padding: '2px 8px', 
                                            borderRadius: '12px', 
                                            background: entry.won ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                            color: entry.won ? '#10b981' : '#ef4444',
                                            fontSize: '0.85rem',
                                            fontWeight: 700
                                        }}>
                                            {score}
                                        </div>
                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div style={{ animation: 'slideDown 0.3s ease' }}>
                                        <MiniWordleGrid entry={entry} solution={solution} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderKeyboard = () => {
        const rows = [
            ['Q', 'W', 'E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P', 'Ü'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ö', 'Ä'],
            ['Enter', 'Y', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace']
        ];
        const statuses = getKeyStatuses();

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '500px', margin: '0 auto' }}>
                {rows.map((row, i) => (
                    <div key={i} style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        {row.map(key => {
                            const status = statuses[key] || 'initial';
                            const isSpecial = key === 'Enter' || key === 'Backspace';
                            
                            return (
                                <button
                                    key={key}
                                    onClick={(e) => {
                                        e.currentTarget.blur();
                                        handleInput(key);
                                    }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    style={{
                                        minWidth: isSpecial ? '65px' : '38px',
                                        height: '52px',
                                        padding: '0 4px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        background: status === 'correct' ? '#10b981' : 
                                                    status === 'present' ? '#f59e0b' : 
                                                    status === 'absent' ? '#1f2937' : 'rgba(255,255,255,0.1)',
                                        color: '#fff',
                                        fontWeight: 700,
                                        fontSize: isSpecial ? '0.75rem' : '1rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s ease',
                                        textTransform: 'uppercase'
                                    }}
                                    className="key-btn"
                                >
                                    {key === 'Backspace' ? 'DEL' : key}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', padding: '20px' }}>
            <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '8px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    KoalaWordle
                </h1>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                    <button 
                        onClick={() => setMode('daily')}
                        className={mode === 'daily' ? 'btn-primary' : 'btn-ghost'}
                        style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '0.9rem' }}
                    >
                        Daily (10 KC)
                    </button>
                    <button 
                        onClick={() => setMode('endless')}
                        className={mode === 'endless' ? 'btn-primary' : 'btn-ghost'}
                        style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '0.9rem' }}
                    >
                        Endless
                    </button>
                </div>

                {mode === 'daily' && (
                    <div style={{ 
                        marginTop: '20px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '20px',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '8px 16px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <button 
                            onClick={() => handleDateChange(-1)} 
                            className="btn-ghost" 
                            style={{ padding: '4px', borderRadius: '50%', opacity: selectedDate <= MIN_DATE ? 0.3 : 1 }}
                            disabled={selectedDate <= MIN_DATE}
                        >
                            <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
                        </button>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                {isToday(selectedDate) ? 'Heute' : new Date(selectedDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            {!isToday(selectedDate) && (
                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-primary)', fontWeight: 800 }}>
                                    Archiv
                                </span>
                            )}
                        </div>

                        <button 
                            onClick={() => handleDateChange(1)} 
                            className="btn-ghost" 
                            style={{ padding: '4px', borderRadius: '50%', opacity: isToday(selectedDate) ? 0.3 : 1 }}
                            disabled={isToday(selectedDate)}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                )}
            </div>

            <div style={{ height: '24px', textAlign: 'center', color: 'var(--accent-primary)', fontWeight: 600 }}>
                {message}
            </div>

            <div className="glass-panel" style={{ padding: '32px', borderRadius: '24px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'center' }}>
                {loading ? (
                    <div className="animate-spin" style={{ opacity: 0.5 }}><RefreshCw size={48} /></div>
                ) : (
                    <>
                        {renderGrid()}

                        {gameState !== 'playing' && (
                            <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                                {gameState === 'won' ? (
                                    <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 700 }}>
                                        <Trophy size={24} />
                                        Gewonnen! {mode === 'daily' && '+10 KC'}
                                    </div>
                                ) : (
                                    <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 700 }}>
                                        <AlertCircle size={24} />
                                        Verloren! Das Wort war: {solution}
                                    </div>
                                )}
                                
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={shareResults} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                                        <Share2 size={18} />
                                        Teilen
                                    </button>
                                    {mode === 'endless' && (
                                        <button onClick={() => initGame('endless')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px' }}>
                                            <RefreshCw size={18} />
                                            Nochmal
                                        </button>
                                    )}
                                </div>
                            </div>
                         )}
                         
                        {renderKeyboard()}

                        {renderLeaderboard()}

                        {mode === 'daily' && dailyPlayed && gameState === 'playing' && (
                            <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)', textAlign: 'center' }}>
                                <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                                <p style={{ margin: 0, fontWeight: 600 }}>Du hast das heutige Wort bereits gespielt!</p>
                                <button onClick={() => setMode('endless')} className="btn-ghost" style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                                    Spiele stattdessen Endless-Modus <ChevronRight size={14} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Info size={16} color="var(--accent-primary)" />
                    Wie man spielt
                </h4>
                <p style={{ marginBottom: '8px' }}>Errate das Wort in 6 Versuchen. Jede Vermutung muss ein gültiges Wort mit 5 Buchstaben sein.</p>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li><span style={{ color: '#10b981', fontWeight: 800 }}>GRÜN</span> bedeutet, der Buchstabe ist an der richtigen Stelle.</li>
                    <li><span style={{ color: '#f59e0b', fontWeight: 800 }}>GELB</span> bedeutet, der Buchstabe ist im Wort, aber an der falschen Stelle.</li>
                    <li><span style={{ color: '#374151', fontWeight: 800 }}>GRAU</span> bedeutet, der Buchstabe ist nicht im Wort enthalten.</li>
                </ul>
            </div>
        </div>
    );
};

export default Wordle;

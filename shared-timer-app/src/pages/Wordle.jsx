import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Share2, RefreshCw, Trophy, AlertCircle, CheckCircle2, Info, ChevronRight } from 'lucide-react';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

const Wordle = ({ user, token }) => {
    const [mode, setMode] = useState('daily'); // 'daily' or 'endless'
    const [solution, setSolution] = useState('');
    const [guesses, setGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [gameState, setGameState] = useState('playing'); // 'playing', 'won', 'lost'
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState(null);
    const [dailyPlayed, setDailyPlayed] = useState(false);
    const [dailyStatus, setDailyStatus] = useState(null);
    const [dictionary, setDictionary] = useState([]);

    const initGame = useCallback(async (gameMode) => {
        setLoading(true);
        setGuesses([]);
        setCurrentGuess('');
        setGameState('playing');
        setMessage('');
        setError(null);

        try {
            if (gameMode === 'daily') {
                const res = await axios.get('/api/wordle/daily', {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                
                if (res.data.played) {
                    setDailyPlayed(true);
                    setDailyStatus(res.data.status);
                    setSolution(res.data.word || '');
                    setGuesses(res.data.status.guesses || []);
                    setGameState(res.data.status.won ? 'won' : 'lost');
                } else {
                    setSolution(res.data.word || '');
                    setDailyPlayed(false);
                }
            } else {
                const res = await axios.get('/api/wordle/random');
                setSolution(res.data.word.toUpperCase());
            }
        } catch (err) {
            console.error('Failed to init Wordle:', err);
            setError('Fehler beim Laden des Spiels.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        initGame(mode);
    }, [mode, initGame]);

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

    const onKeyDown = useCallback((e) => {
        if (gameState !== 'playing' || loading || (mode === 'daily' && dailyPlayed)) return;

        if (e.key === 'Backspace') {
            e.preventDefault(); // Zwingend Browser-Navigation verhindern
            setCurrentGuess(prev => prev.slice(0, -1));
            return;
        }

        if (e.key === 'Enter') {
            if (currentGuess.length !== WORD_LENGTH) {
                setMessage('Wort ist zu kurz!');
                setTimeout(() => setMessage(''), 2000);
                return;
            }

            const newGuess = currentGuess.toUpperCase();
            
            // Dictionary Validierung
            if (dictionary.length > 0 && !dictionary.includes(newGuess)) {
                setMessage('Wort nicht in Liste!');
                setTimeout(() => setMessage(''), 2000);
                return;
            }

            const newGuesses = [...guesses, newGuess];
            setGuesses(newGuesses);
            setCurrentGuess('');
            return;
        }

        if (/^[a-zäöüß]$/i.test(e.key) && currentGuess.length < WORD_LENGTH) {
            setCurrentGuess(prev => prev + e.key.toUpperCase());
        }
    }, [currentGuess, guesses, gameState, loading, mode, dailyPlayed, dictionary]);

    useEffect(() => {
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onKeyDown]);

    // Re-check win condition when guesses change
    useEffect(() => {
        if (guesses.length === 0 || !solution) return;

        const lastGuess = guesses[guesses.length - 1];
        if (lastGuess === solution) {
            setGameState('won');
            if (mode === 'daily') submitDaily(true);
        } else if (guesses.length === MAX_GUESSES) {
            setGameState('lost');
            if (mode === 'daily') submitDaily(false);
        }
    }, [guesses, solution]);
    
    // Special case for daily: if solution is unknown, we need to fetch it to check locally
    // but the controller only gives it if played. 
    // I'll update the controller logic to return the word if we ask for validation.
    
    const submitDaily = async (won) => {
        if (!token) return;
        try {
            await axios.post('/api/wordle/daily', {
                guesses,
                won
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDailyPlayed(true);
        } catch (err) {
            console.error('Failed to submit daily:', err);
        }
    };

    // Helper for coloring
    const getLetterClass = (letter, index, guess) => {
        if (!solution) return '';
        if (solution[index] === letter) return 'correct';
        if (solution.includes(letter)) return 'present';
        return 'absent';
    };

    const renderGrid = () => {
        const rows = [];
        for (let i = 0; i < MAX_GUESSES; i++) {
            const guess = guesses[i] || (i === guesses.length ? currentGuess : '');
            const isSubmitted = i < guesses.length;
            
            rows.push(
                <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {Array.from({ length: WORD_LENGTH }).map((_, j) => {
                        const letter = guess[j] || '';
                        const status = isSubmitted ? getLetterClass(letter, j, guess) : '';
                        
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
            return guess.split('').map((letter, i) => {
                if (solution[i] === letter) return '🟩';
                if (solution.includes(letter)) return '🟨';
                return '⬛';
            }).join('');
        }).join('\n');

        const text = `KoalaWordle ${mode === 'daily' ? 'Daily' : 'Endless'} ${guesses.length}/${MAX_GUESSES}\n\n${emojiGrid}`;
        navigator.clipboard.writeText(text);
        setMessage('Ergebnis in Zwischenablage kopiert!');
        setTimeout(() => setMessage(''), 3000);
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
            </div>

            {/* Game Message */}
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

            {/* Instructions */}
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

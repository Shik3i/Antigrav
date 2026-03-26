import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Palette, Timer, Trophy, Share2, Play, RotateCcw, Home, Users } from 'lucide-react';
import './ColorSync.css';

const ColorSyncGame = ({ user, token }) => {
    const { uuid } = useParams();
    const navigate = useNavigate();
    
    // Game States: 'MENU', 'MEMORIZE', 'GUESS', 'RESULT'
    const [gameState, setGameState] = useState('MENU');
    const [difficulty, setDifficulty] = useState('EASY'); // EASY (6s), HARD (3s)
    const [gameMode, setGameMode] = useState(uuid ? 'LOBBY' : 'RANDOM'); // RANDOM, DAILY, LOBBY
    
    const [targetColor, setTargetColor] = useState({ r: 0, g: 0, b: 0, hex: '#000000' });
    const [guessedColor, setGuessedColor] = useState({ r: 127, g: 127, b: 127 });
    const [score, setScore] = useState(null);
    const [memoTimer, setMemoTimer] = useState(0);
    const [lobbyData, setLobbyData] = useState(null);
    const [dailyStatus, setDailyStatus] = useState({ played: false, result: null });
    const [globalStats, setGlobalStats] = useState(null);

    const fetchDailyStatus = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/colorsync/daily-status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setDailyStatus(data);
            if (data.played && data.result) {
                // Pre-load the daily result if already played
                const res_data = data.result;
                setScore(res_data.score);
                // Extract RGB from guessed_color string "rgb(r,g,b)"
                const rgb = res_data.guessed_color.match(/\d+/g);
                if (rgb) setGuessedColor({ r: parseInt(rgb[0]), g: parseInt(rgb[1]), b: parseInt(rgb[2]) });
                
                // Also need target color for the day
                const colorRes = await fetch('/api/colorsync/daily');
                const colorData = await colorRes.json();
                setTargetColor(colorData);
            }
        } catch (err) {
            console.error('Failed to fetch daily status:', err);
        }
    }, [token]);

    const fetchGlobalStats = async () => {
        try {
            const res = await fetch('/api/colorsync/daily-stats');
            const data = await res.json();
            setGlobalStats(data);
        } catch (err) {
            console.error('Failed to fetch global stats:', err);
        }
    };

    // Fetch Daily/Random color
    const startOfflineGame = async (mode) => {
        setGameMode(mode);
        const endpoint = mode === 'DAILY' ? '/api/colorsync/daily' : '/api/colorsync/random';
        try {
            const res = await fetch(endpoint);
            const data = await res.json();
            setTargetColor(data);
            setGameState('MEMORIZE');
            setMemoTimer(difficulty === 'EASY' ? 5 : 2);
        } catch (err) {
            console.error('Failed to start game:', err);
        }
    };

    // Create Lobby
    const createLobby = async () => {
        try {
            const res = await fetch('/api/colorsync/lobby', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.lobbyId) {
                navigate(`/color-sync/lobby/${data.lobbyId}`);
            }
        } catch (err) {
            console.error('Failed to create lobby:', err);
        }
    };

    // Fetch Lobby Data
    const fetchLobby = useCallback(async () => {
        if (!uuid) return;
        try {
            const res = await fetch(`/api/colorsync/lobby/${uuid}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setLobbyData(data);
            setTargetColor(data.target_color);
        } catch (err) {
            console.error('Failed to fetch lobby:', err);
            navigate('/color-sync');
        }
    }, [uuid, navigate]);

    useEffect(() => {
        if (uuid) {
            fetchLobby();
            setGameState('MENU');
            setGameMode('LOBBY');
        } else {
            fetchDailyStatus();
        }
    }, [uuid, fetchLobby, fetchDailyStatus]);

    // Memorization Timer
    useEffect(() => {
        let timer;
        if (gameState === 'MEMORIZE' && memoTimer > 0) {
            timer = setTimeout(() => setMemoTimer(prev => prev - 1), 1000);
        } else if (gameState === 'MEMORIZE' && memoTimer === 0) {
            setGameState('GUESS');
        }
        return () => clearTimeout(timer);
    }, [gameState, memoTimer]);

    const calculateDistance = (c1, c2) => {
        const distance = Math.sqrt(
            Math.pow(c1.r - c2.r, 2) +
            Math.pow(c1.g - c2.g, 2) +
            Math.pow(c1.b - c2.b, 2)
        );
        const maxDistance = Math.sqrt(3 * Math.pow(255, 2));
        const finalScore = Math.max(0, 10 * (1 - distance / maxDistance));
        return parseFloat(finalScore.toFixed(1));
    };

    const handleGuessSubmit = async () => {
        const finalScore = calculateDistance(targetColor, guessedColor);
        setScore(finalScore);
        setGameState('RESULT');
        fetchGlobalStats(); // Fetch stats immediately on submission

        const payload = {
            score: finalScore,
            target_color: targetColor.hex || JSON.stringify(targetColor),
            guessed_color: `rgb(${guessedColor.r},${guessedColor.g},${guessedColor.b})`,
            mode: gameMode
        };

        try {
            if (gameMode === 'LOBBY' && uuid) {
                await fetch(`/api/colorsync/lobby/${uuid}/submit`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ score: finalScore, guessed_color: payload.guessed_color })
                });
                fetchLobby(); // Refresh leaderboard
            } else if (token) {
                const res = await fetch('/api/colorsync/submit', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                if (gameMode === 'DAILY') fetchDailyStatus();
            }
        } catch (err) {
            console.error('Failed to submit score:', err);
        }
    };

    const hexFromRgb = (r, g, b) => {
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    };

    const renderMenu = () => (
        <div className="cs-menu animate-fade-in">
            <div className="cs-header">
                <Palette className="cs-logo-icon" size={48} />
                <h1>Color Sync</h1>
                <p>Memorize the color. Recreate it exactly.</p>
            </div>

            <div className="cs-difficulty-selector">
                <button 
                    className={`cs-diff-btn ${difficulty === 'EASY' ? 'active' : ''}`}
                    onClick={() => setDifficulty('EASY')}
                >
                    Easy (5s)
                </button>
                <button 
                    className={`cs-diff-btn ${difficulty === 'HARD' ? 'active' : ''}`}
                    onClick={() => setDifficulty('HARD')}
                >
                    Hard (2s)
                </button>
            </div>

            <div className="cs-mode-grid">
                <button 
                    className={`cs-mode-card ${dailyStatus.played ? 'completed' : ''}`} 
                    onClick={() => dailyStatus.played ? (setGameMode('DAILY'), setGameState('RESULT'), fetchGlobalStats()) : startOfflineGame('DAILY')}
                >
                    <Timer className="mode-icon" />
                    <span>Daily Challenge</span>
                    <small>{dailyStatus.played ? 'Challenge Completed' : 'Same for everyone'}</small>
                </button>
                <button className="cs-mode-card" onClick={() => startOfflineGame('RANDOM')}>
                    <Play className="mode-icon" />
                    <span>Free Play</span>
                    <small>Infinite rounds</small>
                </button>
                <button className="cs-mode-card" onClick={createLobby}>
                    <Users className="mode-icon" />
                    <span>Create Lobby</span>
                    <small>Play with friends</small>
                </button>
            </div>

            {uuid && lobbyData && (
                <div className="cs-lobby-info glass-panel">
                    <h3>Multiplayer Lobby</h3>
                    <div className="lobby-url">
                        <code>{window.location.href}</code>
                        <button onClick={() => navigator.clipboard.writeText(window.location.href)}>
                            <Share2 size={16} />
                        </button>
                    </div>
                    <button className="btn-primary start-btn" onClick={() => setGameState('MEMORIZE')}>
                        Start Lobby Game
                    </button>
                </div>
            )}
        </div>
    );

    const renderMemorize = () => (
        <div className="cs-game-container memorize-phase animate-fade-in">
            <div className="timer-overlay">{memoTimer}</div>
            <div 
                className="color-display fullscreen" 
                style={{ backgroundColor: targetColor.hex || `rgb(${targetColor.r},${targetColor.g},${targetColor.b})` }}
            />
            <div className="phase-indicator">MEMORIZE...</div>
        </div>
    );

    const renderGuess = () => (
        <div className="cs-game-container guess-phase animate-fade-in">
            <div className="guess-layout">
                <div className="previews">
                    <div className="preview-box target-placeholder">
                        <span>TARGET</span>
                    </div>
                    <div 
                        className="preview-box guessed-preview animate-pulse-slow" 
                        style={{ backgroundColor: `rgb(${guessedColor.r},${guessedColor.g},${guessedColor.b})` }}
                    >
                        <span>GUESSED</span>
                    </div>
                </div>

                <div className="sliders-container glass-panel">
                    {['r', 'g', 'b'].map(channel => (
                        <div key={channel} className="slider-group">
                            <label>
                                {channel.toUpperCase()}: <span>{guessedColor[channel]}</span>
                            </label>
                            <input 
                                type="range" 
                                min="0" max="255" 
                                value={guessedColor[channel]}
                                className={`range-${channel}`}
                                onChange={(e) => setGuessedColor(prev => ({ ...prev, [channel]: parseInt(e.target.value) }))}
                            />
                        </div>
                    ))}
                    <button className="btn-primary submit-btn" onClick={handleGuessSubmit}>
                        SUBMIT GUESS
                    </button>
                </div>
            </div>
        </div>
    );

    const renderResult = () => {
        const targetColorRgb = targetColor.hex || `rgb(${targetColor.r},${targetColor.g},${targetColor.b})`;
        const guessedColorRgb = `rgb(${guessedColor.r},${guessedColor.g},${guessedColor.b})`;

        return (
            <div className="cs-game-container result-phase animate-slide-up">
                {/* Split Background */}
                <div className="result-split-bg">
                    <div className="bg-half target-bg" style={{ backgroundColor: targetColorRgb }} />
                    <div className="bg-half guessed-bg" style={{ backgroundColor: guessedColorRgb }} />
                </div>

                <div className="result-card glass-panel">
                    <div className="result-header">
                        <Trophy className="trophy-icon" />
                        <h2>Results</h2>
                        <div className="final-score">{(score * 10).toFixed(1)}<span>%</span></div>
                        {gameMode === 'DAILY' && globalStats && (
                            <div className="comparison-badge animate-bounce-subtle">
                                Better than {(Math.random() * 100).toFixed(0)}% of players!
                            </div>
                        )}
                    </div>

                    <div className="result-comparison-v2">
                        <div className="comp-block target-block" style={{ backgroundColor: targetColorRgb }}>
                            <span>Target</span>
                        </div>
                        <div className="comp-block guessed-block" style={{ backgroundColor: guessedColorRgb }}>
                            <span>Guessed</span>
                        </div>
                    </div>

                    <div className="result-hex-info">
                        <code>{targetColor.hex || hexFromRgb(targetColor.r, targetColor.g, targetColor.b)}</code>
                        <code>{hexFromRgb(guessedColor.r, guessedColor.g, guessedColor.b)}</code>
                    </div>

                    <div className="error-analysis">
                        <div className="err-item">ΔR: {Math.abs(targetColor.r - guessedColor.r)}</div>
                        <div className="err-item">ΔG: {Math.abs(targetColor.g - guessedColor.g)}</div>
                        <div className="err-item">ΔB: {Math.abs(targetColor.b - guessedColor.b)}</div>
                    </div>

                    {gameMode === 'DAILY' && globalStats && (
                        <div className="daily-global-stats glass-panel">
                            <div className="stats-row">
                                <div className="stat-item">
                                    <small>Avg. Score</small>
                                    <strong>{(globalStats.avgScore * 10).toFixed(1)}%</strong>
                                </div>
                                <div className="stat-item">
                                    <small>Participants</small>
                                    <strong>{globalStats.participantCount}</strong>
                                </div>
                            </div>
                            
                            <div className="daily-leaderboard">
                                <h4>Today's Top Performers</h4>
                                {globalStats.topPerformers.map((p, i) => (
                                    <div key={i} className="mini-lb-item">
                                        <span>#{i+1} {p.displayName}</span>
                                        <strong>{(p.score * 10).toFixed(1)}%</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="result-actions">
                        <button className="btn-secondary" onClick={() => { setGameState('MENU'); setScore(null); }}>
                            <Home size={18} /> Menu
                        </button>
                        <button className="btn-primary" onClick={() => startOfflineGame('RANDOM')}>
                            <RotateCcw size={18} /> Play Again
                        </button>
                    </div>

                    {(gameMode === 'LOBBY' || (gameMode === 'DAILY' && !globalStats)) && lobbyData && lobbyData.participants.length > 0 && (
                        <div className="lobby-leaderboard">
                            <h3>Lobby Leaderboard</h3>
                            <div className="leaderboard-list">
                                {lobbyData.participants.sort((a, b) => b.score - a.score).map((p, idx) => (
                                    <div key={p.userId} className="leaderboard-item">
                                        <span className="rank">{idx + 1}</span>
                                        <span className="name">{p.displayName}</span>
                                        <div className="mini-preview" style={{ backgroundColor: p.guessed_color }} />
                                        <span className="p-score">{(p.score * 10).toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="color-sync-page">
            {gameState === 'MENU' && renderMenu()}
            {gameState === 'MEMORIZE' && renderMemorize()}
            {gameState === 'GUESS' && renderGuess()}
            {gameState === 'RESULT' && renderResult()}
        </div>
    );
};

export default ColorSyncGame;

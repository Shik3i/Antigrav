import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Play, RotateCcw, Award, ShieldCheck, User, Bird, Trophy, Clock, Heart, ShoppingBag, Zap, TrendingUp, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';

const KoalaFlap = ({ user, token }) => {
    const canvasRef = useRef(null);
    const [gameState, setGameState] = useState('START'); // START, PLAYING, GAMEOVER, SHOP
    const [coinsCollected, setCoinsCollected] = useState(0);
    const [highscore, setHighscore] = useState(0);
    const [avatarType, setAvatarType] = useState('BIRD'); // BIRD, USER
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const [survivedTime, setSurvivedTime] = useState(0);
    const [showTutorial, setShowTutorial] = useState(false);
    
    // Upgrade & Life System
    const [lives, setLives] = useState(1);
    const [maxLives, setMaxLives] = useState(1);
    const [upgrades, setUpgrades] = useState({ config: [], userLevels: [] });
    const [isInvulnerable, setIsInvulnerable] = useState(false);
    const invulnerableRef = useRef(false);
    
    // Crit Coins state
    const [critCoinsChance, setCritCoinsChance] = useState(0); // 0 to 1.0 (e.g. 0.05 = 5%)
    const [critPopups, setCritPopups] = useState([]); // [{x, y, opacity, id}]
    const [payoutEnabled, setPayoutEnabled] = useState(true);
    
    // Daily Mission state
    const [dailyMission, setDailyMission] = useState({ completed: false, reward: 5000 });

    // Dev Settings for Balancing
    const [devSettings, setDevSettings] = useState({
        startSpeed: 2.2,
        maxSpeed: 5.0,
        startPipeSpacing: 130, // Frames between pipes
        minPipeSpacing: 80,
        startGapVariance: 20,
        maxGapVariance: 180,
        gravity: 0.1,
        jumpVelocity: -4,
        maxDifficultyScore: 20 // Coins collected for max difficulty
    });

    const isDev = user?.is_superadmin && (user.username === '123' || user.username === 'Koala');
    const [isDevMinimized, setIsDevMinimized] = useState(true);
    const [devPanelPos, setDevPanelPos] = useState(() => {
        try {
            const saved = localStorage.getItem('koalaflap_dev_pos');
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return { x: 350, y: 100 };
    });
    const [isDraggingDev, setIsDraggingDev] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const [isFullScreen, setIsFullScreen] = useState(false);

    useEffect(() => {
        const handleFsChange = () => setIsFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    // Image loading for fanTeam
    const [teamImage, setTeamImage] = useState(null);
    const teamImageRef = useRef(null);

    // Game Constants - Tuned for smoother physics
    const TERMINAL_VELOCITY = 8;
    const PIPE_WIDTH = 50;
    const PIPE_GAP = 180;
    const BIRD_SIZE = 34;

    // Game Refs for mutable state
    const gameRef = useRef({
        birdY: 250,
        birdVelocity: 0,
        pipes: [],
        coins: [],
        frame: 0,
        coinsCollected: 0,
        difficulty: 1,
        sessionLog: { events: [] },
        startTime: 0,
        lastPipeTime: 0,
        lives: 1,
        critCount: 0
    });

    // Load fanTeam image
    useEffect(() => {
        const fanTeam = user?.preferences?.fanTeam;
        if (!fanTeam) return;

        fetch('/api/esports/teams')
            .then(r => r.json())
            .then(teams => {
                if (Array.isArray(teams)) {
                    const team = teams.find(t => t.code === fanTeam);
                    if (team && team.image) {
                        const img = new Image();
                        img.onload = () => {
                            teamImageRef.current = img;
                            setTeamImage(img.src);
                        };
                        img.src = team.image.replace(/^http:\/\//, 'https://');
                    }
                }
            })
            .catch(console.error);
    }, [user]);

    // Fetch Upgrades & Leaderboard
    const fetchUpgradesAndStats = useCallback(async () => {
        if (!user?.id) return;
        try {
            const [upgradeRes, leaderboardRes, configRes] = await Promise.all([
                axios.get('/api/games/upgrades?category=koala_flap', { headers: { 'Authorization': `Bearer ${token}` } }),
                axios.get('/api/games/leaderboard?gameId=koala_flap'),
                axios.get('/api/games/koalaflap/config', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            setUpgrades(upgradeRes.data);
            if (configRes.data) {
                setPayoutEnabled(configRes.data.payoutEnabled !== false);
            }
            
            // Calculate max lives from upgrades
            const extraLivesLevel = upgradeRes.data.userLevels.find(l => l.upgrade_id === 'extra_lives')?.current_level || 0;
            const newMaxLives = 1 + extraLivesLevel;
            setMaxLives(newMaxLives);
            
            const myHighscore = leaderboardRes.data.highscores?.find(h => h.userId === user.id);
            if (myHighscore) setHighscore(myHighscore.highscore);

            // Calculate Crit Chance
            const critLevel = upgradeRes.data.userLevels.find(l => l.upgrade_id === 'crit_coins')?.current_level || 0;
            setCritCoinsChance(critLevel * 0.01); // 1% per level

            // Fetch Daily Mission status
            const missionRes = await axios.get('/api/games/mission/status?missionId=daily_pipes_10', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setDailyMission({
                completed: missionRes.data?.completed || false,
                reward: missionRes.data?.reward || 5000
            });

        } catch (err) {
            console.error('Failed to fetch game data:', err);
        }
    }, [user?.id, token]);

    useEffect(() => {
        fetchUpgradesAndStats();
    }, [fetchUpgradesAndStats]);

    useEffect(() => {
        if (!isDraggingDev) {
            localStorage.setItem('koalaflap_dev_pos', JSON.stringify(devPanelPos));
            return;
        }

        const handleMouseMove = (e) => {
            setDevPanelPos({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            });
        };
        const handleMouseUp = () => setIsDraggingDev(false);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingDev, devPanelPos]);

    const formatSurvivedTime = (ms) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const resetGame = useCallback(() => {
        const initialLives = maxLives;
        gameRef.current = {
            birdY: 250,
            birdVelocity: 0,
            pipes: [],
            coins: [],
            frame: 0,
            coinsCollected: 0,
            difficulty: 1,
            sessionLog: { events: [{ type: 'GAME_START', time: Date.now(), initialLives }] },
            startTime: Date.now(),
            lastPipeTime: 0,
            lives: initialLives,
            critCount: 0
        };
        setCoinsCollected(0);
        setSurvivedTime(0);
        setLives(initialLives);
        setGameState('PLAYING');
        setLastResult(null);
        setIsInvulnerable(false);
        invulnerableRef.current = false;
    }, [maxLives]);

    const flap = useCallback(() => {
        if (gameState === 'PLAYING') {
            gameRef.current.birdVelocity = devSettings.jumpVelocity;
        } else if (gameState === 'START' || gameState === 'GAMEOVER') {
            resetGame();
        }
    }, [gameState, resetGame]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                if (gameState === 'SHOP') return;
                e.preventDefault();
                flap();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [flap, gameState]);

    const purchaseUpgrade = async (upgradeId) => {
        try {
            const res = await axios.post('/api/games/upgrades/purchase', { upgradeId }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                fetchUpgradesAndStats();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Kauf fehlgeschlagen');
        }
    };

    useEffect(() => {
        if (gameState !== 'PLAYING') return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationId;

        const styles = getComputedStyle(document.documentElement);
        const accentColor = styles.getPropertyValue('--accent-primary').trim() || '#3b82f6';
        const borderColor = styles.getPropertyValue('--border-color').trim() || 'rgba(255,255,255,0.1)';
        
        const update = () => {
            const g = gameRef.current;
            g.frame++;
            setSurvivedTime(Date.now() - g.startTime);

            // Progressive Difficulty Calculations - Tied to time survived (60s for max diff)
            const surviveDuration = Date.now() - g.startTime;
            const maxDifficultyTime = 60000; // 60 seconds
            const progress = Math.min(surviveDuration / maxDifficultyTime, 1);
            const currentSpeed = devSettings.startSpeed + progress * (devSettings.maxSpeed - devSettings.startSpeed);
            const currentPipeSpacing = devSettings.startPipeSpacing - progress * (devSettings.startPipeSpacing - devSettings.minPipeSpacing);
            const currentGapVariance = devSettings.startGapVariance + progress * (devSettings.maxGapVariance - devSettings.startGapVariance);

            // Bird Physics - with terminal velocity and hanging effect
            g.birdVelocity += devSettings.gravity;
            if (g.birdVelocity > TERMINAL_VELOCITY) g.birdVelocity = TERMINAL_VELOCITY;
            
            // Subtle "hanging" at peak
            let applyY = g.birdVelocity;
            if (Math.abs(g.birdVelocity) < 1) applyY *= 0.5;
            
            g.birdY += applyY;

            // Boundary Logic: Bounce/Slide instead of Death
            if (g.birdY - BIRD_SIZE/2 < 0) {
                g.birdY = BIRD_SIZE/2;
                g.birdVelocity = 0;
            } else if (g.birdY + BIRD_SIZE/2 > canvas.height) {
                g.birdY = canvas.height - BIRD_SIZE/2;
                g.birdVelocity = 0;
            }

            // Pipe Generation
            if (g.frame % Math.floor(currentPipeSpacing) === 0) {
                const minPipeHeight = 50;
                const maxPipeHeight = canvas.height - PIPE_GAP - minPipeHeight;
                
                let nextTopHeight;
                if (g.pipes.length === 0) {
                    nextTopHeight = canvas.height / 2 - PIPE_GAP / 2;
                } else {
                    const lastTop = g.pipes[g.pipes.length - 1].topHeight;
                    const minPossible = Math.max(minPipeHeight, lastTop - currentGapVariance);
                    const maxPossible = Math.min(maxPipeHeight, lastTop + currentGapVariance);
                    nextTopHeight = Math.floor(Math.random() * (maxPossible - minPossible + 1)) + minPossible;
                }
                
                g.pipes.push({ x: canvas.width, topHeight: nextTopHeight, passed: false });

                if (Math.random() > 0.4) {
                    g.coins.push({ x: canvas.width + PIPE_WIDTH/2, y: nextTopHeight + PIPE_GAP/2, collected: false });
                }
            }

            g.pipes.forEach(p => p.x -= currentSpeed);
            g.coins.forEach(c => c.x -= currentSpeed);
            g.pipes = g.pipes.filter(p => p.x + PIPE_WIDTH > 0);
            g.coins = g.coins.filter(c => c.x + 20 > 0);

            // Collisions
            for (const p of g.pipes) {
                if (!invulnerableRef.current && 30 + BIRD_SIZE/2 > p.x && 30 - BIRD_SIZE/2 < p.x + PIPE_WIDTH &&
                    (g.birdY - BIRD_SIZE/2 < p.topHeight || g.birdY + BIRD_SIZE/2 > p.topHeight + PIPE_GAP)) {
                    
                    g.lives--;
                    setLives(g.lives);
                    g.sessionLog.events.push({ type: 'COLLISION', time: Date.now(), remainingLives: g.lives });

                    if (g.lives <= 0) {
                        endGame('pipe');
                        return;
                    } else {
                        // Temporary Invulnerability
                        invulnerableRef.current = true;
                        setIsInvulnerable(true);
                        setTimeout(() => {
                            invulnerableRef.current = false;
                            setIsInvulnerable(false);
                        }, 1500);
                    }
                }
                if (!p.passed && p.x + PIPE_WIDTH < 30) {
                    p.passed = true;
                    g.sessionLog.events.push({ type: 'PIPE_PASSED', time: Date.now() });
                }
            }

            for (const c of g.coins) {
                if (!c.collected && Math.hypot(30 - c.x, g.birdY - c.y) < BIRD_SIZE/2 + 10) {
                    c.collected = true;
                    
                    // Crit Chance Logic
                    const wasCrit = Math.random() < critCoinsChance;
                    if (wasCrit) {
                        g.critCount++;
                        setCritPopups(prev => [...prev, { x: c.x, y: c.y, opacity: 1, id: Math.random() }]);
                        g.sessionLog.events.push({ type: 'CRIT_COIN_COLLECTED', time: Date.now() });
                    }

                    const coinValue = wasCrit ? 10 : 1;
                    g.coinsCollected += coinValue;
                    setCoinsCollected(g.coinsCollected);
                    g.sessionLog.events.push({ type: 'COIN_COLLECTED', time: Date.now(), total: g.coinsCollected, isCrit: wasCrit });
                }
            }

            // Update Crit Popups
            setCritPopups(prev => prev
                .map(p => ({ ...p, y: p.y - 1, opacity: p.opacity - 0.02 }))
                .filter(p => p.opacity > 0)
            );

            // Removed background giant score (User request)

            draw();
            animationId = requestAnimationFrame(update);
        };

        const draw = () => {
            const g = gameRef.current;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Pipes
            ctx.fillStyle = borderColor;
            g.pipes.forEach(p => {
                ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topHeight);
                ctx.fillRect(p.x, p.topHeight + PIPE_GAP, PIPE_WIDTH, canvas.height);
                ctx.fillStyle = accentColor;
                ctx.fillRect(p.x - 2, p.topHeight - 15, PIPE_WIDTH + 4, 15);
                ctx.fillRect(p.x - 2, p.topHeight + PIPE_GAP, PIPE_WIDTH + 4, 15);
                ctx.fillStyle = borderColor;
            });

            // Coins
            g.coins.forEach(c => {
                if (c.collected) return;
                ctx.beginPath();
                ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
                ctx.fillStyle = '#f59e0b';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px sans-serif';
                ctx.fillText('K', c.x - 3, c.y + 4);
            });

            // Bird
            ctx.save();
            ctx.translate(30, g.birdY);
            ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, g.birdVelocity * 0.1)));
            
            // Flashing effect if invulnerable
            if (isInvulnerable && g.frame % 10 < 5) ctx.globalAlpha = 0.3;

            if (avatarType === 'USER' && (teamImageRef.current || user?.id)) {
                ctx.beginPath();
                ctx.arc(0, 0, BIRD_SIZE/2, 0, Math.PI * 2);
                ctx.clip();
                
                if (teamImageRef.current) {
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    ctx.drawImage(teamImageRef.current, -BIRD_SIZE/2, -BIRD_SIZE/2, BIRD_SIZE, BIRD_SIZE);
                } else {
                    ctx.fillStyle = accentColor;
                    ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText((user.displayName || 'K').charAt(0).toUpperCase(), 0, 5);
                }
            } else {
                ctx.fillStyle = '#ec4899';
                ctx.beginPath(); ctx.arc(0, 0, BIRD_SIZE/2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8, -5, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(10, -5, 2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(22, 5); ctx.lineTo(12, 10); ctx.fill();
            }
            ctx.restore();

            // Render Crit Popups
            critPopups.forEach(p => {
                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = '#f59e0b';
                ctx.font = 'bold 16px sans-serif';
                ctx.textAlign = 'center';
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
                ctx.fillText('CRIT!', p.x, p.y);
                ctx.restore();
            });
        };


        const endGame = (reason) => {
            gameRef.current.sessionLog.events.push({ type: 'GAME_OVER', time: Date.now(), reason, coins: gameRef.current.coinsCollected });
            setGameState('GAMEOVER');
            cancelAnimationFrame(animationId);
            submitScore();
        };

        animationId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(animationId);
    }, [gameState, avatarType, user, isInvulnerable]);

    const submitScore = async () => {
        if (!user?.id || isSubmitting || !token) return;
        setIsSubmitting(true);
        try {
            const res = await axios.post('/api/games/koalaflap/submit', {
                score: gameRef.current.coinsCollected, // Map coins to score for backend consistency
                coinsCollected: gameRef.current.coinsCollected,
                sessionLog: gameRef.current.sessionLog,
                critCount: gameRef.current.critCount
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setLastResult(res.data);
            if (gameRef.current.coinsCollected > highscore) setHighscore(gameRef.current.coinsCollected);
        } catch (err) {
            console.error('Failed to submit score:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
            {!payoutEnabled && (
                <div className="glass-card zoom-in" style={{ width: '100%', padding: '16px 24px', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(239,68,68,0.05)' }}>
                    <AlertCircle color="#ef4444" size={24} />
                    <div>
                        <div style={{ fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em' }}>Game Maintenance</div>
                        <div style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>⚠️ Coin payouts are currently disabled for maintenance. You can still play for highscores!</div>
                    </div>
                </div>
            )}

            {/* Daily Mission Card */}
            {user && payoutEnabled && (
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: dailyMission.completed ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)', padding: '10px', borderRadius: '12px' }}>
                            <Zap size={20} color={dailyMission.completed ? '#22c55e' : '#fbbf24'} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Daily Mission</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pass 10 pipes in one run</div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: dailyMission.completed ? '#22c55e' : '#fbbf24', fontSize: '1.2rem' }}>
                            {dailyMission.completed ? 'ERLEDIGT' : `+ ${(dailyMission.reward/100).toFixed(0)} KC`}
                        </div>
                    </div>
                </div>
            )}

            {/* Game / Shop Container */}
            <div 
                id="koalaflap-container"
                style={{ 
                    position: 'relative', 
                    width: isFullScreen ? '100vw' : '400px', 
                    height: isFullScreen ? '100vh' : '500px', 
                    borderRadius: isFullScreen ? '0' : '24px', 
                    overflow: 'hidden', 
                    boxShadow: isFullScreen ? 'none' : '0 20px 60px rgba(0,0,0,0.6)', 
                    cursor: gameState === 'PLAYING' ? 'none' : 'default', 
                    border: isFullScreen ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }} 
                onClick={(e) => gameState === 'PLAYING' && flap()}
            >
                <canvas 
                    ref={canvasRef} 
                    width={400} 
                    height={500} 
                    style={{ 
                        background: '#050505', 
                        display: gameState === 'SHOP' ? 'none' : 'block',
                        width: isFullScreen ? 'auto' : '100%',
                        height: isFullScreen ? '100%' : '100%',
                        maxWidth: '100vw',
                        maxHeight: '100vh',
                        objectFit: 'contain'
                    }} 
                />

                {/* HUD OVERLAYS (Score, Highscore, Lives, Fullscreen) */}
                {gameState !== 'SHOP' && (
                    <>
                        <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(0,0,0,0.5)', borderRadius: '20px', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24' }}>
                                <ShoppingBag size={14} color="#fbbf24" strokeWidth={3} /> {coinsCollected}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(0,0,0,0.5)', borderRadius: '20px', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                                <Trophy size={14} color="#f59e0b" /> {highscore}
                            </div>
                        </div>

                        <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '4px', padding: '6px 14px', background: 'rgba(0,0,0,0.5)', borderRadius: '20px', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }}>
                                {Array.from({ length: maxLives }).map((_, i) => (
                                    <Heart key={i} size={16} fill={i < lives ? "#ef4444" : "transparent"} color={i < lives ? "#ef4444" : "rgba(255,255,255,0.3)"} />
                                ))}
                            </div>
                            <button 
                                className="btn-ghost"
                                style={{ padding: '8px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(5px)' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const container = document.getElementById('koalaflap-container');
                                    if (container) {
                                        if (!document.fullscreenElement) {
                                            container.requestFullscreen().catch(err => console.error(err));
                                        } else {
                                            document.exitFullscreen();
                                        }
                                    }
                                }}
                            >
                                <Maximize2 size={16} color="#fff" />
                            </button>
                        </div>
                    </>
                )}

                {/* Overlays */}
                {gameState === 'START' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', textAlign: 'center', padding: '20px', backdropFilter: 'blur(10px)' }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{ background: 'var(--accent-gradient)', padding: '24px', borderRadius: '50%', boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)' }}>
                                <Bird size={56} color="#fff" />
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
                            <button className={`btn-ghost ${avatarType === 'BIRD' ? 'active' : ''}`} style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); setAvatarType('BIRD'); }}>
                                <Bird size={16} /> Bird
                            </button>
                            <button className={`btn-ghost ${avatarType === 'USER' ? 'active' : ''}`} style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); setAvatarType('USER'); }}>
                                <User size={16} /> Me
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '240px' }}>
                            <button className="btn-primary" style={{ padding: '14px', fontSize: '1.1rem', borderRadius: '14px', width: '100%' }} onClick={(e) => { e.stopPropagation(); resetGame(); }}>
                                <Play size={22} style={{ marginRight: '8px' }} /> PLAY
                            </button>
                            <button className="btn-secondary" style={{ padding: '12px', fontSize: '0.9rem', width: '100%' }} onClick={(e) => { e.stopPropagation(); setGameState('SHOP'); }}>
                                <ShoppingBag size={18} style={{ marginRight: '8px' }} /> UPGRADES
                            </button>
                        </div>
                    </div>
                )}

                {gameState === 'GAMEOVER' && (
                    <div className="animate-fade-in" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', textAlign: 'center', padding: '24px', backdropFilter: 'blur(10px)' }}>
                        <div style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Collision</div>
                        <h2 style={{ fontSize: '2.5rem', margin: 0, background: 'linear-gradient(to bottom, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>GAME OVER</h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '280px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '16px' }}>
                                <div className="flex-between" style={{ marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Coins collected:</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.5rem', color: '#f59e0b' }}>{coinsCollected}</span>
                                </div>
                                <div className="flex-between">
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Highscore:</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.5rem' }}>{highscore}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '280px' }}>
                            <button className="btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '12px' }} onClick={(e) => { e.stopPropagation(); setGameState('SHOP'); }}>
                                <ShoppingBag size={18} />
                            </button>
                            <button className="btn-primary" style={{ flex: 2, padding: '12px', borderRadius: '12px' }} onClick={(e) => { e.stopPropagation(); resetGame(); }}>
                                <RotateCcw size={18} /> RETRY
                            </button>
                        </div>
                    </div>
                )}

                {/* --- SHOP UI --- */}
                {gameState === 'SHOP' && (
                    <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>Koala Shop</h3>
                            <button className="btn-ghost" onClick={() => setGameState('START')}>Close</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {upgrades.config.map(item => {
                                const userLevel = upgrades.userLevels.find(l => l.upgrade_id === item.upgrade_id)?.current_level || 0;
                                const isMaxed = userLevel >= item.max_level;
                                const cost = item.base_price + (userLevel * item.price_step);
                                
                                return (
                                    <div key={item.upgrade_id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <div style={{ background: 'var(--accent-gradient)', padding: '12px', borderRadius: '12px' }}>
                                            {item.upgrade_id === 'extra_lives' && <Heart size={24} color="#fff" />}
                                            {item.upgrade_id === 'coin_base_value' && <Zap size={24} color="#fff" />}
                                            {item.upgrade_id === 'hotstreak_multiplier' && <TrendingUp size={24} color="#fff" />}
                                            {item.upgrade_id === 'crit_coins' && <Award size={24} color="#fff" />}
                                        </div>
                                        
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 700 }}>{item.display_name}</span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lvl {userLevel} / {item.max_level}</span>
                                            </div>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                                                {item.description}
                                                <div style={{ marginTop: '6px', color: '#fbbf24', fontWeight: 600, fontSize: '0.75rem' }}>
                                                    {item.upgrade_id === 'coin_base_value' && `Aktuell: ${((5 * (1 + userLevel * 0.2)) / 100).toFixed(2)} KC / Münze`}
                                                    {item.upgrade_id === 'extra_lives' && `Aktuell: +${userLevel} ❤️ Start-Leben`}
                                                    {item.upgrade_id === 'crit_coins' && `Aktuell: ${userLevel}% Crit-Chance (10x Wert)`}
                                                    {item.upgrade_id === 'hotstreak_multiplier' && `Aktuell: +${(userLevel * 2)}% Bonus pro passierter Röhre`}
                                                </div>
                                            </p>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                                                    <div style={{ width: `${(userLevel / item.max_level) * 100}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '2px' }}></div>
                                                </div>
                                                <button 
                                                    className={`btn-${(isMaxed || user.koala_balance < cost) ? 'ghost' : 'primary'}`} 
                                                    style={{ height: '32px', fontSize: '0.85rem', padding: '0 16px', opacity: (isMaxed || user.koala_balance < cost) ? 0.5 : 1 }}
                                                    disabled={isMaxed || user.koala_balance < cost}
                                                    onClick={() => purchaseUpgrade(item.upgrade_id)}
                                                >
                                                    {isMaxed ? 'Maxed' : `${(cost / 100).toFixed(0)} KC`}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

            {/* Tutorial / Legend */}
            <div className="glass-panel" style={{ padding: '0', borderRadius: '20px', width: '100%', border: '1px solid rgba(59, 130, 246, 0.2)', overflow: 'hidden' }}>
                <button 
                    onClick={() => setShowTutorial(!showTutorial)}
                    style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', outline: 'none' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                        <AlertCircle size={18} color="#3b82f6" /> How to play & Rewards
                    </div>
                    <span style={{ opacity: 0.5 }}>{showTutorial ? 'Hide' : 'Show'}</span>
                </button>
                
                {showTutorial && (
                    <div className="animate-slide-down" style={{ padding: '0 24px 24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ paddingTop: '20px' }}>
                             <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Controls</h4>
                             <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                 <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 4, height: 4, borderRadius: '50%', background: '#3b82f6' }} /> Space or Tap to jump</li>
                                 <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 4, height: 4, borderRadius: '50%', background: '#3b82f6' }} /> Avoid pipes</li>
                                 <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 4, height: 4, borderRadius: '50%', background: '#3b82f6' }} /> Collecting coins earns KoalaCoins</li>
                             </ul>
                        </div>
                        <div style={{ paddingTop: '20px' }}>
                             <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Economics</h4>
                             <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                 <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b' }} /> 1 Coin = Baseline Hourly Rate</li>
                                 <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b' }} /> Upgrade "Crit Coins" for 10x value</li>
                                 <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b' }} /> Rewards added to wallet</li>
                             </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* SECRET DEV PANEL */}
            {isDev && (
                <div style={{ 
                    position: 'fixed', 
                    top: `${devPanelPos.y}px`, 
                    left: `${devPanelPos.x}px`, 
                    width: isDevMinimized ? '44px' : '300px', 
                    height: isDevMinimized ? '44px' : 'auto',
                    background: 'rgba(0,0,0,0.95)', 
                    border: '1px solid #3b82f6', 
                    borderRadius: '16px', 
                    padding: isDevMinimized ? '0' : '20px', 
                    zIndex: 99999, 
                    color: '#fff', 
                    fontSize: '0.8rem', 
                    boxShadow: '0 0 40px rgba(59, 130, 246, 0.4)', 
                    backdropFilter: 'blur(12px)',
                    transition: isDraggingDev ? 'none' : 'width 0.3s ease, height 0.3s ease, padding 0.3s ease'
                }}>
                    <div 
                        onMouseDown={(e) => {
                            setIsDraggingDev(true);
                            dragOffset.current = { x: e.clientX - devPanelPos.x, y: e.clientY - devPanelPos.y };
                        }}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            gap: '8px', 
                            cursor: 'grab',
                            marginBottom: isDevMinimized ? '0' : '16px', 
                            color: '#3b82f6', 
                            fontWeight: 800, 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.1em',
                            padding: isDevMinimized ? '12px' : '0'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldCheck size={18} /> 
                            {!isDevMinimized && 'DEV PANEL'}
                        </div>
                        <button 
                            className="btn-ghost" 
                            style={{ padding: '4px', border: 'none' }}
                            onClick={(e) => { e.stopPropagation(); setIsDevMinimized(!isDevMinimized); }}
                        >
                            {isDevMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                        </button>
                    </div>
                    
                    {!isDevMinimized && (
                        <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
                            {[
                                { label: 'Start Speed', key: 'startSpeed', min: 1, max: 10, step: 0.1 },
                                { label: 'Max Speed', key: 'maxSpeed', min: 1, max: 15, step: 0.1 },
                                { label: 'Start Spacing', key: 'startPipeSpacing', min: 40, max: 300, step: 1 },
                                { label: 'Min Spacing', key: 'minPipeSpacing', min: 20, max: 150, step: 1 },
                                { label: 'Start Variance', key: 'startGapVariance', min: 10, max: 200, step: 1 },
                                { label: 'Max Variance', key: 'maxGapVariance', min: 50, max: 400, step: 1 },
                                { label: 'Gravity', key: 'gravity', min: 0.05, max: 0.5, step: 0.01 },
                                { label: 'Jump Vel', key: 'jumpVelocity', min: -10, max: -2, step: 0.1 },
                                { label: 'Max Diff Score', key: 'maxDifficultyScore', min: 10, max: 200, step: 1 },
                            ].map(s => (
                                <div key={s.key}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ color: '#94a3b8' }}>{s.label}</span>
                                        <span style={{ fontWeight: 700 }}>{devSettings[s.key]}</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min={s.min} 
                                        max={s.max} 
                                        step={s.step} 
                                        value={devSettings[s.key]} 
                                        onChange={(e) => setDevSettings(prev => ({ ...prev, [s.key]: parseFloat(e.target.value) }))}
                                        style={{ width: '100%', height: '4px', background: '#1e293b', appearance: 'none', borderRadius: '2px', outline: 'none' }}
                                    />
                                </div>
                            ))}
                        </div>
                        
                        <button className="btn-secondary" style={{ width: '100%', marginTop: '16px', padding: '8px', fontSize: '0.75rem' }} onClick={() => console.log('DEBUG_STATE:', devSettings)}>
                            Log Config to Console
                        </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default KoalaFlap;

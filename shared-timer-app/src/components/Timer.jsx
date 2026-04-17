import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, RotateCcw, Repeat, StopCircle } from 'lucide-react';
import EVENTS from '../../socketEvents.json';
import { ALARM_SOUNDS, playAlarmSound } from '../utils/soundGenerator';
import { getNextPokemon } from '../utils/pokemonUtils';
import { useAuth } from '../context/AuthContext';

const Timer = ({ roomState, socket, roomId, userRole, user, isZenMode, serverTimeOffset = 0 }) => {
    const { setUser } = useAuth();
    const [localRemainingMs, setLocalRemainingMs] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const animationRef = useRef(null);
    const audioContextRef = useRef(null);

    const visualMode = user?.preferences?.timerVisual || 'circle';
    const isPomodoro = roomState?.state?.isPomodoro;

    // Helper to calculate perfectly synced remaining time taking network latency into account
    const getExactRemaining = () => {
        if (!roomState) return 0;
        if (!roomState.state.isRunning || !roomState.state.lastTickTime) return roomState.state.remainingMs;

        // Date.now() + serverTimeOffset equals the exact millisecond time on the server right now
        const trueServerTime = Date.now() + serverTimeOffset;
        // The server told us it had `remainingMs` left at `lastTickTime`. 
        const elapsedSinceTick = trueServerTime - roomState.state.lastTickTime;
        return Math.max(0, roomState.state.remainingMs - elapsedSinceTick);
    };

    useEffect(() => {
        if (!roomState) return;
        setLocalRemainingMs(getExactRemaining());

        // Initialize Web Audio API on first interaction
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
    }, [roomState?.state.remainingMs, roomState?.config.durationMs, roomState?.state.lastTickTime]);

    useEffect(() => {
        if (!roomState) return;

        // Request permission for browser notifications
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        if (roomState.state.isRunning) {
            // Recalibrate start point immediately to erase any state-sync delays
            let currentRemaining = getExactRemaining();
            setLocalRemainingMs(currentRemaining);

            // Local interpolation for smooth 60fps countdown
            let lastTime = performance.now();

            const updateTimer = (currentTime) => {
                const delta = currentTime - lastTime;
                lastTime = currentTime;

                currentRemaining -= delta;
                setLocalRemainingMs(currentRemaining > 0 ? currentRemaining : 0);

                if (currentRemaining > 0) {
                    animationRef.current = requestAnimationFrame(updateTimer);
                }
            };

            animationRef.current = requestAnimationFrame(updateTimer);
        } else {
            setLocalRemainingMs(roomState.state.remainingMs);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        }

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [roomState?.state.isRunning, roomState?.state.remainingMs, roomState?.state.lastTickTime, serverTimeOffset]);

    // Handle completed event specifically for sound/notifications
    useEffect(() => {
        const handleCompleted = () => {
            setLocalRemainingMs(0);
            playRingtone();
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000);
            if (Notification.permission === 'granted') {
                new Notification('Timer Completed!', {
                    body: `The timer "${roomState?.config?.name || 'Session'}" has finished.`,
                    icon: '/vite.svg'
                });
            }
        };
        socket.on(EVENTS.TIMER_COMPLETED, handleCompleted);
        return () => socket.off(EVENTS.TIMER_COMPLETED, handleCompleted);
    }, [socket, roomState]);

    // Pokemon Timer Sync Logic
    useEffect(() => {
        const handleCompleted = () => {
            const pokemonTheme = user?.preferences?.pokemonTheme;
            if (pokemonTheme?.active && pokemonTheme?.timerSync) {
                fetch('/api/pokemon')
                    .then(res => res.json())
                    .then(list => {
                        const nextP = getNextPokemon(list, pokemonTheme);
                        if (nextP) {
                            setUser(prev => ({
                                ...prev,
                                preferences: {
                                    ...prev.preferences,
                                    pokemonTheme: { 
                                        ...prev.preferences.pokemonTheme, 
                                        id: nextP.id, 
                                        name: nextP.name, 
                                        types: nextP.types,
                                        threshold: nextP.threshold,
                                        backgroundColor: nextP.backgroundColor
                                    }
                                }
                            }));
                        }
                    });
            }
        };
        socket.on(EVENTS.TIMER_COMPLETED, handleCompleted);
        return () => socket.off(EVENTS.TIMER_COMPLETED, handleCompleted);
    }, [socket, user?.preferences?.pokemonTheme]);

    const playRingtone = () => {
        const soundChoice = user?.preferences?.alarmSound || ALARM_SOUNDS.CLASSIC_BEEP;
        const volume = user?.preferences?.alarmVolume !== undefined ? user.preferences.alarmVolume : 0.5;
        playAlarmSound(soundChoice, volume);
    };

    if (!roomState) return null;

    const totalDuration = roomState.config.durationMs;
    const progress = Math.max(0, Math.min(1, localRemainingMs / totalDuration));

    // Format MM:SS
    const totalSeconds = Math.ceil(localRemainingMs / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const formattedTime = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    const pauseTime = isPomodoro ? (roomState?.config?.pomodoro?.pauseMinutes || 0) * 60 * 1000 : 0;
    
    let currentPhase = 'focus';
    let phaseText = roomState?.state?.isRunning ? 'Focusing' : (localRemainingMs === 0 ? 'Done' : 'Paused');
    const workName = roomState?.config?.pomodoro?.workName || 'Focusing';
    const breakName = roomState?.config?.pomodoro?.breakName || 'Entspannen';
    if (isPomodoro) {
        if (localRemainingMs > totalDuration - pauseTime) {
            currentPhase = 'pause';
            phaseText = roomState?.state?.isRunning ? breakName : `Paused (${breakName})`;
        } else {
            currentPhase = 'focus';
            phaseText = roomState?.state?.isRunning ? workName : (localRemainingMs === 0 ? 'Done' : `Paused (${workName})`);
        }
    }

    const circleRadius = isZenMode ? 145 : 120;
    const svgSize = isZenMode ? 340 : 300;
    const svgCenter = svgSize / 2;
    const circleCircumference = 2 * Math.PI * circleRadius;
    const strokeDashoffset = circleCircumference - progress * circleCircumference;

    const ringRadius = isZenMode ? 190 : 160;
    const ringSvgSize = isZenMode ? 400 : 340;
    const ringCenter = ringSvgSize / 2;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringStrokeDashoffset = ringCircumference - progress * ringCircumference;

    const handleAction = (action) => {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        socket.emit(EVENTS.TIMER_ACTION, { roomId, action });
    };

    const isWrite = userRole === 'write';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', position: 'relative' }}>

            {/* Confetti Overlay */}
            {showConfetti && (
                <div style={{ position: 'absolute', inset: '-50px', pointerEvents: 'none', overflow: 'hidden', zIndex: 20 }}>
                    {Array.from({ length: 30 }).map((_, i) => (
                        <div
                            key={i}
                            className="confetti-particle"
                            style={{
                                position: 'absolute',
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 40}%`,
                                width: `${6 + Math.random() * 8}px`,
                                height: `${6 + Math.random() * 8}px`,
                                background: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'][Math.floor(Math.random() * 6)],
                                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                                animationDelay: `${Math.random() * 0.5}s`,
                                animationDuration: `${2 + Math.random() * 2}s`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Visual Timer Display */}
            <div style={{ position: 'relative', width: (visualMode === 'circle' || visualMode === 'dots' || visualMode === 'ring') ? (isZenMode ? '400px' : '340px') : '400px', height: (visualMode === 'circle' || visualMode === 'dots' || visualMode === 'ring') ? (isZenMode ? '400px' : '340px') : 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'width 0.3s, height 0.3s' }}>

                {isPomodoro && (
                    <div style={{
                        position: 'absolute',
                        top: (visualMode === 'circle' || visualMode === 'dots' || visualMode === 'ring') ? '-40px' : '-50px',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        background: currentPhase === 'focus' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: currentPhase === 'focus' ? 'var(--accent-primary)' : '#10b981',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        border: '1px solid currentColor',
                        transition: 'all 0.3s ease'
                    }}>
                        Phase: {currentPhase === 'pause' ? breakName : workName}
                    </div>
                )}
                {visualMode === 'circle' && (
                    <>
                        <svg width={svgSize} height={svgSize} style={{ position: 'absolute', transform: 'rotate(-90deg)', transition: 'width 0.3s, height 0.3s' }}>
                            <circle cx={svgCenter} cy={svgCenter} r={circleRadius} fill="none" stroke="var(--border-color)" strokeWidth="8" style={{ transition: 'r 0.3s, cx 0.3s, cy 0.3s' }} />
                            <circle cx={svgCenter} cy={svgCenter} r={circleRadius} fill="none" stroke="url(#accentGradient)" strokeWidth="8" strokeLinecap="round" strokeDasharray={circleCircumference} strokeDashoffset={strokeDashoffset} style={{ transition: roomState.state.isRunning ? 'r 0.3s, cx 0.3s, cy 0.3s' : 'stroke-dashoffset 0.3s ease, r 0.3s, cx 0.3s, cy 0.3s' }} />
                            <defs>
                                <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="var(--accent-primary)" />
                                    <stop offset="100%" stopColor="var(--accent-secondary)" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', fontFamily: '"Outfit", sans-serif' }}>
                            <div style={{ fontSize: isZenMode ? '5.5rem' : '4.5rem', fontWeight: 700, letterSpacing: '-0.02em', textShadow: '0 0 40px rgba(59, 130, 246, 0.4)', transition: 'font-size 0.3s' }}>{formattedTime}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{phaseText}</div>
                        </div>
                    </>
                )}

                {visualMode === 'bar' && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                        <div style={{ fontSize: isZenMode ? '8.5rem' : '6.5rem', fontWeight: 800, fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.03em', textShadow: '0 0 50px rgba(59, 130, 246, 0.3)', transition: 'all 0.3s' }}>{formattedTime}</div>
                        <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                            <div style={{
                                height: '100%',
                                width: `${progress * 100}%`,
                                background: 'var(--accent-gradient)',
                                transition: roomState.state.isRunning ? 'none' : 'width 0.3s ease'
                            }}></div>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 500 }}>{phaseText}</div>
                    </div>
                )}

                {visualMode === 'minimal' && (
                    <div style={{ textAlign: 'center', margin: '40px 0' }}>
                        <div style={{ fontSize: isZenMode ? '12rem' : '8rem', fontWeight: 800, fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.04em', textShadow: '0 0 80px rgba(59, 130, 246, 0.2)', transition: 'all 0.3s', lineHeight: 1 }}>{formattedTime}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '0.4em', fontWeight: 600, marginTop: '16px', opacity: 0.5 }}>{phaseText}</div>
                    </div>
                )}

                {visualMode === 'dots' && (
                    <div style={{ position: 'relative', width: '300px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {/* 60 Dots logic */}
                        {Array.from({ length: 60 }).map((_, i) => {
                            const rotation = i * 6; // 360 / 60
                            const isActive = (i / 60) < progress;
                            return (
                                <div key={i} style={{
                                    position: 'absolute',
                                    top: 0, left: '148px', // Center dot horizontally
                                    width: '4px', height: '14px',
                                    background: isActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                                    borderRadius: '2px',
                                    transformOrigin: '2px 150px',
                                    transform: `rotate(${rotation}deg)`,
                                    boxShadow: isActive ? '0 0 10px var(--accent-primary)' : 'none',
                                    transition: 'background 0.2s'
                                }} />
                            );
                        })}
                        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', fontFamily: '"Outfit", sans-serif' }}>
                            <div style={{ fontSize: '4.5rem', fontWeight: 700, letterSpacing: '-0.02em', textShadow: '0 0 30px var(--accent-primary)' }}>{formattedTime}</div>
                        </div>
                    </div>
                )}

                {visualMode === 'battery' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
                        <div style={{ fontSize: isZenMode ? '6.5rem' : '5rem', fontWeight: 800, fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.02em' }}>{formattedTime}</div>

                        {/* Battery Icon */}
                        <div style={{ position: 'relative', width: '220px', height: '100px', border: '4px solid var(--border-color)', borderRadius: '12px', padding: '6px', background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', width: '8px', height: '40px', background: 'var(--border-color)', borderRadius: '0 6px 6px 0' }} />

                            <div style={{
                                height: '100%',
                                width: `${progress * 100}%`,
                                background: progress < 0.15 ? '#ef4444' : 'var(--accent-gradient)',
                                borderRadius: '6px',
                                transition: roomState.state.isRunning ? 'none' : 'width 0.3s ease',
                                boxShadow: progress < 0.15 ? '0 0 20px rgba(239,68,68,0.5)' : 'var(--shadow-glow)'
                            }} />
                        </div>
                    </div>
                )}

                {visualMode === 'hourglass' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
                        <div style={{ fontSize: isZenMode ? '6.5rem' : '5rem', fontWeight: 800, fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.02em', textShadow: '0 0 30px rgba(59, 130, 246, 0.2)' }}>{formattedTime}</div>
                        <div style={{ position: 'relative', width: '100px', height: '140px', display: 'flex', flexDirection: 'column', gap: '2px', filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.1))' }}>
                            {/* Top Glass */}
                            <div style={{
                                flex: 1,
                                clipPath: 'polygon(0% 0%, 100% 0%, 55% 100%, 45% 100%)',
                                background: 'rgba(255,255,255,0.03)',
                                position: 'relative',
                                overflow: 'hidden',
                                borderTop: '4px solid var(--text-muted)'
                            }}>
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    height: `${progress * 100}%`,
                                    background: 'var(--accent-gradient)',
                                    transition: roomState.state.isRunning ? 'none' : 'height 0.3s'
                                }} />
                            </div>
                            {/* Bottom Glass */}
                            <div style={{
                                flex: 1,
                                clipPath: 'polygon(45% 0%, 55% 0%, 100% 100%, 0% 100%)',
                                background: 'rgba(255,255,255,0.03)',
                                position: 'relative',
                                overflow: 'hidden',
                                borderBottom: '4px solid var(--text-muted)'
                            }}>
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    height: `${(1 - progress) * 100}%`,
                                    background: 'var(--accent-gradient)',
                                    transition: roomState.state.isRunning ? 'none' : 'height 0.3s'
                                }} />
                            </div>
                        </div>
                    </div>
                )}

                {visualMode === 'ring' && (
                    <>
                        <svg width={ringSvgSize} height={ringSvgSize} style={{ position: 'absolute', transform: 'rotate(-90deg)', transition: 'width 0.3s, height 0.3s' }}>
                            <circle cx={ringCenter} cy={ringCenter} r={ringRadius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="2" style={{ transition: 'r 0.3s, cx 0.3s, cy 0.3s' }} />
                            <circle cx={ringCenter} cy={ringCenter} r={ringRadius} fill="none" stroke="url(#accentGradient)" strokeWidth="2" strokeLinecap="round" strokeDasharray={ringCircumference} strokeDashoffset={ringStrokeDashoffset} style={{ transition: roomState.state.isRunning ? 'r 0.3s, cx 0.3s, cy 0.3s' : 'stroke-dashoffset 0.3s ease, r 0.3s, cx 0.3s, cy 0.3s', filter: 'drop-shadow(0 0 8px var(--accent-primary))' }} />
                        </svg>
                        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', fontFamily: '"Outfit", sans-serif' }}>
                            <div style={{ fontSize: isZenMode ? '6.5rem' : '4.5rem', fontWeight: 300, letterSpacing: '-0.04em', textShadow: '0 0 20px rgba(255, 255, 255, 0.2)', transition: 'font-size 0.3s' }}>{formattedTime}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: '8px' }}>{phaseText}</div>
                        </div>
                    </>
                )}
            </div>

            {/* Controls */}
            {isWrite ? (
                <div style={{ display: 'flex', gap: '16px', zIndex: 10 }}>
                    {!roomState.state.isRunning ? (
                        <button className="btn-primary" onClick={() => handleAction('START')} style={{ borderRadius: '50px', padding: '16px 32px' }}>
                            <Play fill="currentColor" /> Start
                        </button>
                    ) : (
                        <button className="btn-primary" onClick={() => handleAction('PAUSE')} style={{ borderRadius: '50px', padding: '16px 32px', background: 'rgba(255,255,255,0.1)', boxShadow: 'none' }}>
                            <Pause fill="currentColor" /> Pause
                        </button>
                    )}

                    {roomState.state.isRunning && (
                        <button 
                            className="btn-ghost" 
                            onClick={() => {
                                const abgelaufeneMinuten = Math.floor((roomState.config.durationMs - localRemainingMs) / 60000);
                                if (window.confirm(`Timer wirklich beenden? Belohnungen werden anteilig für ${abgelaufeneMinuten} abgelaufene Minuten ausgeschüttet.`)) {
                                    handleAction('END_EARLY');
                                }
                            }} 
                            style={{ borderRadius: '50px', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} 
                            title="Timer sofort beenden"
                        >
                            <StopCircle size={24} />
                        </button>
                    )}

                    <button className="btn-ghost" onClick={() => handleAction('RESET')} style={{ borderRadius: '50px', padding: '16px', background: 'rgba(255,255,255,0.05)' }} title="Reset Timer">
                        <RotateCcw size={24} />
                    </button>

                    <button
                        className={`btn-ghost ${roomState.state.autoRestart ? 'active' : ''}`}
                        onClick={() => socket.emit(EVENTS.TOGGLE_AUTO_RESTART, { roomId, enabled: !roomState.state.autoRestart })}
                        style={{
                            borderRadius: '50px',
                            padding: '16px',
                            background: roomState.state.autoRestart ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                            color: roomState.state.autoRestart ? 'var(--accent-primary)' : 'var(--text-muted)'
                        }}
                        title="Toggle Auto-Restart"
                    >
                        <Repeat size={24} />
                    </button>
                </div>
            ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '12px 24px', background: 'rgba(255,255,255,0.05)', borderRadius: '50px' }}>
                    Read Only Access
                </div>
            )}

        </div>
    );
};

export default Timer;

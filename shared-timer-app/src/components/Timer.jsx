import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import EVENTS from '../socketEvents';

const Timer = ({ roomState, socket, roomId, userRole, user, isZenMode }) => {
    const [localRemainingMs, setLocalRemainingMs] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const animationRef = useRef(null);
    const audioContextRef = useRef(null);

    const visualMode = user?.preferences?.timerVisual || 'circle';
    const isPomodoro = roomState?.state?.isPomodoro;
    const pomodoroPhase = roomState?.state?.pomodoroPhase; // 'work' or 'break'

    useEffect(() => {
        if (!roomState) return;
        setLocalRemainingMs(roomState.state.remainingMs);

        // Initialize Web Audio API on first interaction
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
    }, [roomState?.state.remainingMs, roomState?.config.durationMs]);

    useEffect(() => {
        if (!roomState) return;

        // Request permission for browser notifications
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        if (roomState.state.isRunning) {
            // Local interpolation for smooth 60fps countdown
            let lastTime = performance.now();

            const updateTimer = (currentTime) => {
                const delta = currentTime - lastTime;
                lastTime = currentTime;

                setLocalRemainingMs(prev => {
                    const next = prev - delta;
                    return next > 0 ? next : 0;
                });

                animationRef.current = requestAnimationFrame(updateTimer);
            };

            animationRef.current = requestAnimationFrame(updateTimer);
        } else {
            setLocalRemainingMs(roomState.state.remainingMs);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        }

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [roomState?.state.isRunning, roomState?.state.remainingMs]);

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

    const playRingtone = () => {
        if (!audioContextRef.current) return;
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        // Simple beep sequence
        [0, 0.25, 0.5, 0.75].forEach(delay => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime + delay); // A5
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + delay + 0.1);

            gain.gain.setValueAtTime(0, ctx.currentTime + delay);
            gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + delay + 0.05);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.15);

            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.2);
        });
    };

    if (!roomState) return null;

    const totalDuration = roomState.config.durationMs;
    const progress = Math.max(0, Math.min(1, localRemainingMs / totalDuration));

    // Format MM:SS
    const totalSeconds = Math.ceil(localRemainingMs / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const formattedTime = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    const circleRadius = 120;
    const circleCircumference = 2 * Math.PI * circleRadius;
    const strokeDashoffset = circleCircumference - progress * circleCircumference;

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
            <div style={{ position: 'relative', width: visualMode === 'circle' ? '300px' : '400px', height: visualMode === 'circle' ? '300px' : 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

                {isPomodoro && (
                    <div style={{
                        position: 'absolute',
                        top: visualMode === 'circle' ? '-40px' : '-50px',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        background: pomodoroPhase === 'work' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: pomodoroPhase === 'work' ? 'var(--accent-primary)' : '#10b981',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        border: '1px solid currentColor',
                        transition: 'all 0.3s ease'
                    }}>
                        Pomodoro: {pomodoroPhase}
                    </div>
                )}
                {visualMode === 'circle' ? (
                    <>
                        <svg width="300" height="300" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                            <circle cx="150" cy="150" r={circleRadius} fill="none" stroke="var(--border-color)" strokeWidth="8" />
                            <circle cx="150" cy="150" r={circleRadius} fill="none" stroke="url(#accentGradient)" strokeWidth="8" strokeLinecap="round" strokeDasharray={circleCircumference} strokeDashoffset={strokeDashoffset} style={{ transition: roomState.state.isRunning ? 'none' : 'stroke-dashoffset 0.3s ease' }} />
                            <defs>
                                <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="var(--accent-primary)" />
                                    <stop offset="100%" stopColor="var(--accent-secondary)" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', fontFamily: '"Outfit", sans-serif' }}>
                            <div style={{ fontSize: isZenMode ? '5.5rem' : '4.5rem', fontWeight: 700, letterSpacing: '-0.02em', textShadow: '0 0 40px rgba(59, 130, 246, 0.4)', transition: 'font-size 0.3s' }}>{formattedTime}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{roomState.state.isRunning ? 'Focusing' : (localRemainingMs === 0 ? 'Done' : 'Paused')}</div>
                        </div>
                    </>
                ) : (
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
                        <div style={{ color: 'var(--text-muted)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 500 }}>{roomState.state.isRunning ? 'Focusing' : (localRemainingMs === 0 ? 'Done' : 'Paused')}</div>
                    </div>
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

                    <button className="btn-ghost" onClick={() => handleAction('RESET')} style={{ borderRadius: '50px', padding: '16px', background: 'rgba(255,255,255,0.05)' }}>
                        <RotateCcw />
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

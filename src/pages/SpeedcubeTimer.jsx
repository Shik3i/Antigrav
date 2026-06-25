import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Trash2, Edit3, Save, X, Timer, Grid3X3, Trophy, Zap, TrendingUp, Eye, EyeOff, RefreshCw, Info, Play, Square } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// CSS for mobile touch controls
const mobileTouchControlsStyle = `
  .mobile-touch-controls {
    display: none;
  }

  .spacebar-instructions {
    display: block;
  }

  /* Prevent text selection on buttons */
  .btn-primary {
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
  }

  @media (max-width: 768px) {
    .mobile-touch-controls {
      display: block !important;
    }

    .spacebar-instructions {
      display: none !important;
    }

    /* Mobile-specific timer fixes - only target the timer display */
    .glass-card {
      overflow: visible !important;
      padding: 40px 24px !important;
    }

    /* Target only the timer text (the formatted time) */
    .timer-display {
      font-size: 3rem !important;
      letter-spacing: normal !important;
      text-shadow: 0 0 8px rgba(255,255,255,0.3) !important;
      overflow: visible !important;
    }
  }
`;

const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor(ms % 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

const generateScramble = () => {
    const moves = ['U', 'D', 'L', 'R', 'F', 'B'];
    const modifiers = ['', "'", '2'];
    const scramble = [];
    let lastMove = '';
    let lastAxis = '';

    const axisMap = {
        'U': 'UD', 'D': 'UD',
        'L': 'LR', 'R': 'LR',
        'F': 'FB', 'B': 'FB'
    };

    for (let i = 0; i < 20; i++) {
        let move;
        let axis;
        do {
            move = moves[Math.floor(Math.random() * moves.length)];
            axis = axisMap[move];
        } while (move === lastMove || (axis === lastAxis && move === scramble[scramble.length - 1]?.split('')[0]));

        const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
        scramble.push(move + modifier);
        lastMove = move;
        lastAxis = axis;
    }
    return scramble.join(' ');
};

const SpeedcubeTimer = () => {
    const { user, token, isGuest } = useAuth();
    const [status, setStatus] = useState('idle'); // 'idle', 'ready', 'running'
    const [time, setTime] = useState(0);
    const [history, setHistory] = useState([]);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingNoteValue, setEditingNoteValue] = useState('');

    const [currentScramble, setCurrentScramble] = useState('');
    const [showScramble, setShowScramble] = useState(true);
    const [showScrambleHistoryId, setShowScrambleHistoryId] = useState(null);

    const startTimeRef = useRef(0);
    const timerIdRef = useRef(null);
    const isHoldingSpaceRef = useRef(false);

    useEffect(() => {
        setCurrentScramble(generateScramble());
    }, []);

    // Fetch history
    const fetchHistory = useCallback(async () => {
        if (isGuest) {
            try {
                const stored = JSON.parse(localStorage.getItem('guest_speedcube_times') || '[]');
                setHistory(stored);
            } catch (e) {
                setHistory([]);
            }
        } else {
            try {
                const res = await fetch('/api/speedcube', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setHistory(data);
                }
            } catch (err) {
                console.error('Failed to fetch speedcube history:', err);
            }
        }
    }, [isGuest, token]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Save result
    const saveResult = async (time_ms) => {
        const scramble = currentScramble;
        const newEntry = {
            id: isGuest ? Date.now() : null, // Temp ID for guest
            userId: user?.id || 'guest',
            time_ms,
            note: '',
            scramble,
            createdAt: new Date().toISOString()
        };

        if (isGuest) {
            const updated = [newEntry, ...history];
            setHistory(updated);
            localStorage.setItem('guest_speedcube_times', JSON.stringify(updated));
        } else {
            try {
                const res = await fetch('/api/speedcube', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ time_ms, note: '', scramble })
                });
                if (res.ok) {
                    fetchHistory();
                }
            } catch (err) {
                console.error('Failed to save speedcube time:', err);
            }
        }
        setCurrentScramble(generateScramble());
    };

    const handleDelete = async (id) => {
        if (isGuest) {
            const updated = history.filter(item => item.id !== id);
            setHistory(updated);
            localStorage.setItem('guest_speedcube_times', JSON.stringify(updated));
        } else {
            try {
                const res = await fetch(`/api/speedcube/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    fetchHistory();
                }
            } catch (err) {
                console.error('Failed to delete time entry:', err);
            }
        }
    };

    const handleSaveNote = async (id) => {
        if (isGuest) {
            const updated = history.map(item => item.id === id ? { ...item, note: editingNoteValue } : item);
            setHistory(updated);
            localStorage.setItem('guest_speedcube_times', JSON.stringify(updated));
        } else {
            try {
                const res = await fetch(`/api/speedcube/${id}/note`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ note: editingNoteValue })
                });
                if (res.ok) {
                    fetchHistory();
                }
            } catch (err) {
                console.error('Failed to update note:', err);
            }
        }
        setEditingNoteId(null);
    };

    // Touch button handlers for mobile
    const handleTouchStart = (e) => {
        e.preventDefault();
        if (status === 'running') {
            // Stop timer
            const finalTime = performance.now() - startTimeRef.current;
            setTime(finalTime);
            saveResult(finalTime);
            setStatus('idle');
        } else if (status === 'idle') {
            setStatus('ready');
        }
    };

    const handleTouchEnd = (e) => {
        e.preventDefault();
        if (status === 'ready') {
            setStatus('running');
        }
    };

    // Timer Loop Effect
    useEffect(() => {
        if (status !== 'running') return;

        startTimeRef.current = performance.now();
        const tick = () => {
            setTime(performance.now() - startTimeRef.current);
            timerIdRef.current = requestAnimationFrame(tick);
        };
        timerIdRef.current = requestAnimationFrame(tick);

        return () => {
            if (timerIdRef.current) {
                cancelAnimationFrame(timerIdRef.current);
                timerIdRef.current = null;
            }
        };
    }, [status]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();

                if (status === 'running') {
                    // Stop timer
                    const finalTime = performance.now() - startTimeRef.current;
                    setTime(finalTime);
                    saveResult(finalTime);
                    setStatus('idle');
                } else if (status === 'idle' && !isHoldingSpaceRef.current) {
                    isHoldingSpaceRef.current = true;
                    setStatus('ready');
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                isHoldingSpaceRef.current = false;
                if (status === 'ready') {
                    setStatus('running');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [status, history]);

    return (
        <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
            <style>{mobileTouchControlsStyle}</style>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
                    <Grid3X3 size={40} color="var(--accent-primary)" />
                    <h1 style={{ fontSize: '3rem', margin: 0 }}>Speedcube Timer</h1>
                </div>

                <div
                    className="glass-card"
                    style={{
                        padding: '60px 20px',
                        fontSize: '6rem',
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                        color: status === 'ready' ? '#10b981' : (status === 'running' ? 'var(--text-main)' : 'var(--text-muted)'),
                        textShadow: status === 'ready' ? '0 0 30px rgba(16, 185, 129, 0.4)' : 'none',
                        transition: 'all 0.1s ease',
                        fontVariantNumeric: 'tabular-nums',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '280px',
                        position: 'relative'
                    }}
                >
                    {showScramble && currentScramble && status !== 'running' && (
                        <div style={{
                            fontSize: '1.25rem',
                            color: 'var(--text-main)',
                            marginBottom: '30px',
                            maxWidth: '80%',
                            lineHeight: '1.6',
                            fontWeight: 500,
                            letterSpacing: '0.02em'
                        }}>
                            {currentScramble}
                        </div>
                    )}
                    <div className="timer-display">{formatTime(time)}</div>

                    {status === 'idle' && (
                        <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setShowScramble(!showScramble)}
                                className="btn-ghost"
                                title={showScramble ? "Hide Scramble" : "Show Scramble"}
                                style={{ padding: '8px', background: 'rgba(255,255,255,0.05)' }}
                            >
                                {showScramble ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                            <button
                                onClick={() => setCurrentScramble(generateScramble())}
                                className="btn-ghost"
                                title="New Scramble"
                                style={{ padding: '8px', background: 'rgba(255,255,255,0.05)' }}
                            >
                                <RefreshCw size={20} />
                            </button>
                        </div>
                    )}
                </div>

                <p className="spacebar-instructions" style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                    {status === 'idle' && "Hold [Space] to get ready"}
                    {status === 'ready' && "Release [Space] to start"}
                    {status === 'running' && "Press [Space] to stop"}
                </p>

                {/* Touch Controls for Mobile - Only show on small screens */}
                <div className="mobile-touch-controls">
                    <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
                        {status === 'running' ? (
                            <button
                                onClick={handleTouchStart}
                                onTouchStart={handleTouchStart}
                                className="btn-primary"
                                style={{
                                    padding: '16px 32px',
                                    fontSize: '1.2rem',
                                    fontWeight: 600,
                                    background: '#ef4444',
                                    border: 'none',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    transition: 'all 0.2s',
                                    minHeight: '60px',
                                    minWidth: '160px'
                                }}
                            >
                                <Square size={24} /> Stop
                            </button>
                        ) : (
                            <button
                                onClick={handleTouchStart}
                                onTouchStart={handleTouchStart}
                                onTouchEnd={handleTouchEnd}
                                className="btn-primary"
                                style={{
                                    padding: '16px 32px',
                                    fontSize: '1.2rem',
                                    fontWeight: 600,
                                    background: '#10b981',
                                    border: 'none',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    transition: 'all 0.2s',
                                    minHeight: '60px',
                                    minWidth: '160px'
                                }}
                            >
                                <Play size={24} /> Start
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '32px' }}>
                    {(() => {
                        const allTimeBest = history.length > 0 ? Math.min(...history.map(h => h.time_ms)) : 0;
                        const todayStr = new Date().toISOString().split('T')[0];
                        const todayHistory = history.filter(h => h.createdAt.startsWith(todayStr));
                        const bestToday = todayHistory.length > 0 ? Math.min(...todayHistory.map(h => h.time_ms)) : 0;

                        const calculateAverage = (arr, x) => {
                            if (arr.length === 0) return 0;
                            const count = Math.min(arr.length, x);
                            const recent = arr.slice(0, count).map(h => h.time_ms);
                            return recent.reduce((a, b) => a + b, 0) / count;
                        };
                        const avg5 = calculateAverage(history, 5);
                        const avg10 = calculateAverage(history, 10);
                        const avg50 = calculateAverage(history, 50);
                        const avg100 = calculateAverage(history, 100);

                        return (
                            <>
                                {/* Top Row: Bests */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                                    <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.05)' }}>
                                        <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '10px', borderRadius: '12px' }}>
                                            <Trophy size={24} color="#f59e0b" />
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personal Best</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: '#f59e0b' }}>
                                                {allTimeBest > 0 ? formatTime(allTimeBest) : '--:--.---'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--accent-primary)', background: 'rgba(59, 130, 246, 0.05)' }}>
                                        <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '10px', borderRadius: '12px' }}>
                                            <Zap size={24} color="var(--accent-primary)" />
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best Today</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                                                {bestToday > 0 ? formatTime(bestToday) : '--:--.---'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Row: Averages */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                                    {[
                                        { label: 'Ø 5', value: avg5, color: '#ec4899', icon: <TrendingUp size={24} color="#ec4899" /> },
                                        { label: 'Ø 10', value: avg10, color: '#8b5cf6', icon: <TrendingUp size={24} color="#8b5cf6" /> },
                                        { label: 'Ø 50', value: avg50, color: '#3b82f6', icon: <TrendingUp size={24} color="#3b82f6" /> },
                                        { label: 'Ø 100', value: avg100, color: '#14b8a6', icon: <TrendingUp size={24} color="#14b8a6" /> }
                                    ].map((stat) => (
                                        <div key={stat.label} className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: `4px solid ${stat.color}` }}>
                                            <div style={{ background: `${stat.color}25`, padding: '10px', borderRadius: '12px' }}>
                                                {stat.icon}
                                            </div>
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: stat.color }}>
                                                    {stat.value > 0 ? formatTime(stat.value) : '--:--.---'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>

            <div className="glass-card" style={{ padding: '24px', overflow: 'hidden' }}>
                <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Clock size={24} color="var(--accent-primary)" />
                    History
                </h2>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <th style={{ padding: '12px 16px' }}>Date</th>
                                <th style={{ padding: '12px 16px' }}>Time</th>
                                <th style={{ padding: '12px 16px' }}>Note</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No times recorded yet.</td>
                                </tr>
                            ) : (
                                history.map((item) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>
                                            {new Date(item.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {formatTime(item.time_ms)}
                                                {item.scramble && (
                                                    <div style={{ position: 'relative' }}>
                                                        <button
                                                            className="btn-ghost"
                                                            style={{ padding: '4px', color: 'var(--text-muted)' }}
                                                            onMouseEnter={() => setShowScrambleHistoryId(item.id)}
                                                            onMouseLeave={() => setShowScrambleHistoryId(null)}
                                                            onClick={() => setShowScrambleHistoryId(showScrambleHistoryId === item.id ? null : item.id)}
                                                        >
                                                            <Info size={14} />
                                                        </button>
                                                        {showScrambleHistoryId === item.id && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: '100%',
                                                                left: '50%',
                                                                transform: 'translateX(-50%)',
                                                                marginBottom: '10px',
                                                                background: 'var(--bg-color)',
                                                                border: '1px solid var(--accent-primary)',
                                                                padding: '12px',
                                                                borderRadius: '8px',
                                                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                                                width: '320px',
                                                                zIndex: 1000,
                                                                fontSize: '0.9rem',
                                                                color: 'var(--text-main)',
                                                                pointerEvents: 'auto',
                                                                textAlign: 'center',
                                                                fontWeight: 400,
                                                                lineHeight: '1.4'
                                                            }}>
                                                                <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--accent-primary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scramble</div>
                                                                <div style={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>{item.scramble}</div>
                                                                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--accent-primary)' }}></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px', flex: 1 }}>
                                            {editingNoteId === item.id ? (
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        className="input-primary"
                                                        value={editingNoteValue}
                                                        onChange={(e) => setEditingNoteValue(e.target.value)}
                                                        autoFocus
                                                        style={{ padding: '4px 8px', fontSize: '0.9rem' }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveNote(item.id);
                                                            if (e.key === 'Escape') setEditingNoteId(null);
                                                        }}
                                                    />
                                                    <button onClick={() => handleSaveNote(item.id)} className="btn-ghost" style={{ padding: '4px' }}><Save size={16} color="#10b981" /></button>
                                                    <button onClick={() => setEditingNoteId(null)} className="btn-ghost" style={{ padding: '4px' }}><X size={16} color="#ef4444" /></button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', group: 'true' }}>
                                                    <span style={{ fontSize: '0.9rem', color: item.note ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                        {item.note || 'No note'}
                                                    </span>
                                                    <button
                                                        className="btn-ghost"
                                                        style={{ padding: '4px', opacity: 0.5 }}
                                                        onClick={() => {
                                                            setEditingNoteId(item.id);
                                                            setEditingNoteValue(item.note || '');
                                                        }}
                                                    >
                                                        <Edit3 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            <button
                                                className="btn-ghost"
                                                style={{ padding: '8px', color: '#ef4444' }}
                                                onClick={() => handleDelete(item.id)}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {!user && (
                <div style={{ marginTop: '24px', textAlign: 'center', padding: '16px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontSize: '0.9rem' }}>
                    <strong>Note:</strong> You are using the timer as a guest. Your times are saved locally and will be lost if you clear your browser data.
                    <a href="/login" style={{ color: '#f59e0b', marginLeft: '8px', fontWeight: 700 }}>Login</a> to save your progress permanently.
                </div>
            )}
        </div>
    );
};

export default SpeedcubeTimer;
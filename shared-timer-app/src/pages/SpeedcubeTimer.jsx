import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Trash2, Edit3, Save, X, Timer, Grid3X3, Trophy, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor(ms % 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

const SpeedcubeTimer = () => {
    const { user, token, isGuest } = useAuth();
    const [status, setStatus] = useState('idle'); // 'idle', 'ready', 'running'
    const [time, setTime] = useState(0);
    const [history, setHistory] = useState([]);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingNoteValue, setEditingNoteValue] = useState('');
    
    const startTimeRef = useRef(0);
    const timerIdRef = useRef(null);
    const isHoldingSpaceRef = useRef(false);

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
        const newEntry = {
            id: isGuest ? Date.now() : null, // Temp ID for guest
            userId: user?.id || 'guest',
            time_ms,
            note: '',
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
                    body: JSON.stringify({ time_ms, note: '' })
                });
                if (res.ok) {
                    fetchHistory();
                }
            } catch (err) {
                console.error('Failed to save speedcube time:', err);
            }
        }
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
    }, [status, history]); // Added history to dependencies to ensure saveResult has access to it if needed (though it uses setHistory)

    return (
        <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
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
                        fontFamily: 'monospace',
                        color: status === 'ready' ? '#10b981' : (status === 'running' ? 'var(--text-main)' : 'var(--text-muted)'),
                        textShadow: status === 'ready' ? '0 0 30px rgba(16, 185, 129, 0.4)' : 'none',
                        transition: 'color 0.1s ease',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '200px'
                    }}
                >
                    {formatTime(time)}
                </div>
                
                <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                    {status === 'idle' && "Hold [Space] to get ready"}
                    {status === 'ready' && "Release [Space] to start"}
                    {status === 'running' && "Press [Space] to stop"}
                </p>

                {/* Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '32px' }}>
                    {(() => {
                        const allTimeBest = history.length > 0 ? Math.min(...history.map(h => h.time_ms)) : 0;
                        const todayStr = new Date().toISOString().split('T')[0];
                        const todayHistory = history.filter(h => h.createdAt.startsWith(todayStr));
                        const bestToday = todayHistory.length > 0 ? Math.min(...todayHistory.map(h => h.time_ms)) : 0;

                        return (
                            <>
                                <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #f59e0b' }}>
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
                                <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--accent-primary)' }}>
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
                                            {formatTime(item.time_ms)}
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

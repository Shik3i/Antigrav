import React, { useEffect, useState, useCallback } from 'react';
import { Timer, Plus, Trash2, Globe, Eye, Lock, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Countdowns = ({ user }) => {
    const { token, isGuest } = useAuth();
    const [countdowns, setCountdowns] = useState([]);
    const [guestCountdowns, setGuestCountdowns] = useState([]);
    const [now, setNow] = useState(new Date());
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formDate, setFormDate] = useState('');
    const [formTime, setFormTime] = useState('00:00');
    const [formPublic, setFormPublic] = useState(false);
    const [formLocal, setFormLocal] = useState(false);
    const [loading, setLoading] = useState(true);

    const isSuperadmin = user?.is_superadmin || false;

    // Tick every second
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Load guest countdowns from localStorage
    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem('guestCountdowns') || '[]');
            setGuestCountdowns(stored);
        } catch { setGuestCountdowns([]); }
    }, []);

    // Fetch server countdowns
    const fetchCountdowns = useCallback(async () => {
        try {
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/countdowns', { headers });
            if (res.ok) {
                const data = await res.json();
                setCountdowns(data);
            } else if (res.status === 401 || res.status === 403) {
                // If token is invalid, clear it
                console.warn('Auth failed in Countdowns');
            }
        } catch (err) {
            console.error('Failed to fetch countdowns:', err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { fetchCountdowns(); }, [fetchCountdowns]);

    const allCountdowns = [
        ...countdowns.map(c => ({ ...c, source: 'server' })),
        ...guestCountdowns.map((c, i) => ({ ...c, id: `guest-${i}`, source: 'guest', isPublic: false, isGlobal: false }))
    ].sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));

    const getTimeDiff = (targetDate) => {
        const diff = new Date(targetDate) - now;
        const absDiff = Math.abs(diff);
        const past = diff < 0;

        const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((absDiff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((absDiff / 1000 / 60) % 60);
        const seconds = Math.floor((absDiff / 1000) % 60);

        let timeStr;
        if (days > 0) timeStr = `${days}d ${hours}h ${minutes}m`;
        else if (hours > 0) timeStr = `${hours}h ${minutes}m ${seconds}s`;
        else timeStr = `${minutes}m ${seconds}s`;

        return { past, timeStr, days, hours, minutes, seconds };
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formName.trim() || !formDate) return;
        const targetDate = `${formDate}T${formTime || '00:00'}`;

        if (isGuest || formLocal) {
            // Save to localStorage
            const newCountdown = { eventName: formName.trim(), targetDate, creatorName: 'You (Local)', createdAt: new Date().toISOString() };
            const updated = [...guestCountdowns, newCountdown];
            setGuestCountdowns(updated);
            localStorage.setItem('guestCountdowns', JSON.stringify(updated));
            setShowForm(false);
        } else {
            // Save to server
            try {
                const res = await fetch('/api/countdowns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ eventName: formName.trim(), targetDate, isPublic: formPublic })
                });
                if (res.ok) {
                    await fetchCountdowns();
                    setShowForm(false);
                } else {
                    const errData = await res.json();
                    alert(`Fehler beim Erstellen: ${errData.error || res.statusText}`);
                }
            } catch (err) {
                console.error('Failed to create countdown:', err);
                alert('Netzwerkfehler beim Erstellen des Countdowns.');
            }
        }
        setFormName(''); setFormDate(''); setFormTime('00:00'); setFormPublic(false); setFormLocal(false);
    };

    const handleDelete = async (countdown) => {
        if (countdown.source === 'guest') {
            const idx = parseInt(countdown.id.split('-')[1]);
            const updated = guestCountdowns.filter((_, i) => i !== idx);
            setGuestCountdowns(updated);
            localStorage.setItem('guestCountdowns', JSON.stringify(updated));
        } else {
            try {
                const res = await fetch(`/api/countdowns/${countdown.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) await fetchCountdowns();
            } catch (err) { console.error('Failed to delete countdown:', err); }
        }
    };

    const canDelete = (c) => {
        if (c.source === 'guest') return true;
        if (isSuperadmin) return true;
        if (c.userId === user?.id) return true;
        return false;
    };

    const getBadge = (c) => {
        if (c.source === 'guest') return { label: 'Lokal', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' };
        if (c.isPublic || c.isGlobal) return { label: `Öffentlich · ${c.creatorName || 'System'}`, color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' };
        return { label: 'Privat', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Timer size={32} color="var(--accent-primary)" />
                    <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Countdowns</h1>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => setShowForm(!showForm)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', fontSize: '0.9rem' }}
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancel' : 'New Countdown'}
                </button>
            </div>

            {/* Create Form */}
            {showForm && (
                <form onSubmit={handleCreate} className="glass-card" style={{ padding: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Event name..."
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            required
                            style={{
                                flex: 2, minWidth: '200px', padding: '12px 16px',
                                background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)',
                                borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none'
                            }}
                        />
                        <input
                            type="date"
                            value={formDate}
                            onChange={(e) => setFormDate(e.target.value)}
                            required
                            style={{
                                flex: 1, minWidth: '160px', padding: '12px 16px',
                                background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)',
                                borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none',
                                colorScheme: 'dark'
                            }}
                        />
                        <input
                            type="time"
                            value={formTime}
                            onChange={(e) => setFormTime(e.target.value)}
                            step="60"
                            lang="de"
                            style={{
                                minWidth: '120px', padding: '12px 16px',
                                background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)',
                                borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none',
                                colorScheme: 'dark'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        {!isGuest && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                <input type="checkbox" checked={formLocal} onChange={(e) => setFormLocal(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                <Lock size={16} /> Nur lokal speichern
                            </label>
                        )}
                        {isSuperadmin && !formLocal && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: '#8b5cf6' }}>
                                <input type="checkbox" checked={formPublic} onChange={(e) => setFormPublic(e.target.checked)} style={{ accentColor: '#8b5cf6' }} />
                                <Globe size={16} /> Öffentlich machen
                            </label>
                        )}
                        <button type="submit" className="btn-primary" style={{ marginLeft: 'auto', padding: '10px 24px', borderRadius: '8px', fontSize: '0.9rem' }}>
                            Erstellen
                        </button>
                    </div>
                </form>
            )}

            {/* Countdown List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading countdowns...</div>
            ) : allCountdowns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    <Timer size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ fontSize: '1.1rem' }}>No countdowns yet.</p>
                    <p style={{ fontSize: '0.9rem' }}>Create your first countdown to track upcoming events!</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {allCountdowns.map((c) => {
                        const { past, timeStr } = getTimeDiff(c.targetDate);
                        const badge = getBadge(c);

                        return (
                            <div
                                key={c.id}
                                className="glass-card"
                                style={{
                                    padding: '18px 24px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    gap: '16px',
                                    opacity: past ? 0.6 : 1,
                                    borderLeft: `3px solid ${past ? '#6b7280' : badge.color}`,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px',
                                            background: badge.bg, color: badge.color, fontWeight: 600
                                        }}>
                                            {badge.label}
                                        </span>
                                        <span style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {c.eventName}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {new Date(c.targetDate).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{
                                            fontWeight: 700, fontSize: '1.1rem',
                                            color: past ? '#ef4444' : 'var(--accent-primary)',
                                            fontFamily: '"Outfit", sans-serif'
                                        }}>
                                            {past ? `vor ${timeStr}` : `in ${timeStr}`}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {past ? 'abgelaufen' : 'verbleibend'}
                                        </div>
                                    </div>
                                    {canDelete(c) && (
                                        <button
                                            onClick={() => handleDelete(c)}
                                            style={{
                                                background: 'rgba(239,68,68,0.1)', border: 'none',
                                                borderRadius: '8px', padding: '8px', cursor: 'pointer',
                                                color: '#ef4444', display: 'flex', alignItems: 'center',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                            title="Delete countdown"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Countdowns;

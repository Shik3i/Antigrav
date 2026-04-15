import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Trophy, Medal, Award, Crown, CheckCircle2, Clock, Calendar, Gift, Lock, Timer, Gamepad2, Swords, ChevronDown, Settings } from 'lucide-react';
import { usePageVisibility } from '../hooks/usePageVisibility';

const CHAIN_META = {
    timer:     { label: '⏱️ Timer-Abschlüsse',     color: '#3b82f6' },
    esports:   { label: '⚔️ Esports-Wetten',        color: '#a855f7' },
    koalaflap: { label: '🎮 KoalaFlap Minigame',    color: '#f59e0b' },
    special:   { label: '🌟 Spezial-Erfolge',        color: '#ec4899' },
};

const formatCoins = (cents) => (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Achievements = () => {
    const { token, user, setUser } = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const [error, setError] = useState(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const [hoveredCard, setHoveredCard] = useState(null);
    const isVisible = usePageVisibility();

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/achievements/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to load achievements');
            const data = await res.json();
            setStatus(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, isVisible ? 60000 : 10 * 60000);
        return () => clearInterval(interval);
    }, [isVisible, token]);

    const handleClaim = async (id, isDaily = false) => {
        if (claiming) return;
        setClaiming(true);
        try {
            const res = await fetch(`/api/achievements/claim/${id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to claim');

            // Update global balance so the floating panel reacts immediately
            if (data.newBalance !== undefined) {
                setUser(prev => ({ ...prev, koala_balance: data.newBalance }));
            }

            // Optimistic update
            if (isDaily) {
                setStatus(p => ({ ...p, daily: { ...p.daily, available: false } }));
            } else {
                // Re-fetch to get the chain update (next milestone may appear)
                await fetchStatus();
            }
        } catch (err) {
            const isAlreadyClaimed = err.message.toLowerCase().includes('already claimed') || err.message.toLowerCase().includes('already');
            setError(isAlreadyClaimed ? '⚠️ Fehler: Dieser Meilenstein wurde bereits eingelöst!' : err.message);
            // Always re-fetch after any claim error to sync stale state
            await fetchStatus();
            setTimeout(() => setError(null), 4000);
        } finally {
            setClaiming(false);
        }
    };

    if (loading) return <div className="flex-center" style={{ height: '50vh' }}><h3>Lade Erfolge...</h3></div>;
    if (error && !status) return <div className="glass-panel" style={{ color: '#ef4444' }}>{error}</div>;

    const getIcon = (iconName) => {
        const icons = { Trophy, Medal, Award, Crown };
        const IconComponent = icons[iconName] || Trophy;
        return <IconComponent size={24} />;
    };

    // Separate active milestones (not claimed) and completed milestones
    const activeMilestones = (status?.milestones || []).filter(m => !m.isClaimed);
    const completedMilestones = (status?.milestones || []).filter(m => m.isClaimed);

    // Group active milestones by chain
    const activeByChain = {};
    activeMilestones.forEach(m => {
        const chainKey = m.chain.includes('_') ? m.chain.split('_')[0] : m.chain;
        if (!activeByChain[chainKey]) activeByChain[chainKey] = [];
        activeByChain[chainKey].push(m);
    });

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Gift size={32} color="var(--accent-primary)" />
                    <h1 style={{ margin: 0, fontSize: '2rem', backgroundImage: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Belohnungen & Erfolge
                    </h1>
                </div>

                {user?.is_superadmin && (user.username?.toLowerCase() === 'koala' || user.username === '123') && (
                    <button 
                        className="btn-ghost" 
                        onClick={() => navigate('/admin/achievements')}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                    >
                        <Settings size={18} /> Achievements verwalten
                    </button>
                )}
            </div>

            {error && (
                <div style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.5)', textAlign: 'center' }}>
                    {error}
                </div>
            )}

            {/* Daily Bonus Section */}
            <div className="glass-panel" style={{
                background: status?.daily?.available ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.2))' : 'var(--panel-bg)',
                border: status?.daily?.available ? '1px solid rgba(16, 185, 129, 0.5)' : undefined,
                display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: status?.daily?.available ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Calendar size={32} color={status?.daily?.available ? '#10b981' : '#64748b'} />
                    </div>
                    <div>
                        <h2 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Täglicher Login-Bonus
                            {status?.daily?.available && <span style={{ fontSize: '0.75rem', background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>NEU</span>}
                        </h2>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                            Komm jeden Tag zurück, um deinen Fokus-Bonus in Höhe von 1 Stunde Timer-Zeit abzuholen!
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '150px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>
                            +{formatCoins(status?.daily?.rewardCoins || 0)}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>KC</span>
                    </div>
                    {status?.daily?.available ? (
                        <button
                            className="btn-primary"
                            style={{ width: '100%', padding: '0.75rem', fontWeight: 'bold', background: '#10b981', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
                            onClick={() => handleClaim('daily', true)}
                            disabled={claiming}
                        >
                            Bonus Abholen
                        </button>
                    ) : (
                        <button
                            className="btn-ghost"
                            style={{ width: '100%', padding: '0.75rem', opacity: 0.7, cursor: 'not-allowed', background: 'rgba(255,255,255,0.05)' }}
                            disabled
                        >
                            <Clock size={16} /> Bis Morgen
                        </button>
                    )}
                </div>
            </div>

            {/* Active Milestones by Chain */}
            <h2 style={{ marginTop: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Aktuelle Ziele</h2>

            {Object.keys(activeByChain).length === 0 && (
                <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    🎉 Alle verfügbaren Meilensteine abgeschlossen! Schau später wieder vorbei.
                </div>
            )}

            {Object.entries(CHAIN_META).map(([chainKey, meta]) => {
                const chainMilestones = activeByChain[chainKey];
                if (!chainMilestones || chainMilestones.length === 0) return null;

                return (
                    <div key={chainKey}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: meta.color, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {meta.label}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {chainMilestones.map((m) => {
                                const isHovered = hoveredCard === m.id;
                                return (
                                    <div 
                                        key={m.id} 
                                        className="glass-panel hover-card" 
                                        onMouseEnter={() => setHoveredCard(m.id)}
                                        onMouseLeave={() => setHoveredCard(null)}
                                        style={{
                                            position: 'relative', 
                                            overflow: 'hidden',
                                            padding: '24px',
                                            borderRadius: '24px',
                                            background: isHovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                                            border: m.isCompleted ? `1px solid ${meta.color}` : isHovered ? `1px solid ${meta.color}60` : '1px solid rgba(255,255,255,0.08)',
                                            transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
                                            boxShadow: isHovered ? `0 12px 24px -10px ${meta.color}50` : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                                            <div style={{
                                                width: '56px', height: '56px', borderRadius: '16px',
                                                background: `${meta.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: meta.color, flexShrink: 0,
                                                boxShadow: isHovered ? `inset 0 0 10px ${meta.color}30` : 'none',
                                                transition: 'all 0.3s ease'
                                            }}>
                                                {getIcon(m.icon)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: 700, color: isHovered ? meta.color : 'var(--text-main)', transition: 'color 0.3s ease' }}>{m.title}</h3>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{m.description}</p>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', height: '10px', overflow: 'hidden', marginBottom: '12px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
                                            <div style={{
                                                height: '100%',
                                                background: m.isCompleted ? '#10b981' : `linear-gradient(90deg, ${meta.color}90, ${meta.color})`,
                                                width: `${Math.min(100, (m.currentProgress / m.requiredCount) * 100)}%`,
                                                borderRadius: '12px',
                                                boxShadow: `0 0 10px ${m.isCompleted ? '#10b981' : meta.color}80`,
                                                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }} />
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px', fontWeight: 500 }}>
                                            <span style={{ color: m.isCompleted ? '#10b981' : 'var(--text-muted)' }}>{m.currentProgress} <span style={{ opacity: 0.5 }}>/</span> {m.requiredCount}</span>
                                            <span style={{ color: '#f59e0b', fontWeight: 800, background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '8px' }}>+{formatCoins(m.rewardCoins)} KC</span>
                                        </div>

                                        <button
                                            className={m.isCompleted ? 'btn-primary' : 'btn-ghost'}
                                            style={{ 
                                                width: '100%', 
                                                padding: '12px', 
                                                opacity: m.isCompleted ? 1 : 0.6,
                                                borderRadius: '12px',
                                                fontWeight: 700,
                                                transition: 'all 0.2s ease',
                                                background: !m.isCompleted && isHovered ? 'rgba(255,255,255,0.08)' : undefined
                                            }}
                                            disabled={!m.isCompleted || claiming}
                                            onClick={() => handleClaim(m.id)}
                                        >
                                            {m.isCompleted ? 'Meilenstein Abholen' : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Lock size={16} /> Noch nicht erreicht</span>}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {/* Completed Milestones Section */}
            {completedMilestones.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        style={{
                            width: '100%', background: 'none', border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)', padding: '1rem', borderRadius: '12px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s ease'
                        }}
                    >
                        <span>✅ Abgeschlossene Meilensteine ({completedMilestones.length})</span>
                        <ChevronDown size={20} style={{ transform: showCompleted ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }} />
                    </button>

                    {showCompleted && (
                        <div style={{
                            marginTop: '1rem',
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem'
                        }}>
                            {completedMilestones.map((m) => {
                                const meta = CHAIN_META[m.chain] || { label: '', color: '#6b7280' };
                                return (
                                    <div key={m.id} style={{
                                        padding: '1rem 1.25rem',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '12px',
                                        opacity: 0.7,
                                        display: 'flex', gap: '1rem', alignItems: 'center'
                                    }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '10px',
                                            background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#10b981', flexShrink: 0
                                        }}>
                                            <CheckCircle2 size={22} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {m.title}
                                                <span style={{ fontSize: '0.7rem', color: meta.color, background: `${meta.color}15`, padding: '2px 6px', borderRadius: '6px' }}>
                                                    {meta.label}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                +{formatCoins(m.rewardCoins)} KC erhalten
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Achievements;

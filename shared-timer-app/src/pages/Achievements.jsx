import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Trophy, Medal, Award, Crown, CheckCircle2, Clock, Calendar, Gift, Lock, Timer, Gamepad2, Swords, ChevronDown, Settings, Shield } from 'lucide-react';
import { usePageVisibility } from '../hooks/usePageVisibility';

const CHAIN_META = {
    timer:     { label: '⏱️ Timer-Abschlüsse',     color: '#3b82f6', Icon: Timer },
    esports:   { label: '⚔️ Esports-Wetten',        color: '#a855f7', Icon: Swords },
    koalaflap: { label: '🎮 KoalaFlap Minigame',    color: '#f59e0b', Icon: Gamepad2 },
    special:   { label: '🌟 Spezial-Erfolge',        color: '#ec4899', Icon: Award },
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
        if (!token) {
            setLoading(false);
            return;
        }
        
        try {
            const res = await fetch('/api/achievements/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.status === 401 || res.status === 403) {
                setError('Sitzung abgelaufen. Bitte logge dich erneut ein.');
                return;
            }
            
            if (!res.ok) throw new Error('Failed to load achievements');
            const data = await res.json();
            setStatus(data);
            setError(null);
        } catch (err) {
            setError(err.message === 'Failed to load achievements' 
                ? 'Fehler beim Laden der Erfolge. Bitte lade die Seite neu.' 
                : err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }
        
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

            if (data.newBalance !== undefined) {
                setUser(prev => ({ ...prev, koala_balance: data.newBalance }));
            }

            if (isDaily) {
                setStatus(p => ({ ...p, daily: { ...p.daily, available: false } }));
            } else {
                await fetchStatus();
            }
        } catch (err) {
            const isAlreadyClaimed = err.message.toLowerCase().includes('already claimed') || err.message.toLowerCase().includes('already');
            setError(isAlreadyClaimed ? '⚠️ Fehler: Dieser Meilenstein wurde bereits eingelöst!' : err.message);
            await fetchStatus();
            setTimeout(() => setError(null), 4000);
        } finally {
            setClaiming(false);
        }
    };

    if (loading) return <div className="flex-center" style={{ height: '50vh' }}><h3>Lade Erfolge...</h3></div>;
    
    if (!token) {
        return (
            <div className="flex-center animate-fade-in" style={{ minHeight: '60vh', flexDirection: 'column', gap: '2rem' }}>
                <div className="glass-card" style={{ 
                    maxWidth: '500px', 
                    textAlign: 'center', 
                    padding: '3rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                }}>
                    <div style={{ 
                        width: '80px', height: '80px', borderRadius: '50%', 
                        background: 'rgba(59, 130, 246, 0.1)', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem',
                        color: 'var(--accent-primary)'
                    }}>
                        <Lock size={40} />
                    </div>
                    <h2 style={{ marginBottom: '1rem' }}>Exklusive Erfolge</h2>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
                        Bitte logge dich ein, um deine persönlichen Erfolge zu tracken, tägliche Belohnungen abzuholen und Meilensteine in KoalaCoins einzulösen.
                    </p>
                    <button 
                        className="btn-primary" 
                        onClick={() => navigate('/login')}
                        style={{ width: '100%', padding: '1rem', fontWeight: 'bold' }}
                    >
                        Jetzt Anmelden
                    </button>
                </div>
            </div>
        );
    }

    if (error && !status) return (
        <div className="flex-center" style={{ minHeight: '40vh' }}>
            <div className="glass-card" style={{ color: '#ef4444', textAlign: 'center', padding: '2rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <Shield size={32} style={{ marginBottom: '1rem' }} />
                <p>{error}</p>
                <button className="btn-ghost" onClick={() => fetchStatus()} style={{ marginTop: '1rem' }}>Erneut versuchen</button>
            </div>
        </div>
    );

    const getIcon = (iconName) => {
        const icons = { Trophy, Medal, Award, Crown };
        const IconComponent = icons[iconName] || Trophy;
        return <IconComponent size={24} />;
    };

    const activeMilestones = (status?.milestones || []).filter(m => !m.isClaimed);
    const completedMilestones = (status?.milestones || []).filter(m => m.isClaimed);

    const activeByChain = {};
    activeMilestones.forEach(m => {
        const chainKey = m.chain.includes('_') ? m.chain.split('_')[0] : m.chain;
        if (!activeByChain[chainKey]) activeByChain[chainKey] = [];
        activeByChain[chainKey].push(m);
    });

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '4rem' }}>
            <header className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '16px', color: 'var(--accent-primary)' }}>
                        <Gift size={32} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: 800, backgroundImage: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Belohnungen & Erfolge
                        </h1>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>Meistere Aufgaben und schalte wertvolle KoalaCoins frei.</p>
                    </div>
                </div>

                {user?.is_superadmin && (user.username?.toLowerCase() === 'koala' || user.username === '123') && (
                    <button 
                        className="btn-ghost" 
                        onClick={() => navigate('/admin/achievements')}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '14px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', fontWeight: 600 }}
                    >
                        <Settings size={18} /> Verwalten
                    </button>
                )}
            </header>

            {error && (
                <div className="animate-slide-up" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(239,68,68,0.3)', textAlign: 'center', fontWeight: 500 }}>
                    {error}
                </div>
            )}

            {/* Daily Bonus Section */}
            <section className="glass-card-premium animate-slide-up" style={{
                background: status?.daily?.available 
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.22))' 
                    : 'rgba(255,255,255,0.02)',
                border: status?.daily?.available ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'space-between',
                padding: '32px'
            }}>
                <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '22px',
                        background: status?.daily?.available ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: status?.daily?.available ? '0 0 20px rgba(16, 185, 129, 0.2)' : 'none'
                    }}>
                        <Calendar size={36} color={status?.daily?.available ? '#10b981' : '#64748b'} />
                    </div>
                    <div>
                        <h2 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem' }}>
                            Täglicher Login-Bonus
                            {status?.daily?.available && (
                                <span style={{ fontSize: '0.7rem', background: '#10b981', color: 'white', padding: '3px 10px', borderRadius: '20px', fontWeight: 800, letterSpacing: '0.05em', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
                                    BEREIT
                                </span>
                            )}
                        </h2>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '450px', lineHeight: 1.5 }}>
                            Komm jeden Tag zurück, um deinen Fokus-Bonus abzuholen! Ein kleiner Dank für deine Kontinuität.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '-0.02em' }}>
                            +{formatCoins(status?.daily?.rewardCoins || 0)}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 700 }}>KC</span>
                    </div>
                    {status?.daily?.available ? (
                        <button
                            className="btn-primary"
                            style={{ width: '100%', padding: '1rem', fontWeight: 800, background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)', borderRadius: '14px' }}
                            onClick={() => handleClaim('daily', true)}
                            disabled={claiming}
                        >
                            Bonus Abholen
                        </button>
                    ) : (
                        <div style={{ 
                            width: '100%', padding: '1rem', borderRadius: '14px', 
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
                            color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 
                        }}>
                            <Clock size={16} /> Bis Morgen
                        </div>
                    )}
                </div>
            </section>

            {/* Active Milestones by Chain */}
            <div className="animate-fade-in" style={{ marginTop: '1rem' }}>
                <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Medal size={20} /> Aktuelle Ziele
                </h2>

                {Object.keys(activeByChain).length === 0 && (
                    <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem', background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed' }}>
                        <Trophy size={48} style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
                        <p style={{ fontSize: '1.1rem' }}>🎉 Alle verfügbaren Meilensteine abgeschlossen!</p>
                        <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Schau später wieder vorbei für neue Herausforderungen.</p>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                    {Object.entries(CHAIN_META).map(([chainKey, meta]) => {
                        const chainMilestones = activeByChain[chainKey];
                        if (!chainMilestones || chainMilestones.length === 0) return null;

                        return (
                            <div key={chainKey} className="animate-slide-up">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div style={{ padding: '8px', background: `${meta.color}15`, borderRadius: '10px', color: meta.color }}>
                                        <meta.Icon size={20} />
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                        {meta.label}
                                    </h3>
                                    <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${meta.color}30, transparent)` }} />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                    {chainMilestones.map((m) => {
                                        const isHovered = hoveredCard === m.id;
                                        return (
                                            <div 
                                                key={m.id} 
                                                className="glass-card-premium" 
                                                onMouseEnter={() => setHoveredCard(m.id)}
                                                onMouseLeave={() => setHoveredCard(null)}
                                                style={{
                                                    padding: '24px',
                                                    background: isHovered ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                                                    border: m.isCompleted ? `1px solid ${meta.color}80` : isHovered ? `1px solid ${meta.color}40` : '1px solid rgba(255,255,255,0.05)',
                                                    boxShadow: m.isCompleted ? `0 8px 32px ${meta.color}15` : isHovered ? `0 8px 32px rgba(0,0,0,0.3)` : 'none'
                                                }}
                                            >
                                                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem' }}>
                                                    <div style={{
                                                        width: '56px', height: '56px', borderRadius: '16px',
                                                        background: m.isCompleted ? meta.color : `${meta.color}15`, 
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: m.isCompleted ? '#fff' : meta.color, flexShrink: 0,
                                                        boxShadow: m.isCompleted ? `0 4px 15px ${meta.color}40` : 'none',
                                                        transition: 'all 0.3s ease'
                                                    }}>
                                                        {getIcon(m.icon)}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <h4 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>{m.title}</h4>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{m.description}</p>
                                                    </div>
                                                </div>

                                                {/* Progress Bar Container */}
                                                <div style={{ marginBottom: '1.25rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '8px', fontWeight: 700 }}>
                                                        <span style={{ color: m.isCompleted ? '#10b981' : 'var(--text-muted)' }}>
                                                            {m.currentProgress} <span style={{ opacity: 0.3 }}>/</span> {m.requiredCount}
                                                        </span>
                                                        <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                                                            +{formatCoins(m.rewardCoins)} KC
                                                        </span>
                                                    </div>
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '20px', height: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <div style={{
                                                            height: '100%',
                                                            background: m.isCompleted ? 'linear-gradient(90deg, #10b981, #34d399)' : `linear-gradient(90deg, ${meta.color}90, ${meta.color})`,
                                                            width: `${Math.min(100, (m.currentProgress / m.requiredCount) * 100)}%`,
                                                            borderRadius: '20px',
                                                            boxShadow: `0 0 10px ${m.isCompleted ? '#10b981' : meta.color}50`,
                                                            transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
                                                        }} />
                                                    </div>
                                                </div>

                                                <button
                                                    className={m.isCompleted ? 'btn-primary' : 'btn-ghost'}
                                                    style={{ 
                                                        width: '100%', 
                                                        padding: '12px', 
                                                        borderRadius: '12px',
                                                        fontWeight: 800,
                                                        fontSize: '0.9rem',
                                                        transition: 'all 0.2s ease',
                                                        ...(m.isCompleted ? {
                                                            background: `linear-gradient(135deg, ${meta.color}, ${meta.color}dd)`,
                                                            boxShadow: `0 5px 15px ${meta.color}30`
                                                        } : {
                                                            background: 'rgba(255,255,255,0.03)',
                                                            border: '1px solid rgba(255,255,255,0.05)',
                                                            color: 'var(--text-muted)',
                                                            cursor: 'default'
                                                        })
                                                    }}
                                                    disabled={!m.isCompleted || claiming}
                                                    onClick={() => handleClaim(m.id)}
                                                >
                                                    {m.isCompleted ? 'Belohnung Einlösen' : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: 0.7 }}><Lock size={14} /> Gesperrt</span>}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Completed Milestones Section */}
            {completedMilestones.length > 0 && (
                <section className="animate-fade-in" style={{ marginTop: '2rem' }}>
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="glass-card"
                        style={{
                            width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)', padding: '1.25rem', borderRadius: '16px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s ease'
                        }}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <CheckCircle2 size={20} color="#10b981" /> 
                            Bereits Abgeschlossen ({completedMilestones.length})
                        </span>
                        <ChevronDown size={20} style={{ transform: showCompleted ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s ease' }} />
                    </button>

                    {showCompleted && (
                        <div className="animate-slide-up" style={{
                            marginTop: '1.5rem',
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem'
                        }}>
                            {completedMilestones.map((m) => {
                                const meta = CHAIN_META[m.chain] || { label: '', color: '#6b7280' };
                                return (
                                    <div key={m.id} style={{
                                        padding: '1.25rem',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: '16px',
                                        display: 'flex', gap: '1.25rem', alignItems: 'center',
                                        opacity: 0.8
                                    }}>
                                        <div style={{
                                            width: '44px', height: '44px', borderRadius: '12px',
                                            background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#10b981', flexShrink: 0
                                        }}>
                                            <Trophy size={20} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', marginBottom: '4px' }}>{m.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                {meta.label}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default Achievements;

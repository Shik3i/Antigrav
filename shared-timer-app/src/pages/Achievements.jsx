import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Trophy, Medal, Award, Crown, CheckCircle2, Clock, Calendar, Gift, Lock, Timer, Gamepad2, Swords, ChevronDown, Settings, Shield, Cookie, Ghost, Quote } from 'lucide-react';
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

    // Fortune Cookie State
    const [fortune, setFortune] = useState({ opened: false, text: null, loading: true });
    const [cookieState, setCookieState] = useState('idle'); // idle, cracking, opened
    const [showConfetti, setShowConfetti] = useState(false);
    const [isOpening, setIsOpening] = useState(false);

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

    const fetchFortune = async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/fortune/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFortune({ opened: data.opened, text: data.text, loading: false });
                if (data.opened) setCookieState('opened');
            }
        } catch (err) {
            console.error('Failed to fetch fortune:', err);
        }
    };

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }
        
        fetchStatus();
        fetchFortune();
        const interval = setInterval(() => {
            fetchStatus();
            fetchFortune();
        }, isVisible ? 60000 : 10 * 60000);
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

    const handleOpenCookie = async () => {
        if (fortune.opened || cookieState !== 'idle' || isOpening) return;
        
        setIsOpening(true);
        setCookieState('cracking');
        
        // Wait for wiggle animation
        await new Promise(r => setTimeout(r, 800));
        
        try {
            const res = await fetch('/api/fortune/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Re-check status to prevent double-fire
            const currentStatus = await res.json();
            if (currentStatus.opened) {
               setFortune({ ...currentStatus, loading: false });
               setCookieState('opened');
               setIsOpening(false);
               return;
            }

            const openRes = await fetch('/api/fortune/open', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await openRes.json();
            
            if (openRes.ok) {
                setFortune({ opened: true, text: data.text, loading: false });
                setCookieState('opened');
                setShowConfetti(true);
                
                // If a reward was granted, update balance
                if (data.reward && data.newBalance !== undefined) {
                    setUser(prev => ({ ...prev, koala_balance: data.newBalance }));
                }
                
                // Update local daily status
                setStatus(prev => ({ 
                    ...prev, 
                    daily: { ...prev.daily, available: false } 
                }));

                setTimeout(() => setShowConfetti(false), 3000);
            } else {
                setError(data.error);
                setCookieState('idle');
            }
        } catch (err) {
            setError('Fehler beim Öffnen des Glückskekses.');
            setCookieState('idle');
        } finally {
            setIsOpening(false);
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
                <div className="animate-slide-up" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(239,68,68,0.3)', textAlign: 'center', fontWeight: 500, marginBottom: '24px' }}>
                    {error}
                </div>
            )}

            <div className="animate-fade-in" style={{ marginBottom: '2rem' }}>
                {/* Consolidated Daily Fortune Cookie Section */}
                <section className="glass-card-premium" style={{
                    background: !fortune.opened 
                        ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.18))' 
                        : 'rgba(255,255,255,0.02)',
                    border: !fortune.opened ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', flexDirection: 'column', gap: '1.5rem',
                    padding: '32px', minHeight: '200px', justifyContent: 'space-between',
                    position: 'relative', overflow: 'hidden',
                    boxShadow: !fortune.opened ? '0 15px 35px rgba(245, 158, 11, 0.1)' : 'none'
                }}>
                    {showConfetti && <div className="confetti-container">
                        {[...Array(20)].map((_, i) => <div key={i} className="confetti" style={{
                            left: `${Math.random() * 100}%`,
                            backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ec4899'][Math.floor(Math.random() * 4)],
                            animationDelay: `${Math.random() * 2}s`
                        }} />)}
                    </div>}

                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div 
                            className={`cookie-wrapper ${cookieState}`} 
                            onClick={handleOpenCookie}
                            style={{
                                width: '80px', height: '80px', borderRadius: '24px',
                                background: !fortune.opened ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: (fortune.opened || fortune.loading || isOpening) ? 'default' : 'pointer',
                                boxShadow: !fortune.opened ? '0 12px 24px rgba(245, 158, 11, 0.25)' : 'none',
                                transition: 'all 0.4s ease',
                                flexShrink: 0
                            }}
                        >
                            {cookieState === 'opened' ? (
                                <Ghost size={40} color="rgba(255,255,255,0.2)" />
                            ) : (
                                <Cookie size={40} color="#f59e0b" className={cookieState === 'idle' ? 'pulse-cookie' : 'wiggle-cookie'} />
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: '250px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900 }}>Täglicher Glückskeks</h3>
                                {!fortune.opened && !fortune.loading && (
                                    <span className="animate-pulse" style={{ fontSize: '0.7rem', background: '#f59e0b', color: 'white', padding: '4px 10px', borderRadius: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Verfügbar
                                    </span>
                                )}
                            </div>
                            <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                {fortune.opened 
                                    ? 'Du hast deine Belohnung bereits erhalten. Komm morgen wieder für einen neuen Keks!' 
                                    : `Öffne deinen heutigen Glückskeks für eine Weisheit und den täglichen Bonus von ${formatCoins(status?.daily?.rewardCoins || 1000)} KC.`}
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 900, fontSize: '1.4rem', background: 'rgba(245, 158, 11, 0.1)', padding: '12px 20px', borderRadius: '16px' }}>
                             <Trophy size={24} /> +{formatCoins(status?.daily?.rewardCoins || 1000)} KC
                        </div>
                    </div>

                    <div style={{ flex: 1, marginTop: '10px' }}>
                        {fortune.opened ? (
                            <div className="fortune-paper-slide-in" style={{
                                background: 'rgba(0,0,0,0.3)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '24px 32px',
                                borderRadius: '20px',
                                borderLeft: '6px solid #f59e0b',
                                color: '#fff',
                                fontStyle: 'italic',
                                fontSize: '1.1rem',
                                lineHeight: 1.6,
                                boxShadow: '0 15px 40px rgba(0,0,0,0.5)',
                                position: 'relative'
                            }}>
                                <Quote size={24} style={{ opacity: 0.2, position: 'absolute', top: '12px', left: '8px' }} />
                                {fortune.text}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                                <button
                                    className="btn-primary"
                                    style={{ 
                                        padding: '1rem 4rem', 
                                        fontSize: '1.2rem',
                                        fontWeight: 900, 
                                        background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                                        borderRadius: '16px',
                                        boxShadow: '0 10px 25px rgba(245, 158, 11, 0.3)',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onClick={handleOpenCookie}
                                    disabled={isOpening}
                                >
                                    {isOpening ? 'Öffne...' : 'Keks knacken & +10 KC abholen'}
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            </div>

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

const styles = `
    @keyframes pulse-cookie {
        0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(245, 158, 11, 0)); }
        50% { transform: scale(1.08); filter: drop-shadow(0 0 15px rgba(245, 158, 11, 0.5)); }
        100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(245, 158, 11, 0)); }
    }
    .pulse-cookie {
        animation: pulse-cookie 2s infinite ease-in-out;
    }
    @keyframes wiggle-cookie {
        0%, 100% { transform: rotate(0); }
        20% { transform: rotate(-10deg); }
        40% { transform: rotate(10deg); }
        60% { transform: rotate(-10deg); }
        80% { transform: rotate(10deg); }
    }
    .wiggle-cookie {
        animation: wiggle-cookie 0.15s infinite linear;
    }
    @keyframes fortune-slide-in {
        from { transform: translateY(10px); opacity: 0; filter: blur(5px); }
        to { transform: translateY(0); opacity: 1; filter: blur(0); }
    }
    .fortune-paper-slide-in {
        animation: fortune-slide-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .daily-rewards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
    }
    @media (max-width: 850px) {
        .daily-rewards-grid {
            grid-template-columns: 1fr;
        }
    }
    .confetti-container {
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        pointer-events: none;
        z-index: 10;
    }
    .confetti {
        position: absolute;
        width: 8px; height: 8px;
        top: -10px;
        animation: confetti-fall 3s linear forwards;
    }
    @keyframes confetti-fall {
        from { transform: translateY(0) rotate(0); }
        to { transform: translateY(400px) rotate(720deg); opacity: 0; }
    }
`;

// Inject styles
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default Achievements;

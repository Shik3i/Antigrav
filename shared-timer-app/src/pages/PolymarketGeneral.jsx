import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Link as LinkIcon, ExternalLink, TrendingUp, Search, Calendar, Hash, Info, AlertTriangle, Users, ChevronDown, ChevronUp, Trash2, CheckCircle } from 'lucide-react';
import Avatar from '../components/Avatar';

const PolymarketGeneral = () => {
    const [bets, setBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({ title: '', url: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [betAmounts, setBetAmounts] = useState({}); // { 'betId-idx': 100 }
    const [bettingStatus, setBettingStatus] = useState({}); // { 'betId-idx': 'idle' | 'loading' | 'success' | 'error' }
    const [expandedBetId, setExpandedBetId] = useState(null);
    const [currentBet, setCurrentBet] = useState({ outcomeIndex: 0, amount: '' });
    const [currentUser, setCurrentUser] = useState(null);
    const [showUserBetsId, setShowUserBetsId] = useState(null);
    const [resovledAccordionOpen, setResolvedAccordionOpen] = useState(false);

    const fetchBets = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/polymarket/general');
            setBets(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch general bets:', err);
            setError('Gegebenenfalls konnten die Wetten nicht geladen werden.');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBets();
        fetchCurrentUser();
    }, []);

    const fetchCurrentUser = async () => {
        const token = localStorage.getItem('timerToken');
        if (!token) return;
        try {
            const res = await axios.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCurrentUser(res.data);
        } catch (err) {
            console.error('Failed to fetch user:', err);
        }
    };

    const handleAddBet = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const token = localStorage.getItem('timerToken');
        if (!token) {
            setError('Du musst eingeloggt sein, um eine Wette hinzuzufügen.');
            setIsSubmitting(false);
            return;
        }

        try {
            await axios.post('/api/polymarket/general', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFormData({ title: '', url: '' });
            setShowAddForm(false);
            fetchBets();
        } catch (err) {
            console.error('Failed to add bet:', err);
            setError(err.response?.data?.error || 'Fehler beim Hinzufügen der Wette. Bitte prüfe den Link.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePlaceBet = async (betId) => {
        const { outcomeIndex, amount } = currentBet;
        
        const betAmount = parseInt(amount);
        if (isNaN(betAmount) || betAmount <= 0) {
            alert('Bitte einen gültigen Wetteinsatz eingeben.');
            return;
        }

        const token = localStorage.getItem('timerToken');
        if (!token) {
            alert('Bitte einloggen, um zu wetten.');
            return;
        }

        setBettingStatus(prev => ({ ...prev, [betId]: 'loading' }));

        try {
            await axios.post('/api/polymarket/general/bet', {
                betId,
                outcomeIndex: parseInt(outcomeIndex),
                amount: betAmount
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setBettingStatus(prev => ({ ...prev, [betId]: 'success' }));
            setCurrentBet({ outcomeIndex: 0, amount: '' });
            
            alert(`Wette erfolgreich platziert! ${betAmount} KC wurden abgezogen.`);
            
            setTimeout(() => {
                setBettingStatus(prev => ({ ...prev, [betId]: 'idle' }));
            }, 3000);

        } catch (err) {
            console.error('Betting failed:', err);
            setBettingStatus(prev => ({ ...prev, [betId]: 'error' }));
            alert(err.response?.data?.error || 'Wette konnte nicht platziert werden.');
        }
    };

    const handleDeleteBet = async (betId) => {
        if (!window.confirm('Wette wirklich löschen? Alle zugehörigen Nutzerwetten werden ebenfalls entfernt.')) return;

        const token = localStorage.getItem('timerToken');
        try {
            await axios.delete(`/api/polymarket/general/${betId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchBets();
        } catch (err) {
            alert('Löschen fehlgeschlagen: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleResolveBet = async (betId) => {
        const token = localStorage.getItem('timerToken');
        try {
            const res = await axios.post('/api/polymarket/general/resolve', { id: betId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                alert(res.data.message);
                fetchBets();
            } else {
                alert(res.data.message || 'Check abgeschlossen: Markt noch offen.');
            }
        } catch (err) {
            alert('Resolution fehlgeschlagen: ' + (err.response?.data?.error || err.message));
        }
    };

    const filteredBets = bets.filter(bet => 
        bet.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        bet.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeBets = filteredBets.filter(b => b.status !== 'resolved');
    const resolvedBets = filteredBets.filter(b => b.status === 'resolved');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
            {/* Header section with Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '8px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Polymarket General
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                        Community-gesteuerte Polymarket-Wetten für alle Themen.
                    </p>
                    <a 
                        href="https://polymarket.com" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', marginTop: '8px' }}
                        className="hover-underline"
                    >
                        <ExternalLink size={14} />
                        Direkt zu Polymarket.com
                    </a>
                </div>
                {currentUser && (
                    <button 
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="btn-primary" 
                        style={{ padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--accent-glow)' }}
                    >
                        <Plus size={20} />
                        Wette hinzufügen
                    </button>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444' }}>
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Add Form */}
            {showAddForm && (
                <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', animation: 'slideDown 0.3s ease' }}>
                    <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <LinkIcon size={20} color="var(--accent-primary)" />
                        Neue Polymarket Wette hinzufügen
                    </h3>
                    <form onSubmit={handleAddBet} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Name der Wette</label>
                            <input 
                                className="input-field" 
                                type="text" 
                                placeholder="Z. B. US Wahl 2024" 
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Polymarket URL</label>
                            <input 
                                className="input-field" 
                                type="url" 
                                placeholder="https://polymarket.com/event/..." 
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                            <button 
                                type="submit" 
                                className="btn-primary" 
                                disabled={isSubmitting}
                                style={{ flex: 1, padding: '10px', borderRadius: '8px' }}
                            >
                                {isSubmitting ? 'Wird hinzugefügt...' : 'Hinzufügen & Syncen'}
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setShowAddForm(false)}
                                className="btn-ghost" 
                                style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}
                            >
                                Abbrechen
                            </button>
                        </div>
                    </form>
                    <p style={{ marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Info size={14} />
                        Der Server zieht automatisch alle Outcomes und Quoten aus dem Polymarket Link.
                    </p>
                </div>
            )}

            {/* Search and Filters */}
            <div style={{ position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                    className="input-field" 
                    style={{ paddingLeft: '48px', height: '48px', fontSize: '1rem' }}
                    type="text" 
                    placeholder="Wetten durchsuchen..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Content List */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="glass-panel" style={{ height: '140px', opacity: 0.3, animation: 'pulse 2s infinite' }}></div>
                    ))}
                </div>
            ) : filteredBets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.5 }}>
                    <Search size={48} style={{ marginBottom: '16px' }} />
                    <p>Keine passenden Wetten gefunden.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                    {activeBets.map(bet => (
                        <div key={bet.id} className="glass-panel card-hover" style={{ 
                            padding: '24px', 
                            borderRadius: '20px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '16px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(255,255,255,0.03)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Blue Accent Light */}
                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '60px', height: '60px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', filter: 'blur(30px)' }}></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>{bet.title}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>
                                            <Hash size={12} />
                                            {bet.slug}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>
                                            <Calendar size={12} />
                                            {new Date(bet.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {currentUser?.is_superadmin && (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                onClick={() => handleResolveBet(bet.id)}
                                                className="btn-ghost"
                                                style={{ padding: '8px', color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)' }}
                                                title="Check & Resolve"
                                            >
                                                <CheckCircle size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteBet(bet.id)}
                                                className="btn-ghost"
                                                style={{ padding: '8px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}
                                                title="Löschen"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                    <a 
                                        href={bet.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="btn-ghost"
                                        style={{ padding: '8px', color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)' }}
                                    >
                                        <ExternalLink size={18} />
                                    </a>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                                {bet.outcomes && bet.outcomes.map((outcome, idx) => (
                                    <div key={idx} style={{ position: 'relative', padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.15)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        {/* Progress Bar Background */}
                                        <div style={{ 
                                            position: 'absolute', 
                                            top: 0, 
                                            left: 0, 
                                            bottom: 0, 
                                            width: `${outcome.pct || 0}%`, 
                                            background: idx === 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            transition: 'width 1s ease-out'
                                        }}></div>
                                        
                                        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{outcome.name}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{outcome.price.toFixed(2)}</span>
                                                <span style={{ fontWeight: 800, fontSize: '1rem', color: idx === 0 ? '#3b82f6' : '#ef4444' }}>{outcome.pct || 0}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {currentUser ? (
                                <>
                                    <button 
                                        onClick={() => {
                                            setExpandedBetId(expandedBetId === bet.id ? null : bet.id);
                                            if (expandedBetId !== bet.id) {
                                                setCurrentBet({ outcomeIndex: 0, amount: '' });
                                            }
                                        }}
                                        className="btn-primary"
                                        style={{ 
                                            width: '100%', 
                                            padding: '8px', 
                                            borderRadius: '10px', 
                                            fontSize: '0.9rem',
                                            background: expandedBetId === bet.id ? 'rgba(255,255,255,0.1)' : 'var(--accent-primary)',
                                            color: expandedBetId === bet.id ? 'var(--text-main)' : 'white'
                                        }}
                                    >
                                        {expandedBetId === bet.id ? 'Schließen' : 'Wetten platzieren'}
                                    </button>

                                    {expandedBetId === bet.id && (
                                        <div style={{ 
                                            marginTop: '8px', 
                                            padding: '16px', 
                                            borderRadius: '12px', 
                                            background: 'rgba(0,0,0,0.2)', 
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                            animation: 'fadeIn 0.3s ease'
                                        }}>
                                            <h4 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--accent-primary)' }}>Wette platzieren</h4>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Outcome wählen</label>
                                                <select 
                                                    className="input-field"
                                                    style={{ height: '36px', fontSize: '0.85rem' }}
                                                    value={currentBet.outcomeIndex}
                                                    onChange={(e) => setCurrentBet({ ...currentBet, outcomeIndex: e.target.value })}
                                                >
                                                    {bet.outcomes.map((o, idx) => (
                                                        <option key={idx} value={idx}>{o.name} ({o.pct}%)</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Einsatz (KC)</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input 
                                                        type="number" 
                                                        className="input-field" 
                                                        placeholder="KC Betrag"
                                                        style={{ flex: 1, height: '36px' }}
                                                        value={currentBet.amount}
                                                        onChange={(e) => setCurrentBet({ ...currentBet, amount: e.target.value })}
                                                    />
                                                    <button 
                                                        onClick={() => handlePlaceBet(bet.id)}
                                                        disabled={bettingStatus[bet.id] === 'loading'}
                                                        className="btn-primary"
                                                        style={{ height: '36px', padding: '0 16px', borderRadius: '8px' }}
                                                    >
                                                        {bettingStatus[bet.id] === 'loading' ? '...' : 'Wetten'}
                                                    </button>
                                                </div>
                                                {currentBet.amount && (
                                                    <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', marginTop: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                            <span style={{ color: 'var(--text-muted)' }}>Erwartete Anteile:</span>
                                                            <strong style={{ color: 'var(--accent-primary)' }}>
                                                                {(parseFloat(currentBet.amount) / (bet.outcomes[currentBet.outcomeIndex]?.price || 1)).toFixed(2)} Shares
                                                            </strong>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '4px' }}>
                                                            <span style={{ color: 'var(--text-muted)' }}>Möglicher Gewinn:</span>
                                                            <strong style={{ color: '#22c55e' }}>
                                                                {(parseFloat(currentBet.amount) / (bet.outcomes[currentBet.outcomeIndex]?.price || 1)).toFixed(2)} KC
                                                            </strong>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ 
                                    padding: '12px', 
                                    borderRadius: '10px', 
                                    background: 'rgba(255,255,255,0.05)', 
                                    textAlign: 'center',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-muted)',
                                    border: '1px solid rgba(255,255,255,0.02)'
                                }}>
                                    Login erforderlich um zu wetten
                                </div>
                            )}

                            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* User Bets Accordion */}
                                {bet.placedBets && bet.placedBets.length > 0 && (
                                    <div style={{ width: '100%' }}>
                                        <button 
                                            onClick={() => setShowUserBetsId(showUserBetsId === bet.id ? null : bet.id)}
                                            style={{ 
                                                width: '100%', 
                                                background: 'rgba(255,255,255,0.05)', 
                                                border: '1px solid rgba(255,255,255,0.08)', 
                                                borderRadius: '10px',
                                                padding: '8px 12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                color: 'var(--text-muted)',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            className="hover-bright"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Users size={16} color="var(--accent-primary)" />
                                                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{bet.placedBets.length}</span> Wetten anzeigen
                                            </div>
                                            {showUserBetsId === bet.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>

                                        {showUserBetsId === bet.id && (
                                            <div className="animate-slide-down" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', padding: '4px' }}>
                                                {bet.placedBets.map((ubet, uidx) => (
                                                    <div key={uidx} style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'space-between', 
                                                        padding: '10px', 
                                                        borderRadius: '10px', 
                                                        background: 'rgba(0,0,0,0.2)',
                                                        border: '1px solid rgba(255,255,255,0.03)',
                                                        fontSize: '0.8rem'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <Avatar 
                                                                user={ubet} 
                                                                size={24} 
                                                            />
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontWeight: 600 }}>{ubet.displayName}</span>
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                                                    {new Date(ubet.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                                                                {ubet.shares ? `${ubet.shares} Shares` : `${ubet.amount} KC`}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                für <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{bet.outcomes[ubet.outcomeIndex]?.name}</span>
                                                                {ubet.priceAtBet && ` @ ${ubet.priceAtBet.toFixed(2)}`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Avatar 
                                        user={bet} 
                                        size={24} 
                                    />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Hinzugefügt von <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{bet.displayName}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Resolved Bets Section */}
            {resolvedBets.length > 0 && (
                <div style={{ marginTop: '40px' }}>
                    <button 
                        onClick={() => setResolvedAccordionOpen(!resovledAccordionOpen)}
                        style={{ 
                            width: '100%', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '16px 24px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            color: 'var(--text-main)',
                            fontSize: '1.2rem',
                            fontWeight: 700
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <CheckCircle color="var(--accent-primary)" size={24} />
                            Beendete Wetten ({resolvedBets.length})
                        </div>
                        {resovledAccordionOpen ? <ChevronUp /> : <ChevronDown />}
                    </button>

                    {resovledAccordionOpen && (
                        <div style={{ 
                            marginTop: '16px', 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', 
                            gap: '24px',
                            animation: 'fadeIn 0.3s ease'
                        }}>
                            {resolvedBets.map(bet => (
                                <div key={bet.id} className="glass-panel" style={{ 
                                    padding: '24px', 
                                    borderRadius: '20px', 
                                    opacity: 0.8,
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    background: 'rgba(0,0,0,0.2)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{bet.title}</h3>
                                        <TrendingUp size={16} color="var(--text-muted)" />
                                    </div>

                                    {/* Winner Indication */}
                                    <div style={{ 
                                        padding: '12px', 
                                        borderRadius: '12px', 
                                        background: 'rgba(59, 130, 246, 0.1)', 
                                        border: '1px solid rgba(59, 130, 246, 0.2)',
                                        marginBottom: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}>
                                        <CheckCircle size={18} color="#4ade80" />
                                        <div style={{ fontSize: '0.9rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Ergebnis: </span>
                                            <span style={{ fontWeight: 800, color: '#4ade80' }}>
                                                {JSON.parse(bet.outcomes)[bet.winnerIndex]?.name || 'Unbekannt'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Payout List */}
                                    {bet.placedBets && bet.placedBets.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, paddingLeft: '4px' }}>GEWINNER:</div>
                                            {bet.placedBets
                                                .filter(ub => ub.outcomeIndex === bet.winnerIndex)
                                                .map((ub, idx) => (
                                                    <div key={idx} style={{ 
                                                        display: 'flex', 
                                                        justifyContent: 'space-between', 
                                                        alignItems: 'center',
                                                        padding: '8px 12px',
                                                        borderRadius: '8px',
                                                        background: 'rgba(74, 222, 128, 0.05)',
                                                        border: '1px solid rgba(74, 222, 128, 0.1)'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Avatar user={ub} size={20} />
                                                            <span style={{ fontSize: '0.85rem' }}>{ub.displayName || ub.username}</span>
                                                        </div>
                                                        <span style={{ fontWeight: 800, color: '#4ade80', fontSize: '0.9rem' }}>
                                                            +{Math.floor(ub.shares)} KC
                                                        </span>
                                                    </div>
                                                ))
                                            }
                                            {bet.placedBets.filter(ub => ub.outcomeIndex === bet.winnerIndex).length === 0 && (
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>Keine Gewinner</div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>Keine Einsätze</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PolymarketGeneral;

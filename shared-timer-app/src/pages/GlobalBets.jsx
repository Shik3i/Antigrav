import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, TrendingUp, TrendingDown, Target, Clock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GlobalBets = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [bets, setBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBets = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/esports/bets/recent?days=7');
                if (!res.ok) throw new Error('Failed to load community bets');
                const data = await res.json();
                setBets(data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchBets();
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'won': return '#10b981';
            case 'lost': return '#ef4444';
            case 'canceled': return '#f59e0b';
            default: return '#3b82f6';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'won': return 'Won';
            case 'lost': return 'Lost';
            case 'canceled': return 'Canceled';
            default: return 'Open';
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="flex-center" style={{ height: '100%', opacity: 0.6 }}>
                <div className="loading-spinner" />
                <span style={{ marginLeft: '12px' }}>Loading community bets...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-center" style={{ height: '100%', color: '#ef4444' }}>
                <span>Error: {error}</span>
            </div>
        );
    }

    // Group bets by day
    const groupedBets = bets.reduce((acc, bet) => {
        const dateKey = new Date(bet.createdAt).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(bet);
        return acc;
    }, {});

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px 0' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                <button className="btn-ghost" onClick={() => navigate('/esports')} style={{ padding: '8px', borderRadius: '8px' }}>
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>
                        <span style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Community Bets
                        </span>
                    </h1>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        All bets placed by the community in the last 7 days
                    </p>
                </div>
            </div>

            {/* Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Bets</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{bets.length}</div>
                </div>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Volume</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b' }}>
                        {(bets.reduce((sum, b) => sum + b.stake, 0) / 100).toLocaleString()} KC
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Open Positions</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#3b82f6' }}>
                        {bets.filter(b => b.status === 'open').length}
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Unique Bettors</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#8b5cf6' }}>
                        {new Set(bets.map(b => b.userId)).size}
                    </div>
                </div>
            </div>

            {/* Bets List grouped by day */}
            {Object.keys(groupedBets).length === 0 ? (
                <div className="glass-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Target size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p>No bets have been placed in the last 7 days.</p>
                </div>
            ) : (
                Object.entries(groupedBets).map(([day, dayBets]) => (
                    <div key={day} style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 12px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {day}
                        </h3>
                        <div className="glass-card" style={{ overflow: 'hidden' }}>
                            {dayBets.map((bet, idx) => {
                                const statusColor = getStatusColor(bet.status);
                                const potentialWin = ((bet.stake * bet.odds) / 100).toFixed(0);
                                return (
                                    <div
                                        key={bet.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '14px 20px',
                                            borderBottom: idx < dayBets.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                            gap: '16px',
                                            transition: 'background 0.2s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        {/* Status Indicator */}
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '10px',
                                            background: `${statusColor}15`, display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                            {bet.status === 'won' ? <TrendingUp size={18} color={statusColor} /> :
                                             bet.status === 'lost' ? <TrendingDown size={18} color={statusColor} /> :
                                             <Target size={18} color={statusColor} />}
                                        </div>

                                        {/* Main Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                                    {bet.userName || 'Unknown'}
                                                </span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    → {bet.chosenTeam}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {bet.matchName}
                                            </div>
                                        </div>

                                        {/* Stake & Odds */}
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                                {(bet.stake / 100).toLocaleString()} KC
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {bet.odds?.toFixed(2)}x → {potentialWin} KC
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <div style={{
                                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem',
                                            fontWeight: 600, background: `${statusColor}15`, color: statusColor,
                                            flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em'
                                        }}>
                                            {getStatusLabel(bet.status)}
                                        </div>

                                        {/* Time */}
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, minWidth: '90px', textAlign: 'right' }}>
                                            {formatDate(bet.createdAt)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default GlobalBets;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, TrendingUp, TrendingDown, Target, Clock, Users, CalendarClock, ExternalLink, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UserContextMenu from '../components/UserContextMenu';
import Avatar from '../components/Avatar';
import { LEAGUE_COLORS } from '../hooks/useEsportsNotifications';

const forceHttps = (url) => {
    if (!url || typeof url !== 'string') return url;
    return url.replace(/^http:\/\//, 'https://');
};

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

const findTeamLogo = (name, teams) => {
    if (!name) return null;
    const normalized = name.trim().toLowerCase();
    const team = (teams || []).find(t => {
        const tName = (t.name || '').trim().toLowerCase();
        const tCode = (t.code || '').trim().toLowerCase();
        return tName === normalized || tCode === normalized;
    });
    return team ? forceHttps(team.image) : null;
};

const MatchGroup = React.memo(({ group, isUpcoming, teams }) => {
    const [t1Error, setT1Error] = useState(false);
    const [t2Error, setT2Error] = useState(false);
    
    const teams_split = group.name.split(' vs ');
    const t1Name = teams_split[0] || 'Team A';
    const t2Name = teams_split[1] || 'Team B';

    // Prioritize stored logos from the first bet in the group
    const firstBet = group.bets[0] || {};
    const t1Logo = firstBet.team1Logo ? forceHttps(firstBet.team1Logo) : findTeamLogo(t1Name, teams);
    const t2Logo = firstBet.team2Logo ? forceHttps(firstBet.team2Logo) : findTeamLogo(t2Name, teams);
    
    const leagueName = group.bets[0]?.league || 'Unknown';
    const leagueColor = LEAGUE_COLORS[leagueName] || 'var(--accent-primary)';

    return (
        <div style={{ marginBottom: '32px' }}>
            {/* Premium Match Header Card */}
            <div className="glass-card" style={{ 
                padding: '20px', 
                marginBottom: '0', 
                borderBottomLeftRadius: 0, 
                borderBottomRightRadius: 0,
                background: isUpcoming ? `linear-gradient(135deg, ${leagueColor}15, rgba(0,0,0,0.2))` : 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                borderLeft: `4px solid ${leagueColor}`,
                boxShadow: isUpcoming ? `0 0 20px ${leagueColor}10` : 'var(--shadow-card)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CalendarClock size={14} />
                            <span>{formatDate(group.date)}</span>
                        </div>
                        <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            background: `${leagueColor}20`, 
                            color: leagueColor, 
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            textTransform: 'uppercase'
                        }}>
                            {leagueName}
                        </span>
                    </div>
                    {isUpcoming && <span style={{ color: leagueColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming</span>}
                </div>

                <div className="esports-match-teams">
                    <div className="esports-team">
                        <div style={{ width: '40px', height: '40px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                            {(t1Logo && !t1Error) ? (
                                <img 
                                    src={t1Logo} 
                                    alt={t1Name} 
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                    loading="lazy" 
                                    onError={() => setT1Error(true)}
                                />
                            ) : (
                                <Trophy size={20} color="var(--text-muted)" />
                            )}
                        </div>
                        <div className="esports-team-name" style={{ fontSize: '1.1rem' }}>{t1Name}</div>
                    </div>

                    <div className="esports-vs" style={{ fontSize: '0.9rem', opacity: 0.5 }}>VS</div>

                    <div className="esports-team esports-team-right">
                        <div className="esports-team-name" style={{ fontSize: '1.1rem' }}>{t2Name}</div>
                        <div style={{ width: '40px', height: '40px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                            {(t2Logo && !t2Error) ? (
                                <img 
                                    src={t2Logo} 
                                    alt={t2Name} 
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                    loading="lazy" 
                                    onError={() => setT2Error(true)}
                                />
                            ) : (
                                <Trophy size={20} color="var(--text-muted)" />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bets List */}
            <div className="glass-card" style={{ 
                borderTopLeftRadius: 0, 
                borderTopRightRadius: 0, 
                overflow: 'hidden',
                borderTop: 'none'
            }}>
                {group.bets.map((bet, idx) => {
                    const statusColor = getStatusColor(bet.status);
                    const potentialWin = ((bet.stake * bet.odds) / 100).toFixed(0);
                    return (
                        <div
                            key={bet.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px 20px',
                                paddingLeft: '40px',
                                borderBottom: idx < group.bets.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                gap: '16px',
                                transition: 'background 0.2s',
                                position: 'relative'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            {/* Connector Line */}
                            <div style={{
                                position: 'absolute',
                                left: '20px',
                                top: idx === 0 ? '0' : '-10px',
                                bottom: idx === group.bets.length - 1 ? '50%' : '-10px',
                                width: '2px',
                                background: 'rgba(255,255,255,0.1)',
                            }} />
                            <div style={{
                                position: 'absolute',
                                left: '20px',
                                top: '50%',
                                width: '12px',
                                height: '2px',
                                background: 'rgba(255,255,255,0.1)',
                            }} />

                            {/* Avatar & User */}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <UserContextMenu username={bet.userName || 'Unknown'} userId={bet.userId}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Avatar user={{ displayName: bet.userName, preferences: bet.parsedPreferences }} size={24} src={bet.userLogo} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                                {bet.userName || 'Unknown'}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                Picked <strong style={{ color: 'var(--text-main)' }}>{bet.chosenTeam}</strong>
                                            </span>
                                        </div>
                                    </div>
                                </UserContextMenu>
                            </div>

                            {/* Stake & Odds */}
                            <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '100px' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                    {(bet.stake / 100).toLocaleString()} KC
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {bet.odds?.toFixed(2)}x → {potentialWin} KC
                                </div>
                            </div>

                            {/* Status Badge */}
                            <div style={{
                                padding: '3px 8px', borderRadius: '5px', fontSize: '0.7rem',
                                fontWeight: 700, background: `${statusColor}15`, color: statusColor,
                                flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
                                border: `1px solid ${statusColor}30`,
                                minWidth: '65px', textAlign: 'center'
                            }}>
                                {getStatusLabel(bet.status)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

const GlobalBets = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [bets, setBets] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isInitialLoad = true;
        const fetchData = async () => {
            try {
                const [betsRes, teamsRes] = await Promise.all([
                    fetch('/api/esports/bets/recent?days=7'),
                    fetch('/api/esports/teams')
                ]);

                if (!betsRes.ok) throw new Error('Failed to load community bets');
                const betsData = await betsRes.json();
                
                let teamsData = [];
                if (teamsRes.ok) {
                    teamsData = await teamsRes.json();
                    setTeams(teamsData);
                }

                // Parse userPreferences JSON for each bet
                const parsed = (betsData || []).map(bet => {
                    const parsedPrefs = bet.userPreferences ? (() => { try { return JSON.parse(bet.userPreferences); } catch { return {}; } })() : {};
                    
                    // Resolve user fan team logo
                    let userLogo = null;
                    if (parsedPrefs.fanTeam && Array.isArray(teamsData)) {
                        const team = teamsData.find(t => t.code === parsedPrefs.fanTeam);
                        if (team && team.image) userLogo = team.image.replace(/^http:\/\//, 'https://');
                    }

                    return {
                        ...bet,
                        parsedPreferences: parsedPrefs,
                        userLogo
                    };
                });

                setBets(parsed);
                setError(null);
            } catch (err) {
                if (isInitialLoad) {
                    setError(err.message);
                } else {
                    console.error('Polling error:', err);
                }
            } finally {
                setLoading(false);
                isInitialLoad = false;
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000); // Poll every 30 seconds
        return () => clearInterval(interval);
    }, []); // FIXED: only call on mount

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

    // Split and group bets
    const now = new Date();
    const upcomingBets = bets.filter(b => b.status === 'open' && new Date(b.eventDate) >= now);
    const awaitingBets = bets.filter(b => b.status === 'open' && new Date(b.eventDate) < now);
    const pastBets = bets.filter(b => b.status !== 'open');

    const groupFunction = (acc, bet) => {
        const timeKey = bet.eventDate ? new Date(bet.eventDate).toISOString().split('T')[0] : 'undated';
        const matchKey = `${bet.matchName || 'Unknown Match'}_${timeKey}`;
        if (!acc[matchKey]) acc[matchKey] = {
            name: bet.matchName || 'Unknown Match',
            date: bet.eventDate,
            bets: []
        };
        acc[matchKey].bets.push(bet);
        return acc;
    };

    const groupedUpcoming = Object.values(upcomingBets.reduce(groupFunction, {}));
    const groupedAwaiting = Object.values(awaitingBets.reduce(groupFunction, {}));
    const groupedPast = Object.values(pastBets.reduce(groupFunction, {}));

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px 20px', paddingBottom: '80px' }}>
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
                        Live insight into what the community is betting on
                    </p>
                </div>
            </div>

            {/* Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '48px' }}>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'center', borderBottom: '2px solid var(--accent-primary)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Bets</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>{bets.length}</div>
                </div>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'center', borderBottom: '2px solid #f59e0b' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Volume</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b' }}>
                        {(bets.reduce((sum, b) => sum + b.stake, 0) / 100).toLocaleString()} <span style={{fontSize: '0.9rem'}}>KC</span>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'center', borderBottom: '2px solid #3b82f6' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#3b82f6' }}>
                        {upcomingBets.length}
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'center', borderBottom: '2px solid #8b5cf6' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bettors</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#8b5cf6' }}>
                        {new Set(bets.map(b => b.userId)).size}
                    </div>
                </div>
            </div>

            {/* UPCOMING SECTION */}
            <div style={{ marginBottom: '48px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <Target size={20} color="#3b82f6" />
                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Upcoming Matches</h2>
                </div>
                {groupedUpcoming.length === 0 ? (
                    <div className="glass-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        No upcoming bets at the moment.
                    </div>
                ) : (
                    groupedUpcoming.map(group => <MatchGroup key={group.name + group.date} group={group} isUpcoming={true} teams={teams} />)
                )}
            </div>

            {/* AWAITING RESOLVE SECTION */}
            <div style={{ marginBottom: '48px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <CalendarClock size={20} color="#f59e0b" />
                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>In Progress / Awaiting Resolve</h2>
                </div>
                {groupedAwaiting.length === 0 ? (
                    <div className="glass-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        No matches currently in progress.
                    </div>
                ) : (
                    groupedAwaiting.map(group => <MatchGroup key={group.name + group.date} group={group} isUpcoming={true} teams={teams} />)
                )}
            </div>

            {/* PAST SECTION */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <Clock size={20} color="var(--text-muted)" />
                    <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)' }}>Past Results</h2>
                </div>
                {groupedPast.length === 0 ? (
                    <div className="glass-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        No resolved bets in the last 7 days.
                    </div>
                ) : (
                    groupedPast.map(group => <MatchGroup key={group.name + group.date} group={group} isUpcoming={false} teams={teams} />)
                )}
            </div>
        </div>
    );
};

export default GlobalBets;

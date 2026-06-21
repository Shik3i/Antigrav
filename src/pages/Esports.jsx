import React, { useEffect, useState } from 'react';
import { Trophy, CalendarClock, Globe, TrendingUp, ExternalLink, Timer, Star } from 'lucide-react';
import { LEAGUE_COLORS } from '../hooks/useEsportsNotifications';
import { useAuth } from '../context/AuthContext';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { useToast } from '../context/ToastContext';
import { usePersistentData } from '../context/PersistentDataContext';

const INTERNATIONAL_EVENTS = [
    { name: 'First Stand 2026', start: new Date('2026-03-16T10:00:00Z'), end: new Date('2026-03-22T23:59:59Z'), location: 'São Paulo, Brazil' },
    { name: 'MSI 2026', start: new Date('2026-06-26T10:00:00Z'), end: new Date('2026-07-12T23:59:59Z'), location: 'Daejeon, South Korea' },
    { name: 'Worlds 2026', start: new Date('2026-10-16T10:00:00Z'), end: new Date('2026-11-14T23:59:59Z'), location: 'North America' },
];

const Esports = ({ selectedLeagues = ['LCK', 'LEC', 'Prime League'], socket }) => {
    const { token, user, setUser } = useAuth();
    const { showToast } = useToast();
    const { 
        esportsMatches: matches, 
        esportsOdds: odds, 
        esportsScheduleUpdatedAt: scheduleUpdatedAt,
        esportsOddsUpdatedAt: oddsUpdatedAt,
        loadingEsports: loading,
        esportsError: error,
        loadEsportsData
    } = usePersistentData();

    const [now, setNow] = useState(new Date());
    const isVisible = usePageVisibility();

    const [bettingState, setBettingState] = useState(null);
    const [isPlacingBet, setIsPlacingBet] = useState(false);

    const favoriteTeams = user?.preferences?.favoriteTeams || [];
    const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), isVisible ? 1000 : 30000);
        return () => clearInterval(timer);
    }, [isVisible]);

    useEffect(() => {
        loadEsportsData();
    }, [loadEsportsData]);

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('de-DE', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    const getCountdown = (startTime) => {
        const diff = new Date(startTime) - now;
        if (diff <= 0) return null; // Let the LIVE badge handle it

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m ${seconds}s`;
    };

    const getLeagueColor = (league) => LEAGUE_COLORS[league] || 'var(--accent-primary)';
    const formatUpdatedAt = (value) => {
        if (!value) return null;
        return new Intl.DateTimeFormat('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(value);
    };

    // Find the next upcoming International event
    const getNextInternational = () => {
        for (const event of INTERNATIONAL_EVENTS) {
            if (now < event.end) return event;
        }
        return null;
    };

    const forceHttps = (url) => {
        if (!url || typeof url !== 'string') return url;
        return url.replace(/^http:\/\//, 'https://');
    };

    const nextEvent = getNextInternational();
    const getEventCountdown = () => {
        if (!nextEvent) return null;
        if (now >= nextEvent.start && now <= nextEvent.end) return { live: true };
        const diff = nextEvent.start - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        return { days, hours, minutes, seconds };
    };
    const eventCountdown = getEventCountdown();

    // ─── League Matching Helper (fuzzy) ───
    const LEAGUE_KEYWORDS = {
        'International': ['msi', 'mid-season', 'worlds', 'world championship', 'first stand'],
        'EMEA Masters': ['emea masters'],
        'Prime League': ['prime league'],
    };

    const matchesLeague = (leagueName, toggleId) => {
        if (!leagueName) return false;
        const ln = leagueName.toLowerCase();
        // Exact match for simple leagues (LCK, LEC, LCS, LPL)
        if (ln === toggleId.toLowerCase()) return true;
        // Keyword/substring match for fuzzy leagues
        const keywords = LEAGUE_KEYWORDS[toggleId];
        if (keywords) return keywords.some(kw => ln.includes(kw));
        return false;
    };

    // Filter matches by selected leagues from Settings, BUT ALWAYS include favorite teams
    const filteredMatches = matches.filter(m => {
        if (!m.team1 || !m.team2) return false;

        const t1Name = (m.team1.name || '').trim().toLowerCase();
        const t2Name = (m.team2.name || '').trim().toLowerCase();

        if (!t1Name || t1Name === 'tbd') return false;
        if (!t2Name || t2Name === 'tbd') return false;

        const isFavorite = favoriteTeams.includes(m.team1.code) || favoriteTeams.includes(m.team2.code);
        const inSelectedLeague = selectedLeagues.some(sl => matchesLeague(m.league, sl));

        if (showOnlyFavorites) {
            return isFavorite;
        }

        return inSelectedLeague || isFavorite;
    });

    // Match Polymarket odds to a specific match by matching the slug (team codes + date)
    const findOddsForMatch = (match) => {
        const t1Poly = (match.team1?.polymarketCode || match.team1?.code || '').toLowerCase();
        const t2Poly = (match.team2?.polymarketCode || match.team2?.code || '').toLowerCase();

        if (!t1Poly || !t2Poly || t1Poly === 'tbd' || t2Poly === 'tbd') return null;

        const matchDate = new Date(match.startTime);

        for (const odd of odds) {
            const slug = (odd.slug || '').toLowerCase();
            const title = (odd.title || '').toLowerCase();
            
            const p1 = `${t1Poly}-${t2Poly}`;
            const p2 = `${t2Poly}-${t1Poly}`;

            const matchesPermutations = slug.includes(p1) || slug.includes(p2) || title.includes(p1) || title.includes(p2);
            const hasT1 = slug.includes(t1Poly) || slug.includes(match.team1.name?.toLowerCase().replace(/\s+/g, '-'));
            const hasT2 = slug.includes(t2Poly) || slug.includes(match.team2.name?.toLowerCase().replace(/\s+/g, '-'));
            
            // Fuzzy match outcomes to team names/codes to definitively link them
            let matchedOutcomes = false;
            if (odd.outcomes && odd.outcomes.length >= 2) {
                const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const o0 = normalize(odd.outcomes[0].name);
                const o1 = normalize(odd.outcomes[1].name);
                
                const t1Ids = [match.team1.code, match.team1.name, t1Poly].map(normalize).filter(Boolean);
                const t2Ids = [match.team2.code, match.team2.name, t2Poly].map(normalize).filter(Boolean);
                
                const o0MatchesT1 = t1Ids.some(id => o0.includes(id) || id.includes(o0));
                const o0MatchesT2 = t2Ids.some(id => o0.includes(id) || id.includes(o0));
                const o1MatchesT1 = t1Ids.some(id => o1.includes(id) || id.includes(o1));
                const o1MatchesT2 = t2Ids.some(id => o1.includes(id) || id.includes(o1));
                
                if ((o0MatchesT1 && o1MatchesT2) || (o0MatchesT2 && o1MatchesT1)) matchedOutcomes = true;
            }

            if (!matchesPermutations && !(hasT1 && hasT2) && !matchedOutcomes) {
                continue;
            }

            // Extract date from slug (format: lol-team1-team2-YYYY-MM-DD)
            const dateMatch = slug.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                const slugDate = new Date(dateMatch[1] + 'T00:00:00Z');
                const diffDays = Math.abs(matchDate - slugDate) / (1000 * 60 * 60 * 24);
                if (diffDays > 1.5) continue;
            }
            return odd;
        }
        return null;
    };

    // Helper: check if a match is de-facto decided (one outcome at 100%)
    const isMatchDecided = (matchOdds) => {
        if (!matchOdds || !matchOdds.outcomes) return false;
        return matchOdds.outcomes.some(o => o.pct >= 100 || o.pct <= 0);
    };

    // Auto-update betting state when new odds stream in
    useEffect(() => {
        if (!bettingState || !bettingState.matchId || !matches.length || !odds.length) return;
        
        const match = matches.find(m => m.id === bettingState.matchId);
        if (!match) return;

        const matchOdds = findOddsForMatch(match);
        if (!matchOdds || !matchOdds.outcomes || matchOdds.outcomes.length < 2) return;

        let t1Outcome = matchOdds.outcomes[0];
        let t2Outcome = matchOdds.outcomes[1];

        const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const o0Name = normalize(t1Outcome.name);
        const t1N = normalize(match.team1.name);
        const t1Poly = normalize(match.team1.polymarketCode);
        const t2N = normalize(match.team2.name);
        const t2Poly = normalize(match.team2.polymarketCode);

        const o0MatchesT1 = o0Name.includes(t1N) || t1N.includes(o0Name) || o0Name === t1Poly || t1Poly === o0Name;
        const o0MatchesT2 = o0Name.includes(t2N) || t2N.includes(o0Name) || o0Name === t2Poly || t2Poly === o0Name;

        if (o0MatchesT2 && !o0MatchesT1) {
            t1Outcome = matchOdds.outcomes[1];
            t2Outcome = matchOdds.outcomes[0];
        } else if (!o0MatchesT1 && !o0MatchesT2) {
            const o1Name = normalize(matchOdds.outcomes[1].name);
            const o1MatchesT1 = o1Name.includes(t1N) || t1N.includes(o1Name) || o1Name === t1Poly || t1Poly === o1Name;
            if (o1MatchesT1) {
                t1Outcome = matchOdds.outcomes[1];
                t2Outcome = matchOdds.outcomes[0];
            }
        }

        const newT1Odds = Math.max(1.01, (100 / (t1Outcome.pct || 1))).toFixed(2);
        const newT2Odds = Math.max(1.01, (100 / (t2Outcome.pct || 1))).toFixed(2);

        if (bettingState.t1Odds !== newT1Odds || bettingState.t2Odds !== newT2Odds) {
            setBettingState(prev => {
                if (!prev || prev.matchId !== match.id) return prev;
                const newOdds = prev.teamName === prev.team1 ? newT1Odds : newT2Odds;
                return { ...prev, t1Odds: newT1Odds, t2Odds: newT2Odds, odds: newOdds };
            });
        }
    }, [odds, matches, bettingState?.matchId]);

    const handlePlaceBet = async () => {
        if (!bettingState) return;
        
        const parsedCoins = parseFloat((bettingState.stakeInput || '0').toString().replace(',', '.'));
        const stakeCents = Math.round(parsedCoins * 100);

        if (stakeCents <= 0) return;

        setIsPlacingBet(true);
        try {
            const res = await fetch('/api/esports/bets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    matchName: bettingState.matchName,
                    chosenTeam: bettingState.teamName,
                    polymarketTeam: bettingState.polymarketTeam,
                    stake: stakeCents,
                    odds: bettingState.odds,
                    polymarketUrl: bettingState.url,
                    eventDate: bettingState.eventDate,
                    league: bettingState.league,
                    team1Logo: bettingState.team1Logo,
                    team2Logo: bettingState.team2Logo
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to place bet');
            showToast('Wette erfolgreich platziert!', 'success');
            
            if (user && setUser) {
                setUser({ ...user, koala_balance: (user.koala_balance || 0) - stakeCents });
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setIsPlacingBet(false);
        }
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Trophy size={32} color="var(--accent-primary)" />
                    <h1 style={{ margin: 0, fontSize: '2.5rem' }}>LoL Esports</h1>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: 0 }}>
                    Showing matches for{' '}
                    {selectedLeagues.map((league, i) => (
                        <span key={league}>
                            <strong style={{ color: getLeagueColor(league) }}>{league}</strong>
                            {i < selectedLeagues.length - 1 ? ', ' : '.'}
                        </span>
                    ))}
                </p>
                {favoriteTeams.length > 0 && (
                    <button 
                        className={`btn-ghost ${showOnlyFavorites ? 'active' : ''}`} 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.9rem', border: showOnlyFavorites ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)', background: showOnlyFavorites ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: showOnlyFavorites ? 'var(--accent-primary)' : 'var(--text-main)' }}
                        onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                    >
                        <Star size={16} fill={showOnlyFavorites ? 'currentColor' : 'none'} />
                        Only Favorites
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', marginBottom: '32px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                {scheduleUpdatedAt && (
                    <span>Schedule Stand {formatUpdatedAt(scheduleUpdatedAt)}</span>
                )}
                {scheduleUpdatedAt && (odds.length > 0 || oddsUpdatedAt) && <span style={{ color: 'var(--border-color)' }}>•</span>}
                {odds.length > 0 && (
                    <span>
                        Odds via <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>Polymarket</a>{' '}
                        ({odds.length} markets)
                    </span>
                )}
                {oddsUpdatedAt && (
                    <span>Odds Stand {formatUpdatedAt(oddsUpdatedAt)}</span>
                )}
                {(odds.length > 0 || oddsUpdatedAt) && <span style={{ color: 'var(--border-color)' }}>•</span>}
                <a href="https://lolesports.com/schedule" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ExternalLink size={12} /> lolesports.com
                </a>
            </div>

            {/* International Event Countdown */}
            {nextEvent && eventCountdown && (
                <div className="glass-card" style={{
                    padding: '20px 24px', marginBottom: '24px',
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))',
                    border: '1px solid rgba(139,92,246,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Globe size={24} color="#8b5cf6" />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                                {eventCountdown.live ? '🔴 ' : ''}Next International: {nextEvent.name}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                📍 {nextEvent.location}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {eventCountdown.live ? (
                            <span style={{
                                padding: '6px 16px', borderRadius: '8px',
                                background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                                fontWeight: 700, fontSize: '0.9rem',
                                animation: 'pulse 2s infinite'
                            }}>● LIVE NOW</span>
                        ) : (
                            <>
                                {eventCountdown.days > 0 && <div style={{ textAlign: 'center', padding: '6px 12px', background: 'rgba(139,92,246,0.15)', borderRadius: '8px', minWidth: '48px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#8b5cf6' }}>{eventCountdown.days}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>days</div>
                                </div>}
                                <div style={{ textAlign: 'center', padding: '6px 12px', background: 'rgba(139,92,246,0.15)', borderRadius: '8px', minWidth: '48px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#8b5cf6' }}>{eventCountdown.hours}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>hrs</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '6px 12px', background: 'rgba(139,92,246,0.15)', borderRadius: '8px', minWidth: '48px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#8b5cf6' }}>{eventCountdown.minutes}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>min</div>
                                </div>
                                {eventCountdown.days === 0 && <div style={{ textAlign: 'center', padding: '6px 12px', background: 'rgba(139,92,246,0.15)', borderRadius: '8px', minWidth: '48px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#8b5cf6' }}>{eventCountdown.seconds}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>sec</div>
                                </div>}
                            </>
                        )}
                    </div>
                </div>
            )}

            {loading && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid rgba(59,130,246,0.3)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
                    Loading schedule...
                </div>
            )}

            {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                    {error}
                </div>
            )}

            {!loading && !error && filteredMatches.length === 0 && (
                <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <Trophy size={32} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.6 }} />
                    <div style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 600 }}>
                        {showOnlyFavorites ? 'Aktuell keine Matches deiner Favoriten.' : 'Für deine aktuelle Auswahl stehen gerade keine kommenden Matches an.'}
                    </div>
                    <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                        {showOnlyFavorites
                            ? 'Schalte zurück auf alle Ligen oder füge in den Einstellungen weitere Favoriten hinzu.'
                            : 'Passe deine Esports-Ligen in den Einstellungen an oder aktiviere den Favoriten-Filter für deine Teams.'}
                    </div>
                </div>
            )}

            {!loading && !error && filteredMatches.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {filteredMatches.map((match, index) => {
                        const leagueColor = getLeagueColor(match.league);
                        const matchOdds = findOddsForMatch(match);
                        let t1Outcome = matchOdds ? matchOdds.outcomes[0] : null;
                        let t2Outcome = matchOdds ? matchOdds.outcomes[1] : null;

                        if (matchOdds && matchOdds.outcomes.length >= 2 && match.team1 && match.team2) {
                            const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                            const o0Name = normalize(matchOdds.outcomes[0].name);
                            const t1N = normalize(match.team1.name);
                            const t1Poly = normalize(match.team1.polymarketCode);
                            const t2N = normalize(match.team2.name);
                            const t2Poly = normalize(match.team2.polymarketCode);

                            // Check if outcome 0 matches team 1
                            const o0MatchesT1 = o0Name.includes(t1N) || t1N.includes(o0Name) || o0Name === t1Poly || t1Poly === o0Name;
                            // Check if outcome 0 matches team 2
                            const o0MatchesT2 = o0Name.includes(t2N) || t2N.includes(o0Name) || o0Name === t2Poly || t2Poly === o0Name;

                            if (o0MatchesT2 && !o0MatchesT1) {
                                t1Outcome = matchOdds.outcomes[1];
                                t2Outcome = matchOdds.outcomes[0];
                            } else if (!o0MatchesT1 && !o0MatchesT2) {
                                // Default fallback: check outcome 1 against team 1
                                const o1Name = normalize(matchOdds.outcomes[1].name);
                                const o1MatchesT1 = o1Name.includes(t1N) || t1N.includes(o1Name) || o1Name === t1Poly || t1Poly === o1Name;
                                if (o1MatchesT1) {
                                    t1Outcome = matchOdds.outcomes[1];
                                    t2Outcome = matchOdds.outcomes[0];
                                }
                            }
                        }

                        return (
                             <div key={match.id} className="glass-card" style={{
                                 padding: '24px',
                                 display: 'flex', flexDirection: 'column', gap: '16px',
                                 transition: 'transform 0.2s',
                                 cursor: 'pointer',
                                 borderLeft: `4px solid ${leagueColor}`,
                                 position: 'relative'
                             }}
                                 onClick={() => {
                                     if (matchOdds && user) {
                                         // Toggle betting state
                                         if (bettingState?.matchId !== match.id) {
                                             if (match.state !== 'completed' && new Date(match.startTime) <= now) {
                                                 socket.emit('get_api_odds', { 
                                                     forceRefreshMatch: {
                                                         team1: match.team1.code,
                                                         team2: match.team2.code,
                                                         team1Name: match.team1.name,
                                                         team2Name: match.team2.name,
                                                         startTime: match.startTime
                                                     } 
                                                 });
                                             }
                                             setBettingState({
                                                 matchId: match.id,
                                                 teamName: match.team1.name,
                                                 team1: match.team1.name,
                                                 team2: match.team2.name,
                                                 t1Odds: Math.max(1.01, (100 / (t1Outcome.pct || 1))).toFixed(2),
                                                 t2Odds: Math.max(1.01, (100 / (t2Outcome.pct || 1))).toFixed(2),
                                                 odds: Math.max(1.01, (100 / (t1Outcome.pct || 1))).toFixed(2),
                                                 url: matchOdds.url,
                                                 matchName: `${match.team1.name} vs ${match.team2.name}`,
                                                  eventDate: match.startTime,
                                                  stakeInput: '1.00',
                                                  league: match.league,
                                                  team1Logo: match.team1.image,
                                                  team2Logo: match.team2.image,
                                                  polymarketTeam1: t1Outcome.name,
                                                  polymarketTeam2: t2Outcome.name,
                                                  polymarketTeam: t1Outcome.name
                                             });
                                         } else {
                                             setBettingState(null);
                                         }
                                     } else {
                                         window.open('https://lolesports.com/schedule', '_blank');
                                     }
                                 }}
                                 onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                 onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                             >
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: leagueColor, flexShrink: 0 }} />
                                        <span style={{ color: leagueColor }}>{match.league}</span>
                                        {isMatchDecided(matchOdds) ? (
                                            <span style={{
                                                fontSize: '0.7rem', padding: '2px 8px',
                                                background: 'rgba(16,185,129,0.15)', color: '#10b981',
                                                borderRadius: '12px', fontWeight: 700, textTransform: 'uppercase',
                                            }}>✓ Beendet</span>
                                        ) : (match.state === 'inProgress' || (match.state === 'unstarted' && !getCountdown(match.startTime))) && (
                                            <span style={{
                                                fontSize: '0.7rem', padding: '2px 8px',
                                                background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                                                borderRadius: '12px', fontWeight: 700, textTransform: 'uppercase',
                                                animation: 'pulse 2s infinite'
                                            }}>● LIVE</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        {match.state !== 'inProgress' && getCountdown(match.startTime) && (
                                            <span style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                color: 'var(--text-main)'
                                            }}>
                                                In {getCountdown(match.startTime)}
                                            </span>
                                        )}
                                        <CalendarClock size={16} style={{ marginLeft: '4px' }} />
                                        {formatDate(match.startTime)}
                                    </div>
                                </div>

                                {/* Teams */}
                                <div className="esports-match-teams">
                                    <div className="esports-team">
                                        <div style={{ width: '48px', height: '48px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                            {match.team1.image ? <img src={forceHttps(match.team1.image)} alt={match.team1.code} width="48" height="48" loading={index < 2 ? "eager" : "lazy"} fetchpriority={index === 0 ? "high" : "auto"} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Trophy size={24} color="var(--text-muted)" />}
                                        </div>
                                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                            <div className="esports-team-name" title={match.team1.name}>{match.team1.name}</div>
                                            {t1Outcome && (
                                                <div style={{ fontSize: '0.8rem', color: t1Outcome.pct >= 50 ? '#10b981' : '#ef4444', fontWeight: 600, marginTop: '2px' }}>
                                                    {t1Outcome.pct}%
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="esports-vs">VS</div>

                                    <div className="esports-team esports-team-right">
                                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                            <div className="esports-team-name" title={match.team2.name}>{match.team2.name}</div>
                                            {t2Outcome && (
                                                <div style={{ fontSize: '0.8rem', color: t2Outcome.pct >= 50 ? '#10b981' : '#ef4444', fontWeight: 600, marginTop: '2px' }}>
                                                    {t2Outcome.pct}%
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ width: '48px', height: '48px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                            {match.team2.image ? <img src={forceHttps(match.team2.image)} alt={match.team2.code} width="48" height="48" loading={index < 2 ? "eager" : "lazy"} fetchpriority={index === 0 ? "high" : "auto"} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Trophy size={24} color="var(--text-muted)" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Odds bar */}
                                {matchOdds && matchOdds.outcomes.length >= 2 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <TrendingUp size={14} color="var(--text-muted)" />
                                            <div style={{
                                                flex: 1, height: '6px', borderRadius: '3px',
                                                background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
                                                display: 'flex'
                                            }}>
                                                <div style={{
                                                    width: `${t1Outcome.pct}%`,
                                                    height: '100%',
                                                    background: '#10b981',
                                                    transition: 'width 0.5s ease'
                                                }} />
                                                <div style={{
                                                    width: `${t2Outcome.pct}%`,
                                                    height: '100%',
                                                    background: '#ef4444',
                                                    transition: 'width 0.5s ease'
                                                }} />
                                            </div>
                                            {user && (
                                                <button 
                                                    className="btn-primary" 
                                                    style={{ 
                                                        padding: '4px 12px', 
                                                        fontSize: '0.8rem',
                                                        opacity: (t1Outcome.pct === 0 || t1Outcome.pct === 100 || match.state === 'completed') ? 0.5 : 1    
                                                    }}
                                                    disabled={t1Outcome.pct === 0 || t1Outcome.pct === 100 || match.state === 'completed'}
                                                    onClick={(e) => {
                                                        e.stopPropagation();

                                                        // If we are opening the betting UI for the first time
                                                        if (bettingState?.matchId !== match.id) {
                                                            // If the match is already live, trigger a force refresh of odds
                                                            if (match.state !== 'completed' && new Date(match.startTime) <= now) {
                                                                socket.emit('get_api_odds', { 
                                                                    forceRefreshMatch: {
                                                                        team1: match.team1.code,
                                                                        team2: match.team2.code,
                                                                        team1Name: match.team1.name,
                                                                        team2Name: match.team2.name,
                                                                        startTime: match.startTime
                                                                    } 
                                                                });
                                                            }
                                                            
                                                            setBettingState({
                                                                matchId: match.id,
                                                                teamName: match.team1.name,
                                                                team1: match.team1.name,
                                                                team2: match.team2.name,
                                                                t1Odds: Math.max(1.01, (100 / (t1Outcome.pct || 1))).toFixed(2),
                                                                t2Odds: Math.max(1.01, (100 / (t2Outcome.pct || 1))).toFixed(2),
                                                                odds: Math.max(1.01, (100 / (t1Outcome.pct || 1))).toFixed(2),
                                                                url: matchOdds.url,
                                                                matchName: `${match.team1.name} vs ${match.team2.name}`,
                                                                 eventDate: match.startTime,
                                                                 stakeInput: '1.00', // Default to 1.00 KC
                                                                 league: match.league,
                                                                 team1Logo: match.team1.image,
                                                                 team2Logo: match.team2.image,
                                                                 polymarketTeam1: t1Outcome.name,
                                                                 polymarketTeam2: t2Outcome.name,
                                                                 polymarketTeam: t1Outcome.name
                                                            });
                                                        } else {
                                                            setBettingState(null); // Toggle close
                                                        }
                                                    }}
                                                >
                                                    Wetten
                                                </button>
                                            )}
                                             <a href={matchOdds.url} target="_blank" rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                style={{ 
                                                    color: 'var(--text-muted)', 
                                                    fontSize: '0.7rem', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '4px', 
                                                    textDecoration: 'none',
                                                    whiteSpace: 'nowrap',
                                                    background: 'rgba(0,0,0,0.3)',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px'
                                                }}
                                            >
                                                <ExternalLink size={10} /> {isMatchDecided(matchOdds) ? 'Details' : 'Polymarket'}
                                            </a>
                                        </div>

                                        {bettingState?.matchId === match.id && (
                                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>Auf dieses Spiel wetten</h4>
                                                
                                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                                    <button 
                                                        style={{ flex: 1, padding: '8px', borderRadius: '6px', background: bettingState.teamName === bettingState.team1 ? '#10b981' : 'rgba(255,255,255,0.05)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                                        onClick={() => setBettingState({...bettingState, teamName: bettingState.team1, polymarketTeam: bettingState.polymarketTeam1, odds: parseFloat(bettingState.t1Odds)})}
                                                    >
                                                        {bettingState.team1} ({bettingState.t1Odds})
                                                    </button>
                                                    <button 
                                                        style={{ flex: 1, padding: '8px', borderRadius: '6px', background: bettingState.teamName === bettingState.team2 ? '#ef4444' : 'rgba(255,255,255,0.05)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                                        onClick={() => setBettingState({...bettingState, teamName: bettingState.team2, polymarketTeam: bettingState.polymarketTeam2, odds: parseFloat(bettingState.t2Odds)})}
                                                    >
                                                        {bettingState.team2} ({bettingState.t2Odds})
                                                    </button>
                                                </div>

                                                {(() => {
                                                    const rawInput = (bettingState.stakeInput || '').replace(',', '.');
                                                    const parsedInput = parseFloat(rawInput);
                                                    const isValidNumber = !isNaN(parsedInput);
                                                    const stakeCents = isValidNumber ? Math.round(parsedInput * 100) : 0;
                                                    const isInsufficient = stakeCents > (user?.koala_balance || 0);
                                                    
                                                    return (
                                                        <>
                                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Einsatz (KoalaCoins)</label>
                                                                    <input 
                                                                        type="text" 
                                                                        value={bettingState.stakeInput} 
                                                                        onChange={e => setBettingState({...bettingState, stakeInput: e.target.value})}
                                                                        style={{ 
                                                                            width: '100%', 
                                                                            padding: '8px', 
                                                                            borderRadius: '6px', 
                                                                            background: 'rgba(0,0,0,0.3)', 
                                                                            border: `1px solid ${isInsufficient ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, 
                                                                            color: isInsufficient ? '#ef4444' : 'white',
                                                                            outline: 'none',
                                                                            boxShadow: isInsufficient ? '0 0 0 1px #ef4444' : 'none'
                                                                        }}
                                                                        placeholder="z.B. 1.50"
                                                                    />
                                                                </div>
                                                                <div style={{ flex: 1 }}>
                                                                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Möglicher Gewinn</label>
                                                                    <div style={{ padding: '8px', color: '#10b981', fontWeight: 700 }}>
                                                                        {(Math.floor(stakeCents * bettingState.odds) / 100 || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.85rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted)' }}>
                                                                    <span>Derzeitiger Kontostand:</span>
                                                                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{((user?.koala_balance || 0) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: isInsufficient ? '#ef4444' : 'var(--text-muted)' }}>
                                                                    <span>Kontostand nach Wetteinsatz:</span>
                                                                    <span style={{ fontWeight: 600 }}>
                                                                        {(((user?.koala_balance || 0) - stakeCents) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC
                                                                    </span>
                                                                </div>
                                                            </div>



                                                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                                <button className="btn-ghost" onClick={() => { setBettingState(null); }}>Abbrechen</button>
                                                                <button className="btn-primary" onClick={handlePlaceBet} disabled={
                                                                    isPlacingBet || 
                                                                    !bettingState.stakeInput ||
                                                                    !isValidNumber || 
                                                                    stakeCents <= 0 || 
                                                                    isInsufficient ||
                                                                    !bettingState.teamName
                                                                }>
                                                                    {isPlacingBet ? 'Wird platziert...' : 'Wette abschließen'}
                                                                </button>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Esports;

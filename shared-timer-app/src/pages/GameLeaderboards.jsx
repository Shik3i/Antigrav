import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, Coins, TrendingUp, ShieldCheck, ArrowUp, ArrowDown, Map, Eye, EyeOff, Loader2 } from 'lucide-react';
import Avatar from '../components/Avatar';
import UserContextMenu from '../components/UserContextMenu';
import { useAuth } from '../context/AuthContext';

const formatSprintTime = (ms) => {
    if (!ms || ms === 0) return '--:--.--';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const frac = Math.floor((ms % 1000) / 10);
    return `${min}:${sec.toString().padStart(2, '0')}.${frac.toString().padStart(2, '0')}`;
};

const GameLeaderboards = () => {
    const { user, token } = useAuth();
    const [leaderboards, setLeaderboards] = useState({ 
        koala: [], 
        scratch: [], 
        blackjack: [], 
        rift: { highestWave: [], totalMinions: [], totalBosses: [] }, 
        tetris: [], 
        tower: [],
        wordle: []
    });
    const { token: authToken } = useAuth(); // rename for helper scope if needed

    const safeJsonParse = (str, fallback = {}) => {
        if (!str) return fallback;
        if (typeof str !== 'string') return str;
        try {
            return JSON.parse(str);
        } catch (e) {
            console.error('Safe JSON Parse failed:', e);
            return fallback;
        }
    };
    const [settings, setSettings] = useState({});
    const [updatingGames, setUpdatingGames] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [koalaSortField, setKoalaSortField] = useState('highscore');
    const [koalaSortDir, setKoalaSortDir] = useState('desc');
    const [scratchSortField, setScratchSortField] = useState('totalEarned');
    const [scratchSortDir, setScratchSortDir] = useState('desc');
    const [blackjackSortField, setBlackjackSortField] = useState('totalWon');
    const [blackjackSortDir, setBlackjackSortDir] = useState('desc');
    const [riftHighestWaveSortField, setRiftHighestWaveSortField] = useState('value');
    const [riftHighestWaveSortDir, setRiftHighestWaveSortDir] = useState('desc');
    const [riftTotalMinionsSortField, setRiftTotalMinionsSortField] = useState('value');
    const [riftTotalMinionsSortDir, setRiftTotalMinionsSortDir] = useState('desc');
    const [riftTotalBossesSortField, setRiftTotalBossesSortField] = useState('value');
    const [riftTotalBossesSortDir, setRiftTotalBossesSortDir] = useState('desc');
    const [tetrisSortField, setTetrisSortField] = useState('highscore');
    const [tetrisSortDir, setTetrisSortDir] = useState('desc');
    const [towerSortField, setTowerSortField] = useState('highscore');
    const [towerSortDir, setTowerSortDir] = useState('desc');
    const [wordleSortField, setWordleSortField] = useState('totalWins');
    const [wordleSortDir, setWordleSortDir] = useState('desc');

    useEffect(() => {
        const fetchLeaderboards = async () => {
            try {
                const [lbRes, scratchRes, blackjackRes, riftRes, tetrisRes, towerRes, wordleRes, settingsRes] = await Promise.all([
                    axios.get('/api/games/leaderboard?gameId=koala_flap'),
                    axios.get('/api/scratchcards/stats'),
                    axios.get('/api/blackjack/leaderboard?sortBy=totalWon').catch(() => ({ data: { leaderboard: [] } })),
                    axios.get('/api/rift-defense/leaderboards').catch(() => ({ data: { leaderboards: { highestWave: [], totalMinions: [], totalBosses: [] } } })),
                    axios.get('/api/games/leaderboard?gameId=tetris').catch(() => ({ data: { highscores: [], cumulative: [] } })),
                    axios.get('/api/games/leaderboard?gameId=tower_climb').catch(() => ({ data: { highscores: [], cumulative: [] } })),
                    axios.get('/api/games/leaderboard?gameId=wordle').catch(() => ({ data: { highscores: [] } })),
                    axios.get('/api/leaderboards/settings').catch(() => ({ data: [] }))
                ]);

                const scratchList = (scratchRes.data.leaderboard || []).map(row => ({
                    ...row,
                    displayName: row.username,
                    totalEarned: row.totalWin,
                    totalBought: row.totalBought || 0
                }));

                // Merge KoalaFlap highscores + cumulative
                const highscoreMap = {};
                (lbRes.data.highscores || []).forEach(row => {
                    highscoreMap[row.userId || row.displayName] = { ...row };
                });
                (lbRes.data.cumulative || []).forEach(row => {
                    const key = row.userId || row.displayName;
                    if (highscoreMap[key]) {
                        highscoreMap[key].totalEarned = row.totalEarned;
                    } else {
                        highscoreMap[key] = { ...row, highscore: 0 };
                    }
                });

                // Merge Tetris highscores + lines (both now from the same response)
                const tetrisMap = {};
                (tetrisRes.data.highscores || []).forEach(row => {
                    tetrisMap[row.userId || row.displayName] = { ...row };
                });
                (tetrisRes.data.cumulative || []).forEach(row => {
                    const key = row.userId || row.displayName;
                    if (tetrisMap[key]) {
                        tetrisMap[key].totalLines = row.totalLines || 0;
                        // Always pick the non-zero sprintHighscore if it exists
                        if (row.sprintHighscore > 0 && (!tetrisMap[key].sprintHighscore || row.sprintHighscore < tetrisMap[key].sprintHighscore)) {
                            tetrisMap[key].sprintHighscore = row.sprintHighscore;
                        }
                    } else {
                        tetrisMap[key] = { ...row, highscore: 0, totalLines: row.totalLines || 0 };
                    }
                });

                const towerMap = {};
                (towerRes.data.highscores || []).forEach(row => {
                    towerMap[row.userId || row.displayName] = { ...row };
                });
                (towerRes.data.cumulative || []).forEach(row => {
                    const key = row.userId || row.displayName;
                    if (towerMap[key]) {
                        towerMap[key].totalEarned = row.totalEarned || 0;
                        towerMap[key].totalScore = row.totalScore || 0;
                    } else {
                        towerMap[key] = { ...row, highscore: 0 };
                    }
                });

                setLeaderboards({ 
                    koala: Object.values(highscoreMap), 
                    scratch: scratchList, 
                    blackjack: blackjackRes.data.leaderboard || [],
                    rift: riftRes.data.leaderboards || { highestWave: [], totalMinions: [], totalBosses: [] },
                    tetris: Object.values(tetrisMap),
                    tower: Object.values(towerMap),
                    wordle: wordleRes.data.highscores || []
                });

                const settingsMap = {};
                (settingsRes.data || []).forEach(s => {
                    settingsMap[s.game_id] = s.is_hidden === 1;
                });
                setSettings(settingsMap);

                setLoading(false);
            } catch (err) {
                console.error('Failed to fetch leaderboards:', err);
                setError('Failed to load leaderboards.');
                setLoading(false);
            }
        };
        fetchLeaderboards();
    }, []);

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', opacity: 0.6 }}>Leaderboards werden geladen...</div>;
    if (error) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#ef4444' }}>{error}</div>;

    const handleSort = (currentField, setField, currentDir, setDir, field) => {
        if (currentField === field) setDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setField(field); setDir('desc'); }
    };

    const sortData = (data, field, dir) =>
        [...data].sort((a, b) => dir === 'desc' ? (b[field] || 0) - (a[field] || 0) : (a[field] || 0) - (b[field] || 0));

    const toggleVisibility = async (gameId) => {
        if (updatingGames[gameId]) return;

        const currentHidden = settings[gameId] || false;
        const newHidden = !currentHidden;

        // Start loading state
        setUpdatingGames(prev => ({ ...prev, [gameId]: true }));
        // Optimistic UI
        setSettings(prev => ({ ...prev, [gameId]: newHidden }));

        try {
            await axios.post('/api/leaderboards/settings', 
                { game_id: gameId, is_hidden: newHidden },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
        } catch (err) {
            console.error('Failed to update leaderboard visibility:', err);
            // Rollback
            setSettings(prev => ({ ...prev, [gameId]: currentHidden }));
        } finally {
            // End loading state
            setUpdatingGames(prev => ({ ...prev, [gameId]: false }));
        }
    };

    const renderVisibilityControls = (gameId) => {
        if (!user?.is_superadmin) return null;
        
        const isHidden = settings[gameId];
        const isUpdating = updatingGames[gameId];

        return (
            <>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleVisibility(gameId);
                    }}
                    className="btn-ghost"
                    style={{ 
                        padding: '4px', 
                        borderRadius: '6px', 
                        opacity: isUpdating ? 0.7 : 1,
                        cursor: isUpdating ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    disabled={isUpdating}
                    title={isUpdating ? "Wird gespeichert..." : (isHidden ? "Einblenden" : "Ausblenden")}
                >
                    {isUpdating ? <Loader2 size={18} className="animate-spin" /> : (isHidden ? <EyeOff size={18} /> : <Eye size={18} />)}
                </button>
                {isHidden && (
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        Versteckt für User
                    </span>
                )}
            </>
        );
    };

    const SortIcon = ({ field, activeField, activeDir }) => {
        const active = activeField === field;
        return active
            ? (activeDir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)
            : <ArrowDown size={11} style={{ opacity: 0.3 }} />;
    };

    const getAccentRgb = (accentColor) => ({
        '#f59e0b': '245,158,11',
        '#3b82f6': '59,130,246',
        '#10b981': '16,185,129',
        '#8b5cf6': '139,92,246',
        '#ec4899': '236,72,153',
        '#ef4444': '239,68,68'
    }[accentColor] || '148,163,184');

    // Shared table renderer — uses CSS Grid for perfect column alignment
    const renderTable = ({ data, columns, sortField, sortDir, onSort, accentColor }) => {
        // Build grid template: [rank 28px] [avatar+name flex] [col widths...]
        const colWidths = columns.map(c => c.width || '100px');
        const gridTemplate = `28px 1fr ${colWidths.join(' ')}`;
        const accentRgb = getAccentRgb(accentColor);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Header Row */}
                <div style={{
                    display: 'grid', gridTemplateColumns: gridTemplate,
                    alignItems: 'center', padding: '6px 16px', gap: '8px'
                }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spieler</span>
                    {columns.map(col => (
                        <div
                            key={col.field}
                            onClick={() => onSort(col.field)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px',
                                cursor: 'pointer', userSelect: 'none',
                                color: sortField === col.field ? accentColor : 'var(--text-muted)',
                                fontWeight: sortField === col.field ? 700 : 500,
                                fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em'
                            }}
                        >
                            {col.label}
                            <SortIcon field={col.field} activeField={sortField} activeDir={sortDir} />
                        </div>
                    ))}
                </div>

                {/* Data Rows */}
                {data.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', opacity: 0.4 }}>Noch keine Einträge.</div>
                ) : (
                    data.map((row, index) => (
                        <div key={index} style={{
                            display: 'grid', gridTemplateColumns: gridTemplate,
                            alignItems: 'center', padding: '10px 16px', gap: '8px',
                            background: index === 0 ? `rgba(${accentRgb}, 0.08)` : 'rgba(255,255,255,0.025)',
                            borderRadius: '10px',
                            border: index === 0 ? `1px solid rgba(${accentRgb}, 0.2)` : '1px solid rgba(255,255,255,0.04)',
                        }}>
                            {/* Rank */}
                            <div style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: index < 3 ? accentColor : 'rgba(255,255,255,0.1)',
                                fontSize: '0.7rem', fontWeight: 800,
                                color: index < 3 ? '#000' : 'inherit'
                            }}>
                                {index + 1}
                            </div>

                            {/* Name + Avatar */}
                            <UserContextMenu username={row.username || row.displayName} userId={row.userId}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                    <Avatar user={{ 
                                        username: row.username || row.displayName, 
                                        preferences: safeJsonParse(row.preferences)
                                    }} size={26} />
                                    <span style={{ fontWeight: 500, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {row.displayName}
                                    </span>
                                </div>
                            </UserContextMenu>

                            {/* Value Columns */}
                            {columns.map(col => (
                                <div key={col.field} style={{
                                    textAlign: 'right', fontWeight: sortField === col.field ? 800 : 600,
                                    fontSize: '0.9rem',
                                    color: sortField === col.field ? (index === 0 ? accentColor : 'var(--text-main)') : 'var(--text-muted)'
                                }}>
                                    {col.format ? col.format(row[col.field] || 0, row) : (row[col.field] || 0).toLocaleString()}
                                    {col.suffix && <span style={{ fontSize: '0.65rem', marginLeft: '3px', opacity: 0.7 }}>{col.suffix}</span>}
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
        );
    };

    const sortedTower = sortData(leaderboards.tower, towerSortField, towerSortDir);
    const sortedWordle = sortData(leaderboards.wordle, wordleSortField, wordleSortDir);
    const sortedKoala = sortData(leaderboards.koala, koalaSortField, koalaSortDir);
    const sortedScratch = sortData(leaderboards.scratch, scratchSortField, scratchSortDir);
    const sortedBlackjack = sortData(leaderboards.blackjack, blackjackSortField, blackjackSortDir);
    const sortedRiftHighestWave = sortData(leaderboards.rift.highestWave, riftHighestWaveSortField, riftHighestWaveSortDir);
    const sortedRiftTotalMinions = sortData(leaderboards.rift.totalMinions, riftTotalMinionsSortField, riftTotalMinionsSortDir);
    const sortedRiftTotalBosses = sortData(leaderboards.rift.totalBosses, riftTotalBossesSortField, riftTotalBossesSortDir);
    const sortedTetris = sortData(leaderboards.tetris, tetrisSortField, tetrisSortDir);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
            {/* Page Header */}
            <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '12px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Game Leaderboards
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Die absoluten Legenden unserer Spiele.</p>
            </div>

            {/* KoalaFlap */}
            {(!settings['koala_flap'] || user?.is_superadmin) && (
                <section style={{ 
                    opacity: settings['koala_flap'] ? 0.6 : 1, 
                    filter: settings['koala_flap'] ? 'grayscale(0.5)' : 'none',
                    transition: 'opacity 0.3s ease, filter 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={18} color="#fff" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>KOALAFLAP</h2>
                        {renderVisibilityControls('koala_flap')}
                    </div>
                    <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <TrendingUp size={18} color="#3b82f6" />
                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Rangliste</span>
                        </div>
                        {renderTable({
                            data: sortedKoala,
                            accentColor: '#3b82f6',
                            sortField: koalaSortField,
                            sortDir: koalaSortDir,
                            onSort: (f) => handleSort(koalaSortField, setKoalaSortField, koalaSortDir, setKoalaSortDir, f),
                            columns: [
                                { field: 'highscore', label: 'Streak', width: '90px' },
                                { field: 'totalEarned', label: 'Total Coins', width: '110px', format: v => v.toLocaleString() }
                            ]
                        })}
                    </div>
                </section>
            )}

            {/* Scratch & Win */}
            {(!settings['scratch_cards'] || user?.is_superadmin) && (
                <section style={{ 
                    opacity: settings['scratch_cards'] ? 0.6 : 1, 
                    filter: settings['scratch_cards'] ? 'grayscale(0.5)' : 'none',
                    transition: 'opacity 0.3s ease, filter 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trophy size={18} color="#fff" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>SCRATCH & WIN</h2>
                        {renderVisibilityControls('scratch_cards')}
                    </div>
                    <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <Coins size={18} color="#f59e0b" />
                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Rangliste</span>
                        </div>
                        {renderTable({
                            data: sortedScratch,
                            accentColor: '#f59e0b',
                            sortField: scratchSortField,
                            sortDir: scratchSortDir,
                            onSort: (f) => handleSort(scratchSortField, setScratchSortField, scratchSortDir, setScratchSortDir, f),
                            columns: [
                                { field: 'totalEarned', label: 'Gewinn', width: '100px', format: v => (v / 100).toLocaleString('de-DE'), suffix: 'KC' },
                                { field: 'ticketsWon', label: 'Tickets Won', width: '110px', suffix: 'Lose' },
                                { field: 'totalBought', label: 'Total Bought', width: '115px', suffix: 'Lose' }
                            ]
                        })}
                    </div>
                </section>
            )}

            {/* Blackjack */}
            {(!settings['blackjack'] || user?.is_superadmin) && (
                <section style={{ 
                    opacity: settings['blackjack'] ? 0.6 : 1, 
                    filter: settings['blackjack'] ? 'grayscale(0.5)' : 'none',
                    transition: 'opacity 0.3s ease, filter 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trophy size={18} color="#fff" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>BLACKJACK</h2>
                        {renderVisibilityControls('blackjack')}
                    </div>
                    <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <Coins size={18} color="#22c55e" />
                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Rangliste</span>
                        </div>
                        {renderTable({
                            data: sortedBlackjack,
                            accentColor: '#22c55e',
                            sortField: blackjackSortField,
                            sortDir: blackjackSortDir,
                            onSort: (f) => handleSort(blackjackSortField, setBlackjackSortField, blackjackSortDir, setBlackjackSortDir, f),
                            columns: [
                                { field: 'totalWon', label: 'Net Profit', width: '110px', format: v => (v / 100).toLocaleString('de-DE'), suffix: 'KC' },
                                { field: 'gamesPlayed', label: 'Games', width: '80px', format: v => v.toLocaleString() },
                                { field: 'blackjacksHit', label: 'Blackjacks', width: '100px', format: v => v.toLocaleString() },
                                { field: 'totalWagered', label: 'Gesetzt', width: '110px', format: v => (v / 100).toLocaleString('de-DE'), suffix: 'KC' }
                            ]
                        })}
                    </div>
                </section>
            )}

            {/* Rift Defense */}
            {(!settings['rift_defense'] || user?.is_superadmin) && (
                <section style={{ 
                    opacity: settings['rift_defense'] ? 0.6 : 1, 
                    filter: settings['rift_defense'] ? 'grayscale(0.5)' : 'none',
                    transition: 'opacity 0.3s ease, filter 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Map size={18} color="#fff" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>LEC RIFT DEFENSE</h2>
                        {renderVisibilityControls('rift_defense')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                        {/* Highest Wave */}
                        <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#10b981' }}>Höchste Welle</span>
                            </div>
                            {renderTable({
                                data: sortedRiftHighestWave,
                                accentColor: '#10b981',
                                sortField: riftHighestWaveSortField,
                                sortDir: riftHighestWaveSortDir,
                                onSort: (f) => handleSort(riftHighestWaveSortField, setRiftHighestWaveSortField, riftHighestWaveSortDir, setRiftHighestWaveSortDir, f),
                                columns: [{ field: 'value', label: 'Welle', width: '80px', format: v => v.toLocaleString() }]
                            })}
                        </div>
                        
                        {/* Minion Kills */}
                        <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#8b5cf6' }}>Minion Kills</span>
                            </div>
                            {renderTable({
                                data: sortedRiftTotalMinions,
                                accentColor: '#8b5cf6',
                                sortField: riftTotalMinionsSortField,
                                sortDir: riftTotalMinionsSortDir,
                                onSort: (f) => handleSort(riftTotalMinionsSortField, setRiftTotalMinionsSortField, riftTotalMinionsSortDir, setRiftTotalMinionsSortDir, f),
                                columns: [{ field: 'value', label: 'Kills', width: '80px', format: v => v.toLocaleString() }]
                            })}
                        </div>

                        {/* Boss Kills */}
                        <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#ef4444' }}>Boss Kills</span>
                            </div>
                            {renderTable({
                                data: sortedRiftTotalBosses,
                                accentColor: '#ef4444',
                                sortField: riftTotalBossesSortField,
                                sortDir: riftTotalBossesSortDir,
                                onSort: (f) => handleSort(riftTotalBossesSortField, setRiftTotalBossesSortField, riftTotalBossesSortDir, setRiftTotalBossesSortDir, f),
                                columns: [{ field: 'value', label: 'Kills', width: '80px', format: v => v.toLocaleString() }]
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* Tetris */}
            {(!settings['tetris'] || user?.is_superadmin) && (
                <section style={{ 
                    opacity: settings['tetris'] ? 0.6 : 1, 
                    filter: settings['tetris'] ? 'grayscale(0.5)' : 'none',
                    transition: 'opacity 0.3s ease, filter 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trophy size={18} color="#fff" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>TETRIS</h2>
                        {renderVisibilityControls('tetris')}
                    </div>
                    <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <TrendingUp size={18} color="#ec4899" />
                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Rangliste</span>
                        </div>
                        {renderTable({
                            data: sortedTetris,
                            accentColor: '#ec4899',
                            sortField: tetrisSortField,
                            sortDir: tetrisSortDir,
                            onSort: (f) => handleSort(tetrisSortField, setTetrisSortField, tetrisSortDir, setTetrisSortDir, f),
                            columns: [
                                { field: 'highscore', label: 'Highscore', width: '100px', format: v => v.toLocaleString() },
                                { field: 'sprintHighscore', label: 'Sprint (40L)', width: '120px', format: v => formatSprintTime(v) },
                                { field: 'maxLevel', label: 'Max Level', width: '90px' },
                                { field: 'totalLines', label: 'Total Lines (Lifetime)', width: '150px', format: v => v.toLocaleString() }
                            ]
                        })}
                    </div>
                </section>
            )}

            {/* Wordle */}
            {(!settings['wordle'] || user?.is_superadmin) && (
                <section style={{ 
                    opacity: settings['wordle'] ? 0.6 : 1, 
                    filter: settings['wordle'] ? 'grayscale(0.5)' : 'none',
                    transition: 'opacity 0.3s ease, filter 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trophy size={18} color="#fff" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>WORDLE</h2>
                        {renderVisibilityControls('wordle')}
                    </div>
                    <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <TrendingUp size={18} color="#06b6d4" />
                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Overall Stats</span>
                        </div>
                        {renderTable({
                            data: sortedWordle,
                            accentColor: '#06b6d4',
                            sortField: wordleSortField,
                            sortDir: wordleSortDir,
                            onSort: (f) => handleSort(wordleSortField, setWordleSortField, wordleSortDir, setWordleSortDir, f),
                            columns: [
                                { field: 'totalWins', label: 'Wins', width: '80px' },
                                { field: 'currentStreak', label: 'Streak', width: '90px' },
                                { field: 'maxStreak', label: 'Max Streak', width: '110px' },
                                { field: 'totalPlayed', label: 'Games', width: '80px' }
                            ]
                        })}
                    </div>
                </section>
            )}

            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)' }}>
                <ShieldCheck size={24} color="#10b981" />
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <strong>Fair Play garantiert:</strong> Alle Ergebnisse werden serverseitig verifiziert. Highscores werden nur für registrierte Nutzer gespeichert.
                </p>
            </div>
        </div>
    );
};

export default GameLeaderboards;

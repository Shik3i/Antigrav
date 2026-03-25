import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, Coins, TrendingUp, ShieldCheck, ArrowUp, ArrowDown, Map } from 'lucide-react';
import Avatar from '../components/Avatar';
import UserContextMenu from '../components/UserContextMenu';

const GameLeaderboards = () => {
    const [leaderboards, setLeaderboards] = useState({ koala: [], scratch: [], rift: { highestWave: [], totalMinions: [], totalBosses: [] } });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [koalaSortField, setKoalaSortField] = useState('highscore');
    const [koalaSortDir, setKoalaSortDir] = useState('desc');
    const [scratchSortField, setScratchSortField] = useState('totalEarned');
    const [scratchSortDir, setScratchSortDir] = useState('desc');
    const [riftWaveSortField, setRiftWaveSortField] = useState('value');
    const [riftWaveSortDir, setRiftWaveSortDir] = useState('desc');
    const [riftMinionsSortField, setRiftMinionsSortField] = useState('value');
    const [riftMinionsSortDir, setRiftMinionsSortDir] = useState('desc');
    const [riftBossesSortField, setRiftBossesSortField] = useState('value');
    const [riftBossesSortDir, setRiftBossesSortDir] = useState('desc');

    useEffect(() => {
        const fetchLeaderboards = async () => {
            try {
                const [lbRes, scratchRes, riftRes] = await Promise.all([
                    axios.get('/api/games/leaderboard?gameId=koala_flap'),
                    axios.get('/api/scratchcards/stats'),
                    axios.get('/api/rift-defense/leaderboards').catch(() => ({ data: { leaderboards: { highestWave: [], totalMinions: [], totalBosses: [] } } }))
                ]);

                const scratchList = (scratchRes.data.leaderboard || []).map(row => ({
                    ...row,
                    displayName: row.username,
                    totalEarned: row.totalWin,
                    totalBought: row.totalBought || 0
                }));

                // Merge KoalaFlap highscores + cumulative into one list
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

                setLeaderboards({ koala: Object.values(highscoreMap), scratch: scratchList, rift: riftRes.data.leaderboards || { highestWave: [], totalMinions: [], totalBosses: [] } });
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

    const SortIcon = ({ field, activeField, activeDir }) => {
        const active = activeField === field;
        return active
            ? (activeDir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)
            : <ArrowDown size={11} style={{ opacity: 0.3 }} />;
    };

    // Shared table renderer — uses CSS Grid for perfect column alignment
    const renderTable = ({ data, columns, sortField, sortDir, onSort, accentColor }) => {
        // Build grid template: [rank 28px] [avatar+name flex] [col widths...]
        const colWidths = columns.map(c => c.width || '100px');
        const gridTemplate = `28px 1fr ${colWidths.join(' ')}`;

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
                            background: index === 0 ? `rgba(${accentColor === '#f59e0b' ? '245,158,11' : accentColor === '#3b82f6' ? '59,130,246' : '16,185,129'}, 0.08)` : 'rgba(255,255,255,0.025)',
                            borderRadius: '10px',
                            border: index === 0 ? `1px solid rgba(${accentColor === '#f59e0b' ? '245,158,11' : accentColor === '#3b82f6' ? '59,130,246' : '16,185,129'}, 0.2)` : '1px solid rgba(255,255,255,0.04)',
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
                                    <Avatar user={{ username: row.username || row.displayName, preferences: typeof row.preferences === 'string' ? JSON.parse(row.preferences || '{}') : (row.preferences || {}) }} size={26} />
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

    const sortedKoala = sortData(leaderboards.koala, koalaSortField, koalaSortDir);
    const sortedScratch = sortData(leaderboards.scratch, scratchSortField, scratchSortDir);
    const sortedRiftWave = sortData(leaderboards.rift.highestWave, riftWaveSortField, riftWaveSortDir);
    const sortedRiftMinions = sortData(leaderboards.rift.totalMinions, riftMinionsSortField, riftMinionsSortDir);
    const sortedRiftBosses = sortData(leaderboards.rift.totalBosses, riftBossesSortField, riftBossesSortDir);

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
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp size={18} color="#fff" />
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>KOALAFLAP</h2>
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

            {/* Scratch & Win */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trophy size={18} color="#fff" />
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>SCRATCH & WIN</h2>
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

            {/* Rift Defense */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Map size={18} color="#fff" />
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>LEC RIFT DEFENSE</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#10b981' }}>Höchste Welle</span>
                        </div>
                        {renderTable({
                            data: sortedRiftWave,
                            accentColor: '#10b981',
                            sortField: riftWaveSortField,
                            sortDir: riftWaveSortDir,
                            onSort: (f) => handleSort(riftWaveSortField, setRiftWaveSortField, riftWaveSortDir, setRiftWaveSortDir, f),
                            columns: [{ field: 'value', label: 'Welle', width: '80px', format: v => v.toLocaleString() }]
                        })}
                    </div>
                    
                    <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#8b5cf6' }}>Minion Kills</span>
                        </div>
                        {renderTable({
                            data: sortedRiftMinions,
                            accentColor: '#8b5cf6',
                            sortField: riftMinionsSortField,
                            sortDir: riftMinionsSortDir,
                            onSort: (f) => handleSort(riftMinionsSortField, setRiftMinionsSortField, riftMinionsSortDir, setRiftMinionsSortDir, f),
                            columns: [{ field: 'value', label: 'Kills', width: '80px', format: v => v.toLocaleString() }]
                        })}
                    </div>

                    <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#ef4444' }}>Boss Kills</span>
                        </div>
                        {renderTable({
                            data: sortedRiftBosses,
                            accentColor: '#ef4444',
                            sortField: riftBossesSortField,
                            sortDir: riftBossesSortDir,
                            onSort: (f) => handleSort(riftBossesSortField, setRiftBossesSortField, riftBossesSortDir, setRiftBossesSortDir, f),
                            columns: [{ field: 'value', label: 'Kills', width: '80px', format: v => v.toLocaleString() }]
                        })}
                    </div>
                </div>
            </section>

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

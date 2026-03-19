import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Award, Calendar, Clock, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Highscores = () => {
    const [data, setData] = useState({ topUsers: [], topCoins: [], stats: {} });
    const [historyData, setHistoryData] = useState([]);
    const [historyRange, setHistoryRange] = useState(7);
    const [activeTab, setActiveTab] = useState('timers');
    const [accuracyData, setAccuracyData] = useState([]);
    const [accuracySort, setAccuracySort] = useState({ key: 'winRate', direction: 'desc' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/highscores').then(res => res.json()),
            fetch('/api/highscores/coins').then(res => res.json())
        ])
            .then(([timerData, coinData]) => {
                setData({
                    topUsers: timerData.topUsers || [],
                    stats: timerData.stats || {},
                    topCoins: coinData || []
                });
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch highscores', err);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        fetch(`/api/highscores/history?days=${historyRange}`)
            .then(res => res.json())
            .then(setHistoryData)
            .catch(console.error);
    }, [historyRange]);

    useEffect(() => {
        if (activeTab === 'accuracy' && accuracyData.length === 0) {
            fetch('/api/highscores/accuracy')
                .then(res => res.json())
                .then(setAccuracyData)
                .catch(console.error);
        }
    }, [activeTab]);

    const handleAccuracySort = (key) => {
        setAccuracySort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const sortedAccuracy = [...accuracyData].sort((a, b) => {
        const factor = accuracySort.direction === 'desc' ? -1 : 1;
        if (a[accuracySort.key] < b[accuracySort.key]) return -1 * factor;
        if (a[accuracySort.key] > b[accuracySort.key]) return 1 * factor;
        return 0;
    });

    const getRankIcon = (index) => {
        switch (index) {
            case 0: return <Trophy color="#fbbf24" size={24} />; // Gold
            case 1: return <Medal color="#9ca3af" size={24} />; // Silver
            case 2: return <Award color="#b45309" size={24} />; // Bronze
            default: return <span style={{ width: '24px', display: 'inline-block', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)' }}>{index + 1}</span>;
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const hours = payload[0]?.value;
            const sessions = payload[0]?.payload?.sessions;
            return (
                <div style={{ background: 'rgba(20, 24, 30, 0.95)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)' }}>{label}</p>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--accent-primary)' }}>{hours} hours</p>
                    {sessions != null && <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sessions} sessions</p>}
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: '100px', color: 'var(--text-muted)' }}>Loading statistics...</div>;
    }

    const { topUsers, stats } = data;

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '32px' }}>

            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '16px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
                    <Trophy color="var(--accent-secondary)" size={40} />
                    Global Statistics
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                    Top contributors and server-wide focus trends.
                </p>
            </div>

            {/* Top Users Table */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                    <button
                        style={{ flex: 1, padding: '16px', background: activeTab === 'timers' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', color: activeTab === 'timers' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: activeTab === 'timers' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s' }}
                        onClick={() => setActiveTab('timers')}
                    >
                        Focus Time
                    </button>
                    <button
                        style={{ flex: 1, padding: '16px', background: activeTab === 'coins' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', color: activeTab === 'coins' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: activeTab === 'coins' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}
                        onClick={() => setActiveTab('coins')}
                    >
                        KoalaCoins Leaderboard
                    </button>
                    <button
                        style={{ flex: 1, padding: '16px', background: activeTab === 'accuracy' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', color: activeTab === 'accuracy' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: activeTab === 'accuracy' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s' }}
                        onClick={() => setActiveTab('accuracy')}
                    >
                        Betting Accuracy
                    </button>
                </div>

                {activeTab === 'timers' && (
                    (!topUsers || topUsers.length === 0) ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No completed timers yet across the server!</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                                    <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, width: '80px' }}>Rank</th>
                                    <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600 }}>Name</th>
                                    <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Sessions</th>
                                    <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Total Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topUsers.map((score, index) => {
                                    const maxScore = topUsers[0]?.totalCompleted || 1;
                                    const barWidth = (score.totalCompleted / maxScore) * 100;

                                    return (
                                        <tr key={index} style={{ borderBottom: index < topUsers.length - 1 ? '1px solid var(--border-color)' : 'none', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '16px 24px', display: 'flex', alignItems: 'center' }}>
                                                {getRankIcon(index)}
                                            </td>
                                            <td style={{ padding: '16px 24px' }}>
                                                <div style={{ fontWeight: 500, marginBottom: '4px' }}>{score.displayName}</div>
                                                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${barWidth}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: '2px' }}></div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                                                {score.sessionCount}
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                                                {score.totalCompleted}h
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )
                )}

                {activeTab === 'coins' && (
                    (!data.topCoins || data.topCoins.length === 0) ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No coins earned yet!</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                                    <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, width: '80px' }}>Rank</th>
                                    <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600 }}>Name</th>
                                    <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>KoalaCoins Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.topCoins.map((score, index) => {
                                    const maxScore = data.topCoins[0]?.koala_balance || 1;
                                    const barWidth = (score.koala_balance / maxScore) * 100;
                                    return (
                                        <tr key={index} style={{ borderBottom: index < data.topCoins.length - 1 ? '1px solid var(--border-color)' : 'none', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '16px 24px', display: 'flex', alignItems: 'center' }}>
                                                {getRankIcon(index)}
                                            </td>
                                            <td style={{ padding: '16px 24px' }}>
                                                <div style={{ fontWeight: 500, marginBottom: '4px' }}>{score.displayName}</div>
                                                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${barWidth}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #d97706)', borderRadius: '2px' }}></div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', color: '#f59e0b' }}>
                                                {(score.koala_balance / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )
                )}

                {activeTab === 'accuracy' && (
                    (!accuracyData || accuracyData.length === 0) ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No resolved bets yet!</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                                    <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, width: '80px' }}>Rank</th>
                                    <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600 }}>Name</th>
                                    <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Unique Picks</th>
                                    <th 
                                        style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right', cursor: 'pointer' }}
                                        onClick={() => handleAccuracySort('correctPredictions')}
                                    >
                                        Correct {accuracySort.key === 'correctPredictions' && (accuracySort.direction === 'desc' ? '▼' : '▲')}
                                    </th>
                                    <th 
                                        style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right', cursor: 'pointer' }}
                                        onClick={() => handleAccuracySort('winRate')}
                                    >
                                        Win Rate {accuracySort.key === 'winRate' && (accuracySort.direction === 'desc' ? '▼' : '▲')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAccuracy.map((score, index) => {
                                    return (
                                        <tr key={index} style={{ borderBottom: index < sortedAccuracy.length - 1 ? '1px solid var(--border-color)' : 'none', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '16px 24px', display: 'flex', alignItems: 'center' }}>
                                                {getRankIcon(index)}
                                            </td>
                                            <td style={{ padding: '16px 24px' }}>
                                                <div style={{ fontWeight: 500 }}>{score.displayName}</div>
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                                {score.totalPredictions}
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                                                {score.correctPredictions}
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', color: '#10b981' }}>
                                                {Math.round(score.winRate)}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )
                )}
            </div>

            {/* Statistics Dashboard */}
            {
                stats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

                        {/* Hourly Stats */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '1.1rem' }}>
                                <Clock size={20} color="var(--accent-primary)" /> Peak Focus Hours
                            </h3>
                            <div style={{ width: '100%', minWidth: 0 }}>
                                <ResponsiveContainer width="100%" height={250} minWidth={0}>
                                    <BarChart data={stats.byHour} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                        <Bar dataKey="count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Weekday Stats */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '1.1rem' }}>
                                <Calendar size={20} color="var(--accent-secondary)" /> Activity by Day
                            </h3>
                            <div style={{ width: '100%', minWidth: 0 }}>
                                <ResponsiveContainer width="100%" height={250} minWidth={0}>
                                    <BarChart data={stats.byWeekday} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                        <Bar dataKey="count" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Monthly Stats */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '1.1rem' }}>
                                <BarChart3 size={20} color="#10b981" /> Monthly Trends
                            </h3>
                            <div style={{ width: '100%', minWidth: 0 }}>
                                <ResponsiveContainer width="100%" height={250} minWidth={0}>
                                    <BarChart data={stats.byMonth} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Daily Activity History (Last X Days) - Full Width */}
                        <div className="glass-card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.1rem' }}>
                                    <BarChart3 size={20} color="var(--accent-primary)" /> History
                                </h3>
                                <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '6px' }}>
                                    {[7, 14, 30].map(days => (
                                        <button
                                            key={days}
                                            onClick={() => setHistoryRange(days)}
                                            style={{
                                                padding: '2px 8px',
                                                fontSize: '0.75rem',
                                                borderRadius: '4px',
                                                border: 'none',
                                                background: historyRange === days ? 'var(--accent-primary)' : 'transparent',
                                                color: historyRange === days ? 'white' : 'var(--text-muted)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                fontWeight: historyRange === days ? 600 : 400
                                            }}
                                        >
                                            {days}d
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ width: '100%', minWidth: 0 }}>
                                <ResponsiveContainer width="100%" height={250} minWidth={0}>
                                    <BarChart data={historyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis 
                                            dataKey="label" 
                                            stroke="var(--text-muted)" 
                                            fontSize={10} 
                                            tickLine={false} 
                                            axisLine={false}
                                            tickFormatter={(val) => {
                                                const d = new Date(val);
                                                return `${d.getDate()}.${d.getMonth() + 1}.`;
                                            }}
                                        />
                                        <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip 
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const d = new Date(label);
                                                    return (
                                                        <div style={{ background: 'rgba(20, 24, 30, 0.95)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                                            <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)' }}>{d.toLocaleDateString('de-DE')}</p>
                                                            <p style={{ margin: 0, fontWeight: 700, color: 'var(--accent-primary)' }}>{payload[0].value} hours</p>
                                                            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{payload[0].payload.sessions} sessions</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                                        />
                                        <Bar dataKey="count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                    </div>
                )
            }

        </div >
    );
};

export default Highscores;
